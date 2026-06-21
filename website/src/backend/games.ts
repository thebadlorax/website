/**
 * author thebadlorax
 * created on 24-02-2026-16h-51m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { range, generateRandomString, clamp, sumNumArray } from "./utils";
import { type User, JSONToUser, AuthorizationWizard } from "./auth";
import { type ServerWebSocket } from "bun";
import { LogWizard } from "./logging";
import { Database } from "./db";

const cardValues: Map<number, number> = new Map([
    [0, 11],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
    [10, 10],
    [11, 10],
    [12, 10],
    [13, 11],
    [14, 2],
    [15, 3],
    [16, 4],
    [17, 5],
    [18, 6],
    [19, 7],
    [20, 8],
    [21, 9],
    [22, 10],
    [23, 10],
    [24, 10],
    [25, 10],
    [26, 11],
    [27, 2],
    [28, 3],
    [29, 4],
    [30, 5],
    [31, 6],
    [32, 7],
    [33, 8],
    [34, 9],
    [35, 10],
    [36, 10],
    [37, 10],
    [38, 10],
    [39, 11],
    [40, 2],
    [41, 3],
    [42, 4],
    [43, 5],
    [44, 6],
    [45, 7],
    [46, 8],
    [47, 9],
    [48, 10],
    [49, 10],
    [50, 10],
    [51, 10],
]);

export class Deck {
    public cards: Array<number>;
    public id: string = generateRandomString(10)
    private log: LogWizard = new LogWizard();
    constructor() {
        this.cards = [...range(0, 52)];
        this.log.log(`Deck initalized with id ${this.id}`, "GAMES")
    }
  
    public draw() {
        if(this.cards.length == 0) {
          this.shuffle();
        };
        let card = this.cards[Math.floor(Math.random() * this.cards.length)];
        this.cards = this.cards.filter(num => num !== card); 
        return card;
    }
  
    public shuffle() {
        this.cards = [...range(0, 52)];
    }

    public static getCardValue(cardIndex: number) {
        return cardValues.get(cardIndex);
    }
}

class Packet {
    static fromFormatted(formatted: string) {
        try {
            let f = atob(formatted).split(Packet.seperator);
            return new Packet(
                f[0]!,
                JSON.parse(f[1]!)
            )
        } catch {
            new LogWizard().error("failure to decode packet", "PACKET", "DECODE")
        }
        
    }
    static seperator = ";"
    public type: string; public data: any;
    constructor(type: string, data: any) {
        this.type = type; this.data = data;
    }

    format() {
        return btoa(`${this.type}${Packet.seperator}${JSON.stringify(this.data)}`)
    }

    getResponse(status: number, data: any = {}) {
        return new Packet(this.type, {"status": status, "data": data});
    }
}

class UIEvent {
    static fromJSON(json: string) {
        let f = JSON.parse(json);
        return new UIEvent(
            f.type,
            f.data
        )
    }
    public type: string;
    public data: any;
    constructor(type: string, data: any) {
        this.type = type; this.data = data;
    }
}

class ClientUIElement {
    public type: string;
    public x: number;
    public y: number;
    public data: any;
    public id: string = `ui_${generateRandomString(5)}`;
    protected listeners: Map<string, Array<(event: UIEvent) => void>>
    constructor(type: string, x: number, y: number, data: any) {
        this.type = type;
        this.x = x; this.y = y;
        this.data = data;

        this.listeners = new Map();
    }

    addEventListener(type: string, fn: (event: UIEvent) => void) {
        if(!this.listeners.has(type)) this.listeners.set(type, new Array());
        this.listeners.get(type)?.push(fn);
    }

    handleEvent(type: string, event: UIEvent) {
        let e = this.listeners.get(type);
        if(!e) return;
        e.forEach(a => a(event))
    } 

    protected format() {
        return {
            "x": this.x,
            "y": this.y,
            "type": this.type,
            "data": this.data,
            "id": this.id,
            "listeners": this.listeners.keys().toArray()
        }
    }

    getCreationPacket() {
        return new Packet("createUI", this.format())
    }

    getDestructionPacket() {
        return new Packet("destroyUI", {"id": this.id})
    }

    getUpdatePacket() {
        return new Packet("updateUI", this.format())
    }
}

class GameInstance {
    public clients: Array<Client> = new Array();
    protected log: LogWizard = new LogWizard();
    public id: string = `gi_${generateRandomString(5)}`
    public type: string;
    public owner: Client;
    public markedForDestruction: boolean = false;
    public started: boolean = false;
    public can_join: boolean = true;
    constructor(type: string, owner: Client) {
        this.type = type; this.owner = owner;
    }

    async init() {}

    enrollClient(client: Client) { 
        this.clients.push(client);
        client.sendPacket(new Packet("instanceEnrollment", this.getInstanceInformation()))
        this.onClientEnrollment(client);
    }
    unenrollClient(client: Client) {
        if(!this.clients.includes(client)) {
            return;
        }
        this.clients.splice(this.clients.indexOf(client), 1);
        if(this.clients.length <= 0) this.markedForDestruction = true;
        if(this.owner.user.account.id == client.user.account.id) {
            if(this.clients.length > 0) {
                this.owner = this.clients[0]!;
            }
        }
        client.sendPacket(new Packet("instanceUnenrollment", {}))
        this.onClientUnenrollment(client);
    }

    sendTableUpdate() {
        this.broadcastPacket(new Packet("refreshTable", {
            "owner": this.owner.getFormatted(),
            "clients": this.clients.map(c => c.getFormatted())
        }))
    }

    onClientEnrollment(client: Client) {
        this.sendTableUpdate();
    }

    onClientUnenrollment(client: Client) {
        this.sendTableUpdate();
    };

    onClientUpdateUser(client: Client) {
        if(this.owner.user.account.id == client.user.account.id) {
            this.owner = client;
        }
        this.sendTableUpdate();
    }

    getInstanceInformation() {
        return {
            "id": this.id,
            "type": this.type,
            "owner": this.owner.getFormatted(),
            "clients": this.clients.map(c => c.getFormatted()),
            "started": this.started,
            "can_join": this.can_join
        }
    }

    broadcastPacket(packet: Packet) { this.clients.forEach(c => c.sendPacket(packet)) }

    startGame() {
        this.started = true;
        this.onStart();
    }

    onStart() {}
}

class BlackjackInstance extends GameInstance {
    constructor(owner: Client) {
        super("blackjack", owner);
    }

    override onClientEnrollment(client: Client) {
        super.onClientEnrollment(client);
    }

    override onStart() {
        this.clients.forEach(cl => {
            let c = new ClientUIElement("slider", 0.5, 0.5, {"label": "test"});
            c.addEventListener("change", e => {
                console.log(e.data.value)
            });
            cl.createUIElement(c)
        })
    }
}

class Client {
    public ws: ServerWebSocket<{ source: string; }>;
    public user: User;
    public UIElements: Array<ClientUIElement> = new Array();
    public instance: GameInstance | null = null;
    protected auth: AuthorizationWizard = new AuthorizationWizard(new Database(Database.defaultPath));
    protected log: LogWizard = new LogWizard();

    constructor(ws: ServerWebSocket<{ source: string; }>, user: User) {
        this.ws = ws;
        this.user = user;
    }

    sendPacket(packet: Packet) { this.ws.send(packet.format()) }

    updateUser(n: User) { 
        this.user = n;
        if(this.instance != undefined) this.instance.onClientUpdateUser(this);
    }

    createUIElement(ele: ClientUIElement) {
        this.UIElements.push(ele);
        this.sendPacket(ele.getCreationPacket());
    }
    destroyUIElement(ele: ClientUIElement) { 
        if(!this.UIElements.includes(ele)) {
            this.log.error("trying to delete ui element that doesn't exist on client", "GAMECLIENT")
            return;
        }
        this.UIElements.splice(this.UIElements.indexOf(ele), 1);
        this.sendPacket(ele.getDestructionPacket());
    }
    updateUIElement(ele: ClientUIElement) { this.sendPacket(ele.getUpdatePacket()) }

    enroll(instance: GameInstance) {
        this.instance = instance;
        instance.enrollClient(this);
    }
    unenroll() {
        if(!this.instance) return;
        this.instance.unenrollClient(this);
    }

    getFormatted() {
        return {
            "name": this.user.settings.display_name,
            "id": this.user.account.id,
            "color": this.user.settings.color
        }
    }

    async modifyPoints(delta: number) {
        await this.auth.changePoints(this.user.account.name, this.user.account.pass, delta);
        let n = await this.auth.fetchAccount(this.user.account.name, this.user.account.pass);
        if(!n) {
            this.log.error("error changing points", "GAMECLIENT");
            return;
        }
        this.updateUser(n);
        this.sendPacket(new Packet("forceUserUpdate", {}));
    }
}

export class CasinoWizard {
    public instances: Array<GameInstance> = new Array();
    public allClients: Array<Client> = new Array();
    protected auth: AuthorizationWizard = new AuthorizationWizard(new Database(Database.defaultPath));
    protected log: LogWizard = new LogWizard();
    constructor() {}

    appendNewClient(client: Client) {
        this.allClients.push(client);
    }

    createInstance(type: string, owner: Client): GameInstance | null {
        let n;
        switch(type) {
            case "blackjack": {
                n = new BlackjackInstance(owner)
                break;
            }
        }
        if(!n) return null;
        this.instances.push(n);
        this.onInstancesChange();
        return n;
    }
    destroyInstance(inst: GameInstance) {
        if(!this.instances.includes(inst)) return;
        this.instances.splice(this.instances.indexOf(inst), 1);
        this.onInstancesChange();
    }

    onInstancesChange() {
        this.broadcast(new Packet("fetchInstances", {"data": {"instances": this.instances.map(i => i.getInstanceInformation())}})); // extra data bc usually comes from getResponse
    }

    removeFromCurrentInstance(client: Client) {
        if(!client.instance) return;
        const inst = client.instance;
        inst.unenrollClient(client);
        if(inst.markedForDestruction) { this.destroyInstance(inst) }
        this.broadcast(new Packet("fetchInstances", {"data": {"instances": this.instances.map(i => i.getInstanceInformation())}}))
    }

    handleConnection(ws: ServerWebSocket<{ source: string; }>, user: User) { this.allClients.push(new Client(ws, user)) }
    handleDisconnect(ws: ServerWebSocket<{ source: string; }>) {
        const client = this.allClients.find(c => c.ws == ws);
        if(!client) return;

        this.allClients.splice(this.allClients.indexOf(client), 1);
        if(client.instance != null) {
            this.removeFromCurrentInstance(client);
        }
    }
    async handleMessage(ws: ServerWebSocket<{ source: string; }>, msg: any) {
        const packet = Packet.fromFormatted(msg);
        if(!packet) return;

        if(packet.type == "initauth") {
            let u = await this.auth.fetchAccount(packet.data.name, packet.data.pass);
            if(!u) return;
            let c = new Client(ws, u);
            this.appendNewClient(c);
            c.sendPacket(packet.getResponse(200))
            return;
        }

        const client = this.allClients.find(c => c.ws == ws);
        if(!client) return;

        switch(packet.type) {
            case "createInstance": {
                const new_instance = this.createInstance(packet.data.type, client);
                if(new_instance == null) {
                    client.sendPacket(packet.getResponse(400));
                    break;
                }
                client.sendPacket(packet.getResponse(200));
                client.enroll(new_instance);
                break;
            }
            case "joinInstance": {
                const inst = this.instances.find(i => i.id == packet.data.id);
                if(!inst) {
                    client.sendPacket(packet.getResponse(400, {"reason": "invalid id"}))
                    break;
                }
                client.sendPacket(packet.getResponse(200));
                client.enroll(inst);
                break;
            }
            case "fetchInstances": {
                client.sendPacket(packet.getResponse(200, {"instances": this.instances.map(i => i.getInstanceInformation())}));
                break;
            }
            case "getTableInformation": {
                const inst = this.instances.find(i => i.id == packet.data.id);
                if(!inst) {
                    client.sendPacket(packet.getResponse(400, {"reason": "invalid id"}))
                    break;
                }
                client.sendPacket(packet.getResponse(200, {"information": inst.getInstanceInformation()}))
                break;
            }
            case "leaveInstance": {
                client.sendPacket(packet.getResponse(200));
                this.removeFromCurrentInstance(client);
                break;
            }

            case "startGame": {
                if(client.instance == null) {
                    client.sendPacket(packet.getResponse(400));
                    break;
                }
                if(client.instance.owner.user.account.id != client.user.account.id) {
                    client.sendPacket(packet.getResponse(400, "you are not the owner of your instance"));
                    break;
                }
                client.sendPacket(packet.getResponse(200));
                client.instance.startGame();
                break;
            }

            case "updateUser": {
                if(packet.data.new_user == undefined) {
                    client.sendPacket(packet.getResponse(400, {"reason": "no new user"}))
                    break;
                }
                client.sendPacket(packet.getResponse(200));
                client.user = packet.data.new_user;
                if(client.instance != undefined) {
                    client.instance.onClientUpdateUser(client);
                    if(client.user.account.id == client.instance.owner.user.account.id) {
                        this.broadcast(new Packet("fetchInstances", {"data": {"instances": this.instances.map(i => i.getInstanceInformation())}}))
                    }
                }
                break;
            }

            case "UIInteraction": {
                let ele = client.UIElements.find(ele => ele.id == packet.data.id);
                if(!ele) {
                    client.sendPacket(packet.getResponse(400, {"reason": "no element found"}))
                    break;
                }
                ele.handleEvent(packet.data.type, new UIEvent(packet.data.type, packet.data.eventData ?? {}))
                break;
            }
        }
    }

    broadcast(packet: Packet) { this.allClients.forEach(c => c.sendPacket(packet)) }
}