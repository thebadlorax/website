/**
 * author thebadlorax
 * created on 25-03-2026-17h-02m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { AuthorizationWizard, type User } from "./auth";
import { Database } from "./db";
import { LogWizard } from "./logging";
import { clamp, generateRandomString } from "./utils";
import { resolve, type ServerWebSocket } from "bun";

type GamePlayer = {
    instance: GameInstance;
    user: User;
    name: string;
    x: number;
    y: number;
    w_x: number;
    w_y: number;
    color: string;
}

class GameObject {
    public src = "";
    public name = "";
    public x = 0;
    public y = 0;
    public w_x = 0;
    public w_y = 0;
    public scale = 1;

    constructor(name: string, src: string) { this.name = name; this.src = src; }

    asSendable() {
        return {
            "name": this.name,
            "x": this.x,
            "y": this.y,
            "scale": this.scale
        }
    }
}

class GameInstance {
    public objects: Array<GameObject> = new Array();
    public id = `g_${generateRandomString(10)}`;

    constructor() { }

    asSendable() {
        let s = {
            "type": "state",
            "method": "update",
            "content": {"objects": []}
        };
        this.objects.forEach(o => {
            // @ts-expect-error
            s.content.objects.push(o.asSendable());
        });
        return s;
    };
}

export class GameWizard {
    private instances: Array<GameInstance> = new Array();
    private players: Map<ServerWebSocket<{ source: string }>, GamePlayer> = new Map();
    private queue: Map<ServerWebSocket<{ source: string }>, Array<any>> = new Map();
    private db: Database;
    private auth: AuthorizationWizard;
    private log: LogWizard = new LogWizard();
    private fps = 60;

    constructor(db: Database) {
        this.db = db;
        this.auth = new AuthorizationWizard(db);
        setInterval(() => { this.instances.forEach(i => this.sendState(i)); }, (1000/this.fps));
    };
    
    setBackground(ws: ServerWebSocket<{ source: string }>, x: number, y: number) {
        this.queueMessage(ws, {"type": "rendering", "method": "background", "content": {"src": `../res/game/bg/${x}${y}.png`}})
    }

    createObject(instance: GameInstance, name: string, src: string, w_x: number, w_y: number, x?: number, y?: number, scale?: number) {
        let o = new GameObject(name, src);
        if(x) o.x = x; if(y) o.y = y;
        o.w_x = w_x; o.w_y = w_y;
        if(scale) o.scale = scale;
        instance.objects.push(o);
        this.queueInstance(instance, {"type": "object", "method": "create", "content": {"name": name, "src": src}});
    }

    queueInstance(instance: GameInstance, json: any) {
        let players = Array.from(this.players).filter(([k, v]) => v.instance == instance);
        players.forEach(p => {
            this.queueMessage(p[0], json);
        });
    }

    findInstance() {
        if(this.instances.length == 0) {
            let ni = new GameInstance();
            this.instances.push(ni);
            this.createObject(ni, "meowl", "../res/meowl_cursor.png", 0, 0, 200, 300);
            this.createObject(ni, "sun", "../res/sun.png", 0, 0, 580, -50, .1);
        };
        let player_counts = this.instances.map(i => [i, this.getPlayerCount(i)]).sort();
        let lowest = player_counts[0];
        if(lowest) return lowest[0];
        else return undefined;
    }

    fromID(id: string) {
        let i = Array.from(this.players).filter(([k, v]) => v.instance.id == id)[0];
        if(i) return i;
        else return undefined;
    }

    handleConnection(ws: ServerWebSocket<{ source: string }>, u: User) {
        let best_instance = this.findInstance();
        if(!best_instance) return;
        // @ts-expect-error
        this.registerPlayer(ws, best_instance, u);
    }

    queueMessage(ws: ServerWebSocket<{ source: string }>, json: any) {
        let exisiting = this.queue.get(ws) || new Array();
        exisiting.push(json);
        this.queue.set(ws, exisiting);
    }

    registerPlayer(ws: ServerWebSocket<{ source: string }>, i: GameInstance, u: User) {
        let p = {
            instance: i,
            user: u,
            x: 0,
            y: 0,
            w_x: 0,
            w_y: 0,
            name: u.settings.display_name,
            color: u.settings.color
        } as GamePlayer;
        this.players.set(ws, p);
        i.objects.forEach(o => {
            this.queueInstance(i, {"type": "object", "method": "create", "content": {"name": o.name, "src": o.src}});
        })
        this.setBackground(ws, p.w_x, p.w_y);
        this.queueMessage(ws, {"type": "rendering", "method": "unhide"});
    }

    async handleMessage(ws: ServerWebSocket<{ source: string }>, json: any) {
        let p = this.players.get(ws)!;
        json = JSON.parse(json);
        switch(json.type) {
            case "state":
                switch(json.method) {
                    case "update":
                        let keys = Object.keys(json.content.keys);
                        let dv = [0, 0]; let speed_mult = 3; // TODO: make the server and client agree w speed
                        if(keys.includes("KeyW") || keys.includes("ArrowUp"   )) dv[1]! -= 1;
                        if(keys.includes("KeyA") || keys.includes("ArrowLeft" )) dv[0]! -= 1;
                        if(keys.includes("KeyS") || keys.includes("ArrowDown" )) dv[1]! += 1;
                        if(keys.includes("KeyD") || keys.includes("ArrowRight")) dv[0]! += 1;
                        p.x += dv[0]! * speed_mult; p.y += dv[1]! * speed_mult;
                        p.x = clamp(p.x, 0, 725);
                        if(p.y > 775) { 
                            p.w_y -= 1;
                            p.y = -49;
                            this.setBackground(ws, p.w_x, p.w_y)
                        } else if(p.y < -50) {
                            p.w_y += 1;
                            p.y = 774;
                            this.setBackground(ws, p.w_x, p.w_y)
                        }
                        break;
                } break;
            case "system":
                switch(json.method) {
                    case "auth":
                        let user;
                        try { user = await this.auth.fetchAccount(json.content.account.name, json.content.account.pass); }
                        catch { ws.send(JSON.stringify({"type": "system", "method": "auth", "content": "NO"})); return; }
                        if(!user) { ws.send(JSON.stringify({"type": "system", "method": "auth", "content": "NO"})); return; }
                        this.handleConnection(ws, user);
                };
        }
    }

    deregisterPlayer(ws: ServerWebSocket<{ source: string }>) {
        this.players.delete(ws);
    };

    getPlayerCount(i: GameInstance) {
        let players = Array.from(this.players).filter(([k, v]) => v.instance == i);
        return players.length;
    };

    playerAsSendable(p: GamePlayer) {
        return {
            "name": p.name,
            "x": p.x,
            "y": p.y,
            "w_x": p.w_x,
            "w_y": p.w_y,
            "id": p.user.account.id
        }
    }

    sendState(instance: GameInstance) {
        let state = instance.asSendable();
        let players = Array.from(this.players).filter(([k, v]) => v.instance == instance);
        players.forEach(p => {
            let queue = this.queue.get(p[0]);
            if(queue) {
                queue.forEach(json => {
                    p[0].send(JSON.stringify(json));
                });
                this.queue.delete(p[0]);
            };
            state.content = { ...state.content, 
                ...{"you": this.playerAsSendable(this.players.get(p[0])!), 
                    "info": {"player-count": this.getPlayerCount(instance), "instance-id": instance.id, "timestamp": Date.now()},
                    "players": []}}
            Array.from(this.players).filter(([k, v]) => k != p[0] && v.w_x == p[1].w_x && v.w_y == p[1].w_y).forEach(p2 => {
                // @ts-expect-error
                state.content.players.push(this.playerAsSendable(p2[1]));
            });
            p[0].send(JSON.stringify(state));
        });
    }
}