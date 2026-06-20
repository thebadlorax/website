/**
 * author thebadlorax
 * created on 05-06-2026-13h-33m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { type User, AuthorizationWizard } from "./auth.ts";
import { Database } from "./db.ts"
import { LogWizard } from "./logging.ts"
import { generateRandomString } from "./utils.ts";
import type { ServerWebSocket } from "bun";

type Packet = {
    type: string,
    data: any
}; const decodePacket = (formatted: string) => {
    let a: any = atob(formatted);
    a = a.split(";");
    return {
        type: a[0],
        data: JSON.parse(a[1])
    } as Packet;
}; const encodePacket = (packet: Packet) => { return btoa(`${packet.type};${JSON.stringify(packet.data)}`); }

export class GameWizard {
    public static defaultGameData = {"player_data": {}, "analytics": {}}
    public static defaultPlayerData = {
        "inventory": { "items": [
            { "type": "card", "data": { "id": 2 } },
            { "type": "item", "data": { "id": 0 } },
            { "type": "money","data": { "amount": 100 } },
        ] },
        "deck": [0, 0, 1, 1, 2],
        "flags": {  
            "objects": {},
            "global": {}
        },
        "settings": null
    }

    protected singleplayerConnections: Map<ServerWebSocket<{ source: string }>, SingleplayerConnection> = new Map();
    protected db: Database;
    protected log: LogWizard = new LogWizard();
    protected id: string = generateRandomString(5);
    constructor(db: Database) { this.db = db; }

    async init() {}

    createSingleplayerConnection(ws: ServerWebSocket<{ source: string }>) {
        const s = new SingleplayerConnection(this.db, ws);
        this.singleplayerConnections.set(ws, s);
        return s;
    }

    onClose(ws: ServerWebSocket<{ source: string }>) {
        let c = this.singleplayerConnections.delete(ws);
        if(!c) this.log.error("ws not found when trying to delete", "GAMEWIZARD");
    }

    async onMessage(ws: ServerWebSocket<{ source: string }>, data: string) {
        let c = this.singleplayerConnections.get(ws);
        if(c == undefined) { this.log.error("websocket not found when routing ws message", "GAMEWIZARD"); return; }
        await c.handleMessage(data);
    }
}

export class SingleplayerConnection {
    protected db: Database;
    protected log: LogWizard = new LogWizard();
    protected id: string = generateRandomString(5);
    protected ws: ServerWebSocket<{ source: string }>;
    protected user: User | null = null;
    protected auth: AuthorizationWizard = new AuthorizationWizard(new Database("database.json"));

    constructor(db: Database, ws: ServerWebSocket<{ source: string }> ) {
        this.db = db; this.ws = ws;
    }

    send(packet: Packet) {
        this.ws.send(encodePacket(packet));
    }

    async handleMessage(str: string) {
        const packet = decodePacket(str);
        switch(packet.type) {
            case "register": {
                const u = await this.auth.fetchAccount(packet.data.name, packet.data.pass)
                if(u == undefined) {
                    this.send({
                        type: "register",
                        data: {
                            "status": "FAIL",
                            "reason": "INVALID CREDENTIALS"
                        }
                    })
                    break;
                };
                this.user = u;
                this.send({
                    type: "register",
                    data: {}
                } as Packet);
                break;
            }
            case "flag": {
                if(this.user == null) {
                    this.send({
                        type: "flag",
                        data: {
                            "status": "fail",
                            "reason": "invalid credentials"
                        }
                    } as Packet);
                    return;
                };
                const a = await this.db.fetch("game") ?? GameWizard.defaultGameData;
                let x = a.player_data[this.user.account.id] ?? GameWizard.defaultPlayerData;
                if(x.flags == undefined) x.flags = GameWizard.defaultPlayerData.flags
                switch(packet.data.operation) {
                    case "set": {
                        switch(packet.data.type) {
                            case "object": {
                                if(x.flags["objects"][packet.data.id] == undefined) x.flags["objects"][packet.data.id] = {};
                                x.flags["objects"][packet.data.id][packet.data.name] = packet.data.value; break;
                            }
                            default: {
                                x.flags[packet.data.type][packet.data.name] = packet.data.value; break;
                            }
                        }
                        a.player_data[this.user.account.id] = x;
                        this.db.modify("game", a);
                        this.send({
                            type: "flag",
                            data: {
                                "status": "success"
                            }
                        } as Packet);
                        break;
                    };
                    case "delete": {
                        delete x.flags[packet.data.type][packet.data.name];
                        a.player_data[this.user.account.id] = x;
                        this.db.modify("game", a);
                        this.send({
                            type: "flag",
                            data: {
                                "status": "success"
                            }
                        } as Packet);
                    };
                }
                break;
            }
            case "clearData": {
                if(this.user == null) {
                    this.send({
                        type: "clearData",
                        data: {
                            "status": "fail",
                            "reason": "invalid credentials"
                        }
                    } as Packet);
                    return;
                };

                switch(packet.data.operation) {
                    case "all": {
                        const a = await this.db.fetch("game") ?? GameWizard.defaultGameData;
                        delete a.player_data[this.user.account.id];
                        this.db.modify("game", a);
                        this.send({
                            type: "clearData",
                            data: {
                                "status": "success"
                            }
                        } as Packet);
                    }
                };
                break;
            }
            case "addItems": {
                if(this.user == null) {
                    this.send({
                        type: "addItems",
                        data: {
                            "status": "fail",
                            "reason": "invalid credentials"
                        }
                    } as Packet);
                    return;
                };

                const a = await this.db.fetch("game") ?? GameWizard.defaultGameData;
                let x = a.player_data[this.user.account.id] ?? GameWizard.defaultPlayerData;
                if(x.inventory.items == undefined) x.inventory.items = [];

                // @ts-expect-error
                packet.data.items.forEach(i => {
                    if(i.type == "money") {
                        // @ts-expect-error
                        const i2 = x.inventory.items.find(i => i.type == "money");
                        if(i2 == undefined) {
                            x.inventory.items.push(i);
                        } else {
                            i2.data.amount += i.data.amount;
                        }
                    } else {
                        x.inventory.items.push(i);
                    }
                })
                this.db.modify("game", a);
                this.send({
                    type: "addItem",
                    data: {
                        "status": "success"
                    }
                } as Packet);
                break;
            }
        }
    }
}