/**
 * author thebadlorax
 * created on 24-02-2026-17h-11m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Database } from "./db";
import { LogWizard } from "./logging";
import { generateRandomString } from "./utils";
import { type User, AuthorizationWizard, JSONToUser } from "./auth"
import type { ServerWebSocket } from "bun";

export type message = {
    type: string;
    content: string;
    timestamp: number;
}

// TODO: move prefix and color to serverside and request from clientside to disallow spoofing
// TODO: allow images or gifs hosted from website to be embedded
// TODO: show timestamps somehow (context menu?)
// TODO: rate limiting / spam filter (message stacking? [10] thebadlorax: 676767)
// TODO: add viewer ws array to send live updates like getting added to a chat

export class ChatWizard {
    protected instances: Array<ChatInstance> = new Array();
    protected subscriptions: Map<string, Array<ChatInstance>> = new Map();
    protected assignees: Map<string, Array<ChatInstance>> = new Map();
    protected viewers: Array<ServerWebSocket<{ source: string }>> = new Array();

    protected db: Database;
    protected log: LogWizard = new LogWizard();
    protected auth: AuthorizationWizard;
    constructor(db: Database) { this.db = db; this.auth = new AuthorizationWizard(this.db); this.log.log("Initalized", "CHATWIZARD"); this.init();};

    async init() {
        await this.revitalizeOldChats();
        await this.makeMainChat();
    }

    async makeMainChat() {
        let data = await this.db.fetch("chats");
        if(data == undefined) {
            let main = await this.create();
            if(!main) return;
            await main.modifyProperty("display_name", "main");
            main.display_name = "main";
            this.publicize(main);
            main.immutable = true;
        }
    }

    async revitalizeOldChats() {
        this.instances.length = 0;
        this.assignees.clear();
        let all_chats: any[] = await this.db.fetch("chats");
        let names; let assignees;
        try { names = Object.values(all_chats).map(a => a.display_name); assignees = Object.values(all_chats).map(a => a.assignees); }
        catch { return };
        all_chats = Object.keys(all_chats);
        all_chats.forEach(async id => { await this.createInheritance(id); });
    }

    async create() { let n = new ChatInstance(this.db, undefined, this); this.instances.push(n); await n.init(); return n; };
    async createInheritance(id: string) { let n = new ChatInstance(this.db, id, this); n.id = id; this.instances.push(n); await n.init(); return n; }
    fromID(id: string) { try { return this.instances.find(ins => ins.id == id); } catch { return undefined; } };
    async destroy(i: ChatInstance, u: string) {
        if(!i) return;
        if(i.immutable) return;
        let data; try { data = await this.db.fetch("chats"); }
        catch { return; }
        if(this.assignees.get(u) == undefined) return;

        this.assignees.get(u)!.splice(this.assignees.get(u)!.indexOf(i), 1);
        if(this.assignees.get("*")!.includes(i)) {
            this.assignees.set("*", this.assignees.get("*")!.toSpliced(this.assignees.get("*")!.indexOf(i), 1));
        }

        delete this.instances[this.instances.indexOf(i)];
        delete data[i.id];
        this.db.modify("chats", data);
        await this.revitalizeOldChats();
     };
    async assign(id: string, i: ChatInstance) { 
        if(i.immutable) return;
        let e = this.assignees.get(id) || new Array();
        e.push(i);
        this.assignees.set(id, e);
        let found_assignees = await i.fetchProperty("assignees");
        if(!found_assignees.includes(id)) {
            found_assignees.push(id);
            await i.modifyProperty("assignees", found_assignees)
        }
    };
    async publicize(i: ChatInstance) { await this.assign("*", i); return i; }
    deassign(u: User, i: ChatInstance) {
        if(this.assignees.get(u.account.id)?.includes(i)) return;
        let e = this.assignees.get(u.account.id);
        e?.splice(e.indexOf(i));
        this.assignees.set(u.account.id, e!)
    };
    check(id: string, i: ChatInstance) {
        let e = this.assignees.get(id);
        e?.concat(this.assignees.get("*")!);
        if(!e) return false;
        else if(!e.includes(i)) return false;
        return true;
    };
    async pipe(id: string, ws: ServerWebSocket<{ source: string }>, msg: string) { 
        let json = JSON.parse(msg);
        if(json.type == "wizard") {
            switch(json.method) {
                case "fetch": 
                    let chats = this.assignees.get(json.content) || new Array();
                    chats = chats.concat(this.assignees.get("*")!); chats.reverse(); chats = chats.filter(i => i != undefined);
                    chats = [...new Set(chats)];
                    ws.send(JSON.stringify({"type": "wizard", "method": "fetch", "content": {"ids": chats.map(i => i.id), "names": chats.map(i => i.display_name), "private": chats.map(i => this.assignees.get(json.content)?.includes(i) ? true : false)}}));
                    break;
                case "subscribe":
                    let chats_2 = this.assignees.get(json.content.account.id) || new Array();
                    chats_2 = chats_2.concat(this.assignees.get("*")!);
                    let chat = this.fromID(json.id);
                    if(!chat) { ws.send(JSON.stringify({"type": "wizard", "method": "subscribe", "content": "NO"})); return; }
                    if(!chats_2.includes(chat)) {
                        ws.send(JSON.stringify({"type": "wizard", "method": "subscribe", "content": "NO"}));
                        break;
                    }
                    
                    chat.registerUser(ws, json.content);
                    ws.send(JSON.stringify({"type": "wizard", "method": "subscribe", "content": "OK"}));
                    ws.send(JSON.stringify({"type": "wizard", "method": "data", "content": {"display_name_joinable": chat.display_name_joinable, "text_cooldown": chat.text_cooldown, "owner": chat.owner || "", "is_private": !this.check("*", chat)}}));
                    break;
                case "unsubscribe":
                    this.fromID(json.id)?.deregisterUser(ws);
                    ws.send(JSON.stringify({"type": "wizard", "method": "unsubscribe", "content": "OK"}));
                    break;

                case "change_cooldown": {
                    let chat = this.fromID(json.content.chat_id);
                    if(!chat) { ws.send(JSON.stringify({"type": "wizard", "method": "subscribe", "content": "NO"})); return; }
                    chat.modifyProperty("text_cooldown", json.content.cooldown);
                    chat.text_cooldown = json.content.cooldown;
                    ws.send(JSON.stringify({"type": "wizard", "method": "data", "content": {"display_name_joinable": chat.display_name_joinable, "text_cooldown": chat.text_cooldown, "owner": chat.owner || "", "is_private": !this.check("*", chat)}}));
                    ws.send(JSON.stringify({"type": "wizard", "method": "change_cooldown", "content": "OK"}));
                    break;
                }
                case "change_display_name_joining": {
                    let chat = this.fromID(json.content.chat_id);
                    if(!chat) { ws.send(JSON.stringify({"type": "wizard", "method": "subscribe", "content": "NO"})); return; }
                    chat.modifyProperty("display_name_joinable", json.content.value);
                    chat.display_name_joinable = json.content.value;
                    ws.send(JSON.stringify({"type": "wizard", "method": "data", "content": {"display_name_joinable": chat.display_name_joinable, "text_cooldown": chat.text_cooldown, "owner": chat.owner || "", "is_private": !this.check("*", chat)}}));
                    ws.send(JSON.stringify({"type": "wizard", "method": "change_display_name_joining", "content": "OK"}));
                    break;
                }
                case "create":
                    let new_chat = await this.create();
                    if(!new_chat) return; //ERROR out
                    await new_chat.modifyProperty("display_name", json.content);
                    new_chat.display_name = json.content;
                    await new_chat.modifyProperty("owner", json.user.account.id);
                    new_chat.owner = json.user.account.id;
                    if(!json.private) await this.assign(json.user.account.id, new_chat);
                    else await this.publicize(new_chat);
                    await this.revitalizeOldChats();
                    if(new_chat) ws.send(JSON.stringify({"type": "wizard", "method": "create", "content": "OK"}));
                    else ws.send(JSON.stringify({"type": "wizard", "method": "create", "content": "NO"}));
                    break;
                case "join": {
                    const display_name = json.content;
                    const is_id = display_name.slice(0, 2) == "c_";
                    const user_id = json.user.account.id;
                    let found_instances = this.instances.filter(i => i.display_name_joinable && (is_id ? i.id == display_name : i.display_name == display_name));
                    if(found_instances.length <= 0) {
                        ws.send(JSON.stringify({"type": "wizard", "method": "join", "content": "ni"}));
                        break;
                    }
                    if(found_instances.length > 1) {
                        ws.send(JSON.stringify({"type": "wizard", "method": "join", "content": "nl"}));
                        break;
                    }
                    const found_instance = found_instances[0]!;
                    this.assign(user_id, found_instance);
                    found_instance.send({
                        type: "message",
                        content: `${json.content} has joined using the name`,
                        timestamp: Date.now()
                    });
                    ws.send(JSON.stringify({"type": "wizard", "method": "join", "content": "OK"}));
                    break;
                }
                case "invite":
                    let req_id = await this.auth.fetchUserID(json.content);
                    if(!req_id) { ws.send(JSON.stringify({"type": "wizard", "method": "invite", "content": "NO"})); return; }
                    if(this.check(req_id, this.fromID(json.id)!) || this.check("*", this.fromID(json.id)!)) { ws.send(JSON.stringify({"type": "wizard", "method": "invite", "content": "ALR"})); return; }
                    if(this.fromID(json.id)!.immutable) { ws.send(JSON.stringify({"type": "wizard", "method": "invite", "content": "IMM"})); return; }
                    this.assign(req_id, this.fromID(json.id)!)
                    if(this.fromID(json.id)!.owner != json.user_id) {
                        ws.send(JSON.stringify({"type": "wizard", "method": "invite", "content": "NO"}));
                        return;
                    }
                    this.fromID(json.id)!.send({
                        type: "message",
                        content: `${json.content} has been added to the chat`,
                        timestamp: Date.now()
                    })
                    ws.send(JSON.stringify({"type": "wizard", "method": "invite", "content": "OK"}));
                    break;
                case "delete":
                    let e = this.fromID(json.content)!
                    if((e.owner || "") != json.user_id) {
                        ws.send(JSON.stringify({"type": "wizard", "method": "delete", "content": "NO"}));
                        return;
                    }
                    await this.destroy(e, json.id);
                    ws.send(JSON.stringify({"type": "wizard", "method": "delete", "content": "OK"}));
                    break;
                case "rename":
                    let a = this.fromID(json.id)!
                    if(a.owner != json.user_id) {
                        ws.send(JSON.stringify({"type": "wizard", "method": "rename", "content": "NO"}));
                        return;
                    }
                    await a.modifyProperty("display_name", json.content.slice(0, 15));
                    a.display_name = json.content;
                    ws.send(JSON.stringify({"type": "wizard", "method": "rename", "content": "OK"}));
                    break;
            };
        } else {
            this.fromID(json.id)?.handleRecieved(ws, json);
        }
    }

    broadcastToAllSync(msg: any) {
        this.viewers.forEach(v => {
            v.send(msg);
        })
        this.instances.forEach(i => {
            i.broadcast(msg);
        })
    }
    async broadcastToAll(msg: any) {
        this.viewers.forEach(v => {
            v.send(msg);
        })
        this.instances.forEach(async i => {
            await i.broadcast(msg);
        })
    }
    deregister(ws:  ServerWebSocket<{ source: string }>) 
    { this.instances.filter(i => i.users.keys().toArray().includes(ws)).forEach(i => { i.deregisterUser(ws); }) };
}

export class ChatInstance {
    protected db: Database;
    protected log: LogWizard = new LogWizard();
    protected w: ChatWizard;
    public id: string = `c_${generateRandomString(10)}`;
    public users: Map<ServerWebSocket<{ source: string }>, User> = new Map();
    public display_name: string = "";
    public immutable: boolean = false;
    public text_cooldown: number = 1000;
    public display_name_joinable: boolean = false;
    public owner: string = "";

    private queue: Array<message> = new Array();

    constructor(db: Database, id: (string | null) = null, w: ChatWizard) { this.db = db; if(id != null) id = id; this.w = w;}

    async init() {
        if(!await this.db.exists("chats"))  this.db.modify("chats", {});
        let chats = await this.db.fetch("chats")
        setInterval(async () => {if(this.queue.length > 0) await this.writeQueueToDB()}, 3000);
        if(!chats) return;
        if(chats[this.id] != undefined) { // inherited chat
            this.display_name = chats[this.id].display_name;
            this.immutable = chats[this.id].immutable;
            this.text_cooldown = chats[this.id].text_cooldown;
            this.display_name_joinable = chats[this.id].display_name_joinable;
            this.owner = chats[this.id].owner || "";
            // @ts-expect-error
            chats[this.id].assignees.forEach(a => {
                this.w.assign(a, this.w.fromID(this.id)!);
            });
            return; 
        } 
        chats[this.id] = {"history": [{
            type: "message",
            content: `this is the start of the chat: ${this.id}`,
            timestamp: Date.now()
        } as message], "assignees": [], "display_name": "", "timestamp": Date.now(), "immutable": this.immutable, "text_cooldown": this.text_cooldown};
        this.db.modify("chats", chats);
    }
    
    async flood() {
        for(let x = 0; x < 30; x++) {
            await this.send({
                type: "message",
                content: `${x}`,
                timestamp: Date.now()
            })
        }
    }

    async appendMessageToHistory(message: message) {
        this.queue.push(message);
    }

    async writeQueueToDB() {
        let data;
        try { data = await this.db.fetch("chats"); }
        catch { return; }
        this.queue.forEach(m => {
            data[this.id]["history"].push(m);
        });
        this.queue = new Array();
        this.db.modify("chats", data);
    }

    async modifyProperty(name: string, value: any) {
        let data;
        try { data = await this.db.fetch("chats"); }
        catch { return; }
        data[this.id][name] = value;
        this.db.modify("chats", data);
    }

    async fetchProperty(name: string) {
        let data;
        try { data = await this.db.fetch("chats"); }
        catch { return; }
        return data[this.id][name];
    }
      
    async fetchMessagesFromHistory(amt: number, con_msgs: (string | boolean), start_index?: number): Promise<message[] | undefined> {
        let data;
        try { data = await this.db.fetch("chats"); }
        catch { return; }
        let messages: Array<string> = data[this.id]["history"];
        con_msgs = (con_msgs === "true")
        // @ts-expect-error
        if(!con_msgs) messages = messages.filter(item => item.type !== "connection");
        if(start_index != undefined) {
            messages = messages.slice(0, -start_index);
        }
        if(amt != -1) messages = messages.slice(-amt);
        if(start_index != undefined) messages.reverse();
        let new_messages = new Array();
        for(let x = 0; x < messages.length; x++) {
          let parsed = messages[x]!;
          let new_message: message = {
            // @ts-expect-error
            type: parsed.type,
            // @ts-expect-error
            content: parsed.content,
            // @ts-expect-error
            timestamp: parsed.timestamp
          };
          new_messages.push(new_message);
        }
        return new_messages
    }

    async broadcast(...msgs: String[]) { msgs.forEach(msg => { this.users.keys().forEach((socket) => socket.send(msg)); }); }

    registerUser(ws: ServerWebSocket<{ source: string }>, user: User) {
        this.users.set(ws, user);
        setTimeout(() => this.send({
            type: "connection",
            content: `${user.settings.display_name} has connected`,
            timestamp: Date.now()
        }), 150);
        this.broadcast(JSON.stringify({"type": "system", "method": "chat_count", "content": `${this.users.size}`}));
    }

    deregisterUser(ws: ServerWebSocket<{ source: string }>) {
        let user = this.users.get(ws);
        this.users.delete(ws);
        if(user?.settings.display_name == undefined) return;
        this.send({
            type: "connection",
            content: `${user?.settings.display_name} has disconnected`,
            timestamp: Date.now()
        });
        this.broadcast(JSON.stringify({"type": "system", "method": "chat_count", "content": `${this.users.size}`}));
       return;
    }

    async send(msg: message) {
        this.appendMessageToHistory(msg);
        await this.broadcast(JSON.stringify({"type": "message", "content": msg.content}));
        this.log.log(`${msg.content}`, "CHAT")
    }

    async handleRecieved(ws: ServerWebSocket<{ source: string }>, json: any) {
        switch(json.type) {
            case "system":
                switch (json.method) {
                    case "update": 
                        this.users.set(ws, json.content.user); 
                        break;
                    case "history": 
                        let history = await this.fetchMessagesFromHistory(json.content, json.con_msgs, json.start_index);
                        ws.send(JSON.stringify({"type": "system", "method": "history", "content": history, "prepend": json.prepend}))
                        break;
                }
                break;
            case "message":
                await this.send({
                    type: "message",
                    content: json.content,
                    timestamp: Date.now()
                });
        }
    }
}