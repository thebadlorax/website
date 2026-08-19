/**
 * author thebadlorax
 * created on 14-08-2026-19h-06m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { LogWizard } from "./logging";
import { AuthorizationWizard, type User } from "./auth";
import { Database } from "./db";
import { type ServerWebSocket } from "bun";
import { clamp, generateRandomString } from "./utils";
import { Vector, Vector2 } from "./maths";

const getRandomFromList = (list: Array<any>) => { return list[Math.floor(Math.random()*list.length)] }

// GAME
enum TileColor {
    WHITE,
    RED,
    BLUE,
    GREEN,
    GREY,
    YELLOW,
    NONE
}
enum TileType {
    WALL,
    EMPTY
}; type Tile = {
    type: TileType,
    bg_color: TileColor,
    fg_color: TileColor
}; type LocationData = {
    tiles: Array<Tile>,
    entities: Array<Entity>
}; type MapLocation = {
    width: number,
    height: number,
    id: string
}; 
const opposite_movements = [
    2, // north -> south
    3, // east -> west
    0, // south -> north
    1, // west -> east
    7, // northeast -> southwest
    6, // northwest -> southeast
    5, // southeast -> northwest
    4  // southwest -> northeast
]
const encodeMapLocation = (loc: MapLocation, data: LocationData) => { return {"info": loc, "data": data} }
const decodeMapLocation = (data: any) => {
    return {
        "location": data.info as MapLocation,
        "data": data.data as LocationData
    }
}
class LocationManager {
    public locations: Array<MapLocation> = new Array();
    public dataMap: Map<string, LocationData> = new Map();
    constructor() {}

    createTestLocation() {
        const l = {
            width: 16,
            height: 16,
            id: generateRandomString(5)
        } as MapLocation;
        this.locations.push(l);
        const t_array = new Array(l.width * l.height);
        let c = 0; for(let y = 0; y < l.height; y++) {
            for(let x = 0; x < l.width; x++) {
                t_array[c] = {type: 
                    ((y == 0 || y == l.height-1) || (x == 0) || (x == l.width-1)) ? TileType.WALL : TileType.EMPTY, 
                    fg_color: ((y == 0 || y == l.height-1) || (x == 0) || (x == l.width-1)) ? 
                    TileColor.WHITE :
                    TileColor.GREY,
                    bg_color: TileColor.NONE
                } as Tile
                c += 1;
            }
        }
        this.dataMap.set(l.id, {
            tiles: t_array,
            entities: new Array()
        } as LocationData);
        return l;
    }

    sendEntityToLocation(entity: Entity, locID: string) {
        this.removeEntityFromLocation(entity);
        const loc = this.dataMap.get(locID);
        if(!loc) return; // TODO: error out
        loc.entities.push(entity);
        entity.locID = locID;
    }
    removeEntityFromLocation(entity: Entity) {
        const loc = this.dataMap.get(entity.locID!);
        if(!loc) return; // TODO: error out
        loc.entities.splice(loc.entities.indexOf(entity), 1);
        entity.locID = null;
    }

    getMapLocation(id: string)  { return this.locations.find(l => l.id == id) }
    getLocationData(id: string) { return this.dataMap.get(id) }

    getAllData(locID: string): any {
        return [
            this.getMapLocation(locID),
            this.getLocationData(locID)
        ]
    }
    getTile(info: MapLocation, data: LocationData, x: number, y: number) {
        return data.tiles[
            x + y * info.width
        ];
    }
    getEntityOnTile(data: LocationData, x: number, y: number) {
        return data.entities.find(e => e.pos.x === x && e.pos.y === y);
    }
}

enum EntityType {
    PLAYER
}
class Entity {
    static decode(data: any) {
        const e = new Entity(data.type);
        e.pos.xySetIp(data.pos.x, data.pos.y);
        return e;
    }
    public pos: Vector2;
    public type: EntityType;
    public locID: string | null = null;
    public id: string = generateRandomString(5);

    constructor(type: EntityType) {
        this.pos = Vector.two(0, 0);
        this.type = type;
    }

    encode() {
        return {
            "pos": {
                "x": this.pos.x,
                "y": this.pos.y
            },
            "type": this.type,
            "locID": this.locID,
            "entityID": this.id
        }
    }
}

// WEBSOCKET/NETWORKING
type Packet = {
    type: string,
    data: any
}; const decodePacket = (formatted: string) => {
    const a: Array<string> = atob(formatted).split(";");
    return { type: a[0], data: JSON.parse(a[1]!) } as Packet;
}; const encodePacket = (packet: Packet) => { return btoa(`${packet.type};${JSON.stringify(packet.data)}`); }

class SocketConnection {
    public ws: ServerWebSocket<{ source: string; }>;
    public onPacket: (packet: Packet) => any = (packet: Packet) => {};
    public id: string = generateRandomString(5);

    constructor(ws: ServerWebSocket<{ source: string; }>) { 
        this.ws = ws;
    }
    public async _onPacket(packet: Packet) { await this.onPacket(packet) }
    public sendPacket(packet: Packet) { this.sendRaw(encodePacket(packet)) }
    public sendRaw(data: string)      { this.ws.send(data) }
}

type Action = {
    type: string,
    data: any
}

class Player {
    private db: Database;
    public sock: SocketConnection;
    public entity: Entity;
    public queuedActions: Array<Action> = new Array();
    public extra_data: any;

    constructor(db: Database, sock: SocketConnection) {
        this.db = db; this.sock = sock;
        this.entity = new Entity(EntityType.PLAYER);
        this.extra_data = {
            "queued_pos": Vector.two(0, 0)
        }
    }
}

class MMOInstance {
    public id: string = `i${generateRandomString(5)}`;
    private log: LogWizard = new LogWizard();
    private db: Database;
    public players: Array<Player> = new Array();
    private wizard: MMOWizard;
    private loc: LocationManager = new LocationManager();
    
    private shouldKill: boolean = false;
    private timestepInterval = 1000;
    private next_timestep = Date.now()+this.timestepInterval;

    constructor(db: Database, wiz: MMOWizard) {
        this.db = db; this.wizard = wiz; this.loc.createTestLocation();
        this.timestep();
    }

    executeAction(action: Action, player: Player) {
        const entity = player.entity;
        switch(action.type) {
            case "move": {
                switch(action.data.direction) {
                    case 0: { this.moveEntity(entity, Vector.two(0, -1)); break; }  // north
                    case 1: { this.moveEntity(entity, Vector.two(1, 0)); break; }   // east
                    case 2: { this.moveEntity(entity, Vector.two(0, 1)); break; }   // south
                    case 3: { this.moveEntity(entity, Vector.two(-1, 0)); break; }  // west
                    case 4: { this.moveEntity(entity, Vector.two(1, -1)); break; }  // northeast
                    case 5: { this.moveEntity(entity, Vector.two(-1, -1)); break; } // northwest
                    case 6: { this.moveEntity(entity, Vector.two(1, 1)); break; }   // southeast
                    case 7: { this.moveEntity(entity, Vector.two(-1, 1)); break; }  // southwest
                };
                player.sock.sendPacket({
                    "type": "removeBGOverride",
                    "data": {
                        "x": entity.pos.x,
                        "y": entity.pos.y,
                    }
                } as Packet)
                break;
            }
            default: {
                this.log.error("unhandled action", `MMOInstance[${this.id}]`)
            }
        }
    }

    public moveEntity(entity: Entity, offset: Vector2) {
        const info = this.loc.getMapLocation(entity.locID!)!;
        entity.pos.addIp(offset);
        entity.pos.x = clamp(entity.pos.x, 0, info.width);
        entity.pos.y = clamp(entity.pos.y, 0, info.height);
        this.broadcast({
            type: "modifyEntity",
            data: entity.encode()
        } as Packet)
    }

    private broadcast(packet: Packet, exclude: Array<Player>=new Array()) { this.players.forEach(p => { if(!exclude.includes(p)) { p.sock.sendPacket(packet) } }) }

    private timestep() {
        if(this.shouldKill) return;
        this.players.forEach(p => {
            if(p.queuedActions.length > 0) {
                this.executeAction(p.queuedActions[0]!, p)
                p.queuedActions.shift();
            }
        });
        this.next_timestep = Date.now()+this.timestepInterval;
        this.broadcast({
            "type": "timestep",
            "data": {
                "next": this.next_timestep
            }
        } as Packet)
        setTimeout(() => {
            this.timestep();
        }, this.timestepInterval)
    }

    public connect(sock: SocketConnection) {
        const p = new Player(this.db, sock); this.players.push(p);
        p.entity.pos.xySetIp(1, 1); p.extra_data.queued_pos = p.entity.pos.copy();
        sock.onPacket = (packet: Packet) => { this.onPlayerPacket(packet, p) };
        sock.sendPacket({
            "type": "instanceConnection",
            "data": {
                "id": this.id,
                "players": this.playerCount()
            }
        } as Packet)
        this.onPlayerJoin(p);
    }
    public disconnect(sock: SocketConnection) { 
        for(let x = 0; x < this.players.length; x++) {
            if(this.players[x]!.sock.id === sock.id) {
                this.onPlayerLeave(this.players[x]!);
                this.players.splice(x, 1);
            }
        }
        
    }

    private queueAction(player: Player, action: Action) {
        const evaluateMovement = (offset: Vector2) => {
            player.extra_data.queued_pos.x += offset.x;
            player.extra_data.queued_pos.y += offset.y;
            const d = this.loc.getAllData(player.entity.locID!);
            const queued_tile = this.loc.getTile(d[0], d[1], player.extra_data.queued_pos.x, player.extra_data.queued_pos.y);
            const queued_entity = this.loc.getEntityOnTile(d[1], player.extra_data.queued_pos.x, player.extra_data.queued_pos.y);
            if(queued_tile!.type == 0) {
                player.extra_data.queued_pos.x -= offset.x;
                player.extra_data.queued_pos.y -= offset.y;
                return;
            }
            if(queued_entity != undefined) {
                if(queued_entity.type == 0) {
                    player.extra_data.queued_pos.x -= offset.x;
                    player.extra_data.queued_pos.y -= offset.y;
                    return;
                }
            }
            player.queuedActions.push(action);
            const p = player.extra_data.queued_pos;
            player.sock.sendPacket({
                "type": "addBGOverride",
                "data": {
                    "x": p.x,
                    "y": p.y,
                    "color": TileColor.YELLOW
                }
            } as Packet)
        }
        switch(action.type) {
            case "move": {
                switch(action.data.direction) {
                    case 0: { evaluateMovement(Vector.two(0, -1)); break; } // north
                    case 1: { evaluateMovement(Vector.two(1, 0)); break; } // east
                    case 2: { evaluateMovement(Vector.two(0, 1)); break; } // south
                    case 3: { evaluateMovement(Vector.two(-1, 0)); break; } // west
                    case 4: { evaluateMovement(Vector.two(1, -1)); break; } // northeast
                    case 5: { evaluateMovement(Vector.two(-1, -1)); break; } // northwest
                    case 6: { evaluateMovement(Vector.two(1, 1)); break; } // southeast
                    case 7: { evaluateMovement(Vector.two(-1, 1)); break; } // southwest
                }
            }
        }
    }

    private onPlayerJoin(player: Player) {
        this.loc.sendEntityToLocation(player.entity, this.loc.locations[0]!.id);
        this.broadcast({
            "type": "createEntity",
            "data": player.entity.encode()
        } as Packet, [player]);
        if(!player.entity.locID) return;
        player.sock.sendPacket({
            "type": "locationUpdate",
            "data": encodeMapLocation(this.loc.getMapLocation(player.entity.locID)!, this.loc.getLocationData(player.entity.locID)!)
        } as Packet);
        player.sock.sendPacket({
            "type": "timestep",
            "data": {
                "next": this.next_timestep
            }
        } as Packet)
    }
    private onPlayerLeave(player: Player) {
        this.broadcast({
            "type": "destroyEntity",
            "data": {
                "entityID": player.entity.id
            }
        } as Packet, [player])
    }
    private onPlayerPacket(packet: Packet, player: Player) {
        switch(packet.type) {
            case "action": {
                const action = {
                    "type": packet.data.type,
                    "data": packet.data.data
                } as Action;
                this.queueAction(player, action);
                break;
            }
            default: {
                player.sock.sendPacket({
                    "type": "error",
                    "data": `packet of type ${packet.type} doesn't have any behavior`
                } as Packet);
                break;
            }
        }
    }

    destroy() {}
    
    public isFull()      { return this.playerCount() >= MMOWizard.INSTANCE_MAX_PLAYER_COUNT }
    public playerCount() { return this.players.length }
    public shouldCull()  { return this.playerCount() <= 0 }
    public canJoin()     { return !this.isFull() }
}

export class MMOWizard {
    static INSTANCE_MAX_PLAYER_COUNT: number = 12;

    private log: LogWizard = new LogWizard();
    private db: Database;
    private auth: AuthorizationWizard;
    public instances: Array<MMOInstance> = new Array();
    private wsToSockMap: Map<ServerWebSocket<{ source: string; }>, SocketConnection> = new Map();
    private sockToInstanceIDMap: Map<SocketConnection, string> = new Map();
    private sockToUserMap: Map<SocketConnection, User> = new Map();

    constructor(db: Database) {
        this.db = db; this.auth = new AuthorizationWizard(this.db);
    }

    public connect(ws: ServerWebSocket<{ source: string; }>)  {
        const sock = new SocketConnection(ws);
        this.wsToSockMap.set(ws, sock);
        sock.onPacket = async (packet: Packet) => { await this.onPacket(packet, sock) };
        sock.sendPacket({
            "type": "welcome",
            "data": "connected"
        } as Packet)
    }
    public disconnect(ws: ServerWebSocket<{ source: string; }>) {
        const sock = this.wsToSockMap.get(ws);
        if(!sock) return; // TODO: error
        const id = this.sockToInstanceIDMap.get(sock);
        if(!id) return; // TODO: error
        const inst = this.instances.find(i => i.id = id);
        if(!inst) return; // TODO: error
        inst.disconnect(sock); 
        this.sockToInstanceIDMap.delete(sock); this.sockToUserMap.delete(sock); this.wsToSockMap.delete(sock.ws);
        this.cullInstances()
    }
    public async routeIncomingData(ws: ServerWebSocket<{ source: string; }>, data: string) {
        const sock = this.wsToSockMap.get(ws);
        if(!sock) return; // TODO: error
        await sock._onPacket(decodePacket(data));
    }

    private async onPacket(packet: Packet, socket: SocketConnection) {
        switch(packet.type) {
            case "fetchInstances": {
                socket.sendPacket({
                    "type": "fetchInstances",
                    "data": this.instances.map(i => {
                        return {
                            "playerCount": i.playerCount(),
                            "id": i.id,
                            "canJoin": i.canJoin()
                        }
                    })
                } as Packet);
                break;
            }
            case "authorize": {
                const user = await this.auth.fetchAccount(packet.data.name, packet.data.pass);
                if(!user) {
                    socket.sendPacket({
                        "type": "authError",
                        "data": `incorrect information / no account`
                    } as Packet); break;
                }
                if(this.sockToUserMap.values().find(u => u.account.id == user.account.id)) {
                    socket.sendPacket({
                        "type": "forceHomepage",
                        "data": `already connected`
                    } as Packet); 
                    break;
                }
                this.sockToUserMap.set(socket, user);
                socket.sendPacket({
                    "type": "authorize",
                    "data": `authorized!`
                } as Packet); 
                break;
            }
            case "findInstance": {
                if(!this.sockToUserMap.get(socket)) {
                    socket.sendPacket({
                        "type": "error",
                        "data": `authorize before joining an instance`
                    } as Packet); break;
                }
                this.sendToInstance(socket);
                break;
            }
            default: {
                socket.sendPacket({
                    "type": "error",
                    "data": `packet of type ${packet.type} doesn't have any return behavior (try connecting to an instance?)`
                } as Packet);
                break;
            }
        }
    }
    public sendToInstance(sock: SocketConnection) {
        const avaliable_instances = this.instances.filter(i => i.canJoin());
        const inst = avaliable_instances.length === 0 ? this.createInstance() : avaliable_instances[0];
        if(!inst) return; // TODO: error
        inst.connect(sock); this.sockToInstanceIDMap.set(sock, inst.id);
    }

    private createInstance() { const i = new MMOInstance(this.db, this); this.instances.push(i); return i }
    public cullInstances()   { this.instances.filter(i => i.shouldCull()).forEach((i, index) => { this.instances.splice(index, 1); i.destroy(); }) }
}