/**
 * author thebadlorax
 * created on 25-03-2026-17h-02m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { AuthorizationWizard, type User } from "./auth";
import { Database } from "./db";
import { clamp, generateRandomString, getImageSize } from "./utils";
import { type ServerWebSocket } from "bun";

const FPS = 60;

const RECT_INTERSECTION = (x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, h2: number, w2: number): boolean => {
    return !(
        x1 + w1 < x2 || 
        y1 + h1 < y2 || 
        x1 > x2 + w2 || 
        y1 > y2 + w2
    );
};

export class GamePlayer {
    public instance: GameInstance;
    public user: User;
    public name: string;
    public x: number = 0;
    public y: number = 0;
    public tile_id: string;
    public width: number = 75;
    public height: number = 75;
    public data: any = {};
    public client_data: any = {};
    public last_frame_client_data: any = {};
    public server_data: any = {};
    public keysDown: Array<string> = new Array();
    public ws: ServerWebSocket<{ source: string }>;
    public game: GameWizard;

    constructor(instance: GameInstance, wiz: GameWizard, user: User, name: string, tile_id: string, ws: ServerWebSocket<{ source: string }>) {
        this.instance = instance; this.user = user; this.name = name; this.tile_id = tile_id; this.ws = ws; this.game = wiz;
    }

    intersects(other: GameObject): boolean | undefined;
    intersects(other: GameTrigger): boolean | undefined;
    intersects(other: any) {
        if(other.width == undefined || other.height == undefined) return undefined;
        return !(
            other.x + other.width < this.x || 
            other.y + other.height < this.y || 
            other.x > this.x + this.width || 
            other.y > this.y + this.height
        )
    }

    serialize() {
        return {
            "x": this.x,
            "y": this.y,
            "tile_id": this.tile_id,
            "data": this.data
        }
    }

    asSendable() {
        return {
            "name": this.name,
            "x": this.x,
            "y": this.y,
            "tile_id": this.tile_id,
            "id": this.user.account.id,
            "data": this.data
        }
    }
}

class GameObject {
    public src = "";
    public name = "";
    public x = 0;
    public y = 0;
    public tile_id: string;
    public scale = 1;
    public width: number | undefined = undefined;
    public height: number | undefined = undefined;

    constructor(name: string, src: string, tile_id: string) { 
        this.name = name; this.src = src; this.tile_id = tile_id; 
        getImageSize(src.replace("../", "src/")).then(i => {
            this.height = i.height*this.scale; this.width = i.width*this.scale;
        }); 
    }

    intersects(other: GameObject) {
        if(this.width == undefined || this.height == undefined
            || other.width == undefined || other.height == undefined) return undefined;
        return !(
            this.x + this.width < other.x || 
            this.y + this.height < other.y || 
            this.x > other.x + other.width || 
            this.y > other.y + other.height
        )
    }

    asSendable() {
        return {
            "name": this.name,
            "x": this.x,
            "y": this.y,
            "tile_id": this.tile_id,
            "scale": this.scale,
            "src": this.src
        }
    }
}

export class GameTrigger {
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    public tile_id: string;
    public onEnter: any = (t: GameTrigger, p: GamePlayer) => {};
    public onExit: any = (t: GameTrigger, p: GamePlayer) => {};
    public onTick: any = (t: GameTrigger, p: GamePlayer) => {};
    public onClick: any = (t: GameTrigger, p: GamePlayer) => {};
    public onEnterString: string = "";
    public onExitString: string = "";
    public onTickString: string = "";
    public onClickString: string = "";
    public data: any = {};
    public tag: string = "";
    public instance: GameInstance;
    public active: boolean = true;
    public players = new Array();
    public id: string;
    public game: GameWizard;

    constructor(instance: GameInstance, game: GameWizard, x: number, y: number, w: number, h: number, tile_id: string) {
        this.instance = instance;
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.tile_id = tile_id;
        this.game = game;
        this.id = generateRandomString(5);
    }

    asSendable() {
        return {
            "x": this.x,
            "y": this.y,
            "w": this.width,
            "h": this.height,
            "tile_id": this.tile_id,
            "tag": this.tag,
            "data": this.data,
            "id": this.id,
            "functions": {
                "enter": this.onEnterString,
                "exit": this.onExitString,
                "tick": this.onTickString,
                "click": this.onClickString
            }
        }
    }
}

export class Tile {
    public objects: Array<GameObject> = new Array();
    public triggers: Array<GameTrigger> = new Array();
    public changes: Array<GameTrigger | GameObject> = new Array();
    public id: string;
    public start_x: number = 400;
    public start_y: number = 400;

    constructor(id: string) { this.id = id; }

    asSendable() {
        let s = {
            "objects": [...this.objects.filter(o => this.changes.includes(o)).map(o => o.asSendable())],
            "triggers": [...this.triggers.filter(t => this.changes.includes(t)).map(t => t.asSendable())]
        };
        this.changes = new Array();
        return s;
    };
}

class GameInstance {
    public id = `g_${generateRandomString(10)}`;
    public tiles: Array<Tile> = new Array();
    public game: GameWizard;

    constructor(g: GameWizard) { this.game = g; };

    getTile(id: string): Tile | undefined {
        let tile = this.tiles.find(t => t.id == id);
        return tile;
    }
}

export class Module {
    public game: GameWizard;
    public trigger_functions: any = {};

    constructor(g: GameWizard) { 
        this.game = g; 
    }

    onPlayerUpdate(p: GamePlayer) {}
    onPlayerRegistration(p: GamePlayer) {}
    middlemanSaveData(p: GamePlayer, d: any): any {}
    middlemanInstancePropogation(t: Tile, d: any) {}
    middlemanStateSending(p: GamePlayer) {}
    handleWSInput(ws: ServerWebSocket<{ source: string }>, p: GamePlayer, d: any) {}

    init() {
        this.game.onPlayerUpdate.push(this.onPlayerUpdate);
        this.game.onPlayerRegistration.push(this.onPlayerRegistration);
        this.game.middlemanSaveData.push(this.middlemanSaveData);
        this.game.middlemanInstancePropogation.push(this.middlemanInstancePropogation);
        this.game.middlemanStateSending.push(this.middlemanStateSending);
    };
}

export class GameWizard {
    private instances: Array<GameInstance> = new Array();
    public players: Map<ServerWebSocket<{ source: string }>, GamePlayer> = new Map();
    private queue: Map<ServerWebSocket<{ source: string }>, Array<any>> = new Map();
    private db: Database;
    private auth: AuthorizationWizard;
    private fps = 60;

    //public onUpdate: Array<any> = new Array();
    public onPlayerUpdate: Array<any> = new Array();
    public onPlayerRegistration: Array<any> = new Array();
    public middlemanSaveData: Array<any> = new Array();
    public middlemanInstancePropogation: Array<any> = new Array();
    public middlemanStateSending: Array<any> = new Array();
    public TRIGGER_FUNCTIONS = {
        "": (t: GameTrigger, p: GamePlayer) => {},
        "portalEnter": (t: GameTrigger, p: GamePlayer) => { p.data.wallPhasing = true; p.data.nextTile = t.data.target;},
        "portalExit": (t: GameTrigger, p: GamePlayer) => { p.data.wallPhasing = false; p.data.nextTile = undefined; },
        "test": (t: GameTrigger, p: GamePlayer) => { console.log("test"); },
        "goToHell": (p: GamePlayer) => { p.game.changePlayerTile(p.ws, "hell"); }
    }
    public wsInteractions = {};

    constructor(db: Database) {
        this.db = db;
        this.auth = new AuthorizationWizard(db);
        setInterval(() => { this.instances.forEach(i => this.sendState(i)); }, (1000/this.fps));
    };

    setBackground(ws: ServerWebSocket<{ source: string }>, tile_id: string) {
        this.queueMessage(ws, {"type": "rendering", "method": "background", "content": {"src": `../res/game/bg/${tile_id}.png`}})
    }

    async init() {
        let game = await this.db.fetch("game");
        if(!game) {
            await this.db.modify("game", {"player_data": {}})
        }
    }

    createObject(instance: GameInstance, name: string, src: string, id: string, x?: number, y?: number, scale?: number) {
        src = `../res/game/${src}`;
        let o = new GameObject(name, src, id);
        if(x) o.x = x; if(y) o.y = y;
        if(scale) o.scale = scale;
        let tile = instance.getTile(id);
        if(!tile) return;
        tile.objects.push(o);
        this.queueInstance(instance, {
            "type": "object",
            "method": "create",
            "content": o.asSendable()
        });
        tile.changes.push(o);
        return o;
    }

    modifyObject(instance: GameInstance, tile_id: string, name: string, new_obj: GameObject) {
        let t = instance.getTile(tile_id);
        if(!t) return;
        let old = t.objects.find(o => o.name == name);
        if(!old) return;
        t.objects.splice(t.objects.indexOf(old), 1);
        t.objects.push(new_obj);
        t.changes.push(new_obj);
        return new_obj;
    }

    createTrigger(instance: GameInstance, x: number, y: number, w: number, h: number, tile_id: string) {
        let t = new GameTrigger(instance, this, x ,y, w, h, tile_id);
        let tile = instance.getTile(tile_id);
        if(!tile) return;
        tile.triggers.push(t);
        this.queueInstance(instance, {
            "type": "trigger",
            "method": "create",
            "content": t.asSendable()
        });
        tile.changes.push(t);
        return t;
    }

    queueInstance(instance: GameInstance, json: any) {
        let players = Array.from(this.players).filter(([k, v]) => v.instance == instance);
        players.forEach(p => {
            this.queueMessage(p[0], json);
        });
    }

    async propogateInstance(inst: GameInstance) {
        const file = Bun.file("src/res/game/data.json");
        let json = await file.json();
        let data = json.tile_data;
        let all_tiles = Object.keys(data);
        all_tiles.forEach(async t => {
            let tile = data[t];
            let objects = tile.objects || {};
            let triggers = tile.triggers || [];

            let tile_obj = new Tile(t);
            tile_obj.start_x = tile.start_x || 400;
            tile_obj.start_y = tile.start_y || 400;

            this.middlemanInstancePropogation.forEach(m => { m(tile_obj, data); })
            inst.tiles.push(tile_obj);
            
            if(triggers) {
                // @ts-expect-error
                triggers.forEach(tr => {
                    let trig = tr;
                    let obj = this.createTrigger(inst, trig.x, trig.y, trig.w, trig.h, t);
                    if(!obj) return
                    obj.data = trig.data || {};
                    let f = trig.functions || {};
                    obj.onEnterString = f.onEnter || "";
                    obj.onExitString = f.onExit || "";
                    obj.onTickString = f.onTick || "";
                    obj.onClickString = f.onClick || "";
                    // @ts-expect-error
                    obj.onEnter = this.TRIGGER_FUNCTIONS[f.onEnter || ""] || this.TRIGGER_FUNCTIONS[""];
                    // @ts-expect-error
                    obj.onExit = this.TRIGGER_FUNCTIONS[f.onExit || ""] || this.TRIGGER_FUNCTIONS[""];
                    // @ts-expect-error
                    obj.onTick = this.TRIGGER_FUNCTIONS[f.onTick || ""] || this.TRIGGER_FUNCTIONS[""];
                    // @ts-expect-error
                    obj.onClick = this.TRIGGER_FUNCTIONS[f.onClick || ""] || this.TRIGGER_FUNCTIONS[""];
                    obj.tag == trig.tag || "";
                });
            };
            if(objects) {
                let all_objects = Object.keys(objects);
                all_objects.forEach(o => {
                    let obj = objects[o];
                    let ob = this.createObject(inst, o, obj.src, t, obj.x, obj.y, obj.scale || 1);
                    if(!ob) return;
                })
            };
        })
    }

    async createInstance() {
        let ni = new GameInstance(this);
        await this.propogateInstance(ni);
        this.instances.push(ni);
    }

    async findInstance() {
        if(this.instances.length == 0) {
            await this.createInstance();
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
        this.findInstance().then(i => {
            if(!i) return;
            // @ts-expect-error
            this.registerPlayer(ws, i, u);
        });
    }

    queueMessage(ws: ServerWebSocket<{ source: string }>, json: any) {
        let exisiting = this.queue.get(ws) || new Array();
        exisiting.push(json);
        this.queue.set(ws, exisiting);
    }

    registerPlayer(ws: ServerWebSocket<{ source: string }>, i: GameInstance, u: User) {
        let p = new GamePlayer(
            i,
            this,
            u,
            u.account.id,
            "start",
            ws
        )
        this.db.fetch("game").then(d => {
            let pd = d.player_data[u.account.id];
            if(!pd) return;
            p.tile_id = pd.tile_id;
            p.x = pd.x; p.y = pd.y;
            this.setBackground(ws, p.tile_id);
        });
        this.players.set(ws, p);
        let tile = i.getTile(p.tile_id);
        if(!tile) return;
        let all_objects: Array<GameObject> = [];
        i.tiles.forEach(t => { t.objects.forEach(o => all_objects.push(o)); })
        let all_triggers: Array<GameTrigger> = [];
        i.tiles.forEach(t => { t.triggers.forEach(o => all_triggers.push(o)); })
        all_objects.forEach(o => {
            this.queueInstance(i, 
                {
                    "type": "object",
                    "method": "create",
                    "content": o.asSendable()
                }
            );
        });
        all_triggers.forEach(t => {
            this.queueInstance(i, 
                {
                    "type": "trigger",
                    "method": "create",
                    "content": t.asSendable()
                }
            );
        });
        this.setBackground(ws, p.tile_id);
        this.queueMessage(ws, {"type": "rendering", "method": "unhide"});
        this.onPlayerRegistration.forEach(m => { m(); });
    }

    changePlayerTile(ws: ServerWebSocket<{ source: string }>, tile_id: string) {
        let p = this.players.get(ws);
        if(!p) return;
        p.tile_id = tile_id;
        this.setBackground(ws, tile_id);
        this.handleTriggers(p);
    }

    handleTriggers(p: GamePlayer) {
        let tile = p.instance.getTile(p.tile_id);
        if(!tile) return;
        tile.triggers.forEach(t => {
            let was_in = t.players.includes(p);
            t.players.splice(t.players.indexOf(p), 1);
            if(p.intersects(t)) t.players.push(p);
            let entered = !was_in && t.players.includes(p);
            if(was_in && !t.players.includes(p)) { t.onExit(t, p); }
            if(entered) t.onEnter(t, p);
        });
    }

    updatePlayer(p: GamePlayer) {
        let ws = p.ws;
        let keys = p.keysDown;
        let dv = [0, 0]; let speed_mult = 3;
        let tile = p.instance.getTile(p.tile_id);
        if(!tile) return;
        this.handleTriggers(p);
        if(p.client_data.speech_line_function) {
            if(p.last_frame_client_data.speech_line_function != p.client_data.speech_line_function) {
                // @ts-expect-error
                if(this.TRIGGER_FUNCTIONS[p.client_data.speech_line_function] != undefined) {
                    // @ts-expect-error
                    this.TRIGGER_FUNCTIONS[p.client_data.speech_line_function](p);
                }
            }
        };
        if(keys.includes("KeyW") || keys.includes("ArrowUp"   )) dv[1]! -= 1;
        if(keys.includes("KeyA") || keys.includes("ArrowLeft" )) dv[0]! -= 1;
        if(keys.includes("KeyS") || keys.includes("ArrowDown" )) dv[1]! += 1;
        if(keys.includes("KeyD") || keys.includes("ArrowRight")) dv[0]! += 1;
        let old_x = p.x;
        let old_y = p.y;
        // @ts-expect-error
        let new_x = old_x + dv[0] * speed_mult;
        // @ts-expect-error
        let new_y = old_y + dv[1] * speed_mult;
        let collidesX = false;
        let collidesY = false;

        tile.objects.forEach(o => {
            p.x = new_x; p.y = old_y;
            if (p.intersects(o)) collidesX = true;
            p.x = old_x; p.y = new_y;
            if (p.intersects(o)) collidesY = true;
        });

        p.x = collidesX ? old_x : new_x;
        p.y = collidesY ? old_y : new_y;
        
        p.y = clamp(p.y, p.data.wallPhasing ? -1000 : 0, p.data.wallPhasing ? 1000 : 725);
        p.x = clamp(p.x, p.data.wallPhasing ? -1000 : 0, p.data.wallPhasing ? 1000 : 725);
        if(p.y > 775) { 
            this.changePlayerTile(ws, p.data.nextTile);
            p.y = -49;
        } else if(p.y < -50) {
            this.changePlayerTile(ws, p.data.nextTile);
            p.y = 774;
        } else if(p.x > 775) {
            this.changePlayerTile(ws, p.data.nextTile);
            p.x = -49;
        } else if(p.x < -50) {
            this.changePlayerTile(ws, p.data.nextTile);
            p.x = 774
        }
        this.handleTriggers(p);
        this.onPlayerUpdate.forEach(m => {
            m(p);
        });
        p.keysDown = [];
    }

    async handleMessage(ws: ServerWebSocket<{ source: string }>, json: any) {
        let p = this.players.get(ws);
        json = JSON.parse(json);
        switch(json.type) {
            case "state":
                if(!p) return;
                switch(json.method) {
                    case "update": p.keysDown = json.content.keys; p.last_frame_client_data = p.client_data; if(json.content.extra_data != undefined) p.client_data = json.content.extra_data; break;
                } break;
            case "input":
                if(!p) return;
                switch(json.method) {
                    case "click": 
                        p.instance.getTile(p.tile_id)?.triggers.forEach(t => {
                            if(RECT_INTERSECTION(t.x, t.y, t.width, t.height, json.content.x-15, json.content.y-15, 25, 25)){
                                t.onClick(t, p);
                            }
                        }); break;
                    case "stuck":
                        p.x = 0; p.y = 0; this.handleTriggers(p); break;
                }; break;
            case "system":
                switch(json.method) {
                    case "auth":
                        let user;
                        try { user = await this.auth.fetchAccount(json.content.account.name, json.content.account.pass); }
                        catch { ws.send(JSON.stringify({"type": "system", "method": "auth", "content": "NO"})); return; }
                        if(!user) { ws.send(JSON.stringify({"type": "system", "method": "auth", "content": "NO"})); return; }
                        if(this.players.values().map(p => p.user.account.id).toArray().includes(user.account.id)) { /*ws.send(JSON.stringify({"type": "system", "method": "auth", "content": "ALR"})); return;*/
                            let other = this.players.values().find(p => p.user.account.id == user.account.id)!.ws;
                            this.deregisterPlayer(other);
                        }
                        this.handleConnection(ws, user);
                };
        }
    }

    deregisterPlayer(ws: ServerWebSocket<{ source: string }>) {
        let p = this.players.get(ws);
        this.players.delete(ws);
        if(!p) return;
        this.db.fetch("game").then(d => {
            d.player_data[p.user.account.id] = p.serialize();
            this.middlemanSaveData.forEach(m => { d = m(p, d); })
            this.db.modify("game", d);
        })
        if(this.getPlayerCount(p.instance) < 1) {
            this.instances.splice(this.instances.indexOf(p.instance));
        }
        ws.send(JSON.stringify({"type": "system", "method": "exit"}));
        ws.close();
    };

    getPlayerCount(i: GameInstance) {
        let players = Array.from(this.players).filter(([k, v]) => v.instance == i);
        return players.length;
    };

    sendState(instance: GameInstance) {
        let players = Array.from(this.players).filter(([k, v]) => v.instance == instance);
        players.forEach(p => {
            this.updatePlayer(p[1]);
            let tile = p[1].instance.getTile(p[1].tile_id)
            if(!tile) return;
            tile.triggers.filter(t => t.active).forEach(t => { t.onTick(t); })
            this.middlemanStateSending.forEach(m => { m(p); })
            let queue = this.queue.get(p[0]);
            if(queue) {
                queue.forEach(json => {
                    p[0].send(JSON.stringify(json));
                });
                this.queue.delete(p[0]);
            };
            let state = {
                "type": "state",
                "method": "update",
                "content": { ...tile.asSendable(),
                    "you": this.players.get(p[0])?.asSendable(), 
                    "info": {"player-count": this.getPlayerCount(instance), "instance-id": instance.id, "timestamp": Date.now()},
                    "players": [...Array.from(this.players).filter(([k, v]) => k != p[0] && v.tile_id == p[1].tile_id).map(p2 => p2[1].asSendable())]
                }
            };
            p[0].send(JSON.stringify(state));
        });
    }
}