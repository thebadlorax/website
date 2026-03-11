/**
 * author thebadlorax
 * created on 24-02-2026-17h-11m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Database } from "./db";
import { LogWizard } from "./logging";
import { generateRandomString } from "./utils";
import { type User, JSONToUser } from "./auth"
import type { ServerWebSocket } from "bun";

type message = {
    type: string;
    content: string;
    timestamp: number;
}

// TODO: move prefix and color to serverside and request from clientside to disallow spoofing
// TODO: allow images or gifs hosted from website to be embedded
// TODO: show timestamps somehow (context menu?)

export class ChatWizard {
    protected instances: Array<ChatInstance> = new Array();
    protected subscriptions: Map<string, Array<ChatInstance>> = new Map();
    protected assignees: Map<string, Array<ChatInstance>> = new Map();
    protected db: Database;
    protected log: LogWizard = new LogWizard();
    constructor(db: Database) { this.db = db; this.log.log("Initalized", "CHATWIZARD"); };

    async create() { let n = new ChatInstance(this.db); this.instances.push(n); await n.init(); return n.id; };
    async createInheritance(id: string) { let n = new ChatInstance(this.db); n.id = id; this.instances.push(n); await n.init(); return n.id; }
    fromID(id: string) { return this.instances.filter(ins => ins.id == id).at(0); };
    destroy(i: ChatInstance) { if(this.instances.includes(i)) this.instances.splice(this.instances.indexOf(i)); };
    assign(u: User, i: ChatInstance) { 
        let e = this.assignees.get(u.account.id) || new Array();
        e.push(i);
        this.assignees.set(u.account.id, e);
    };
    publicize(i: ChatInstance) {
        let e = this.assignees.get("*") || new Array();
        e.push(i);
        this.assignees.set("*", e);
        return i;
    }
    deassign(u: User, i: ChatInstance) {
        if(this.assignees.get(u.account.id)?.includes(i)) return;
        let e = this.assignees.get(u.account.id);
        e?.splice(e.indexOf(i));
        this.assignees.set(u.account.id, e!)
    };
    check(u: User, i: ChatInstance) {
        let e = this.assignees.get(u.account.id);
        if(!e) return false;
        else if(!e.includes(i)) return false;
        return true;
    };
    async pipe(id: string, ws: ServerWebSocket<{ source: string }>, msg: string) { 
        let json = JSON.parse(msg);
        if(json.type == "wizard") {
            switch(json.method) {
                case "fetch": 
                    let chats = this.assignees.get(json.content) || new Array().concat(this.assignees.get("*")!);
                    ws.send(JSON.stringify({"type": "wizard", "method": "fetch", "content": {"ids": chats.map(i => i.id), "names": chats.map(i => i.display_name)}}));
                    break;
                case "subscribe":
                    this.fromID(json.id)?.registerUser(ws, json.content);
                    ws.send(JSON.stringify({"type": "wizard", "method": "subscribe", "content": "OK"}));
                    break;
                case "unsubscribe":
                    this.fromID(json.id)?.deregisterUser(ws);
                    ws.send(JSON.stringify({"type": "wizard", "method": "subscribe", "content": "OK"}));
                    break;
            }
        } else {
            this.fromID(json.id)?.handleRecieved(ws, json); 
        }
    }
    deregister(ws:  ServerWebSocket<{ source: string }>) { this.instances.filter(i => i.users.keys().toArray().includes(ws)).forEach(i => { i.deregisterUser(ws); })};
}

export class ChatInstance {
    protected db: Database;
    protected log: LogWizard = new LogWizard();
    public id: string = generateRandomString(10);
    public users: Map<ServerWebSocket<{ source: string }>, User> = new Map();
    public display_name: string = "";

    constructor(db: Database, id: (string | null) = null) { this.db = db; if(id != null) id = id;}

    async init() {
        if(!await this.db.exists("chats"))  await this.db.modify("chats", {});
        let chats = await this.db.fetch("chats")
        if(!chats) return;
        if(chats[this.id] != undefined) return; 
        chats[this.id] = {"history": [{
            type: "message",
            content: `this is the start of the chat: ${this.id}`,
            timestamp: Date.now()
        } as message] }
        await this.db.modify("chats", chats);
    }

    async appendMessageToHistory(message: message) {
        let data;
        try { data = await this.db.fetch("chats"); }
        catch { return; }
        data[this.id]["history"].push(message);
        await this.db.modify("chats", data);
    }
      
    async fetchMessagesFromHistory(amt: number, con_msgs: (string | boolean)) {
        let data;
        try { data = await this.db.fetch("chats"); }
        catch { return; }
        let messages: Array<string> = data[this.id]["history"];
        con_msgs = (con_msgs === "true")
        // @ts-expect-error
        if(!con_msgs) messages = messages.filter(item => item.type !== "connection")
        if(amt != -1) messages = messages.slice(-amt);
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
        this.send({
            type: "connection",
            content: `${user.settings.display_name} has connected`,
            timestamp: Date.now()
        });
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
        this.broadcast(`_SETCHATTERS=${this.users.size}`)
       return;
    }

    async send(msg: message) {
        this.appendMessageToHistory(msg);
        await this.broadcast(JSON.stringify({"type": "message", "content": msg.content}));
        this.log.log(`${msg.content}`)
    }

    async handleRecieved(ws: ServerWebSocket<{ source: string }>, json: any) {
        switch(json.type) {
            case "system":
                switch (json.method) {
                    case "update": this.users.set(ws, json.content.user); break;
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