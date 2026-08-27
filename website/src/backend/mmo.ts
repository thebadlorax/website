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
    public pos: Vector2;
    public type: EntityType;
    public locID: string | null = null;
    public id: string;

    constructor(type: EntityType) {
        this.pos = Vector.two(0, 0);
        this.type = type;
        this.id = generateRandomString(5);
    }
}

// WEBSOCKET/NETWORKING
enum PacketType {
    UPDATE_ENTITY_POSITION = 0,
    CREATE_ENTITY = 1,
    DESTROY_ENTITY = 2,
    MAP_UPDATE = 3,
    TIMESTEP = 4,
    ERROR = 5,
    WELCOME = 6,
    FETCH_INSTANCES = 7,
    FORCE_HOMEPAGE = 8,
    AUTHORIZATION_SUCCESS = 9,
    AUTHORIZATION_REQUEST = 10,
    FIND_INSTANCE = 11,
    INSTANCE_CONNECTION = 12,
    ACTION = 13
}
class PacketWriter {
    public static EMPTY = (): Uint8Array => { return new Uint8Array(new ArrayBuffer(0)); }
    private data: number[] = [];

    writeUint8(value: number) { this.data.push(value & 0xFF) }
    writeUint16(value: number) {
        this.data.push(
            (value >>> 8) & 0xFF,
            value & 0xFF
        );
    }
    writeUint32(value: number) { this.data.push(
        (value >>> 24) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 8) & 0xFF,
        value & 0xFF
    ) }
    writeString(value: string, sixteenBit: boolean = false) {
        const bytes = new TextEncoder().encode(value);
        sixteenBit ? this.writeUint16(bytes.length) : this.writeUint32(bytes.length)
        for(const byte of bytes) this.data.push(byte);
    }

    toUint8Array(): Uint8Array { return new Uint8Array(this.data) }
}
class PacketReader {
    private data: Uint8Array;
    private offset: number = 0;

    constructor(data: Uint8Array | ArrayBuffer) {
        this.data = data instanceof Uint8Array ? data : new Uint8Array(data);
    }

    readUint8(): number { return this.data[this.offset++]!; }

    readUint16(): number {
        const value =
            (this.data[this.offset]! << 8) |
            this.data[this.offset + 1]!;

        this.offset += 2;

        return value;
    }

    readUint32(): number {
        const value =
            (this.data[this.offset]! << 24) |
            (this.data[this.offset + 1]! << 16) |
            (this.data[this.offset + 2]! << 8) |
            this.data[this.offset + 3]!;

        this.offset += 4;

        return value >>> 0;
    }

    readString(sixteenBit: boolean = false): string {
        const length = sixteenBit
            ? this.readUint16()
            : this.readUint32();

        const bytes = this.data.slice(
            this.offset,
            this.offset + length
        );

        this.offset += length;

        return new TextDecoder().decode(bytes);
    }
}
abstract class AbstractPacket {
    protected type: number;
    constructor(type: number) { this.type = type; }

    protected abstract getPayload(): Uint8Array;
    public toBuffer(): ArrayBuffer {
        const payload = this.getPayload();

        const buffer = new ArrayBuffer(1 + payload.byteLength);
        const view = new Uint8Array(buffer);

        view[0] = this.type;
        view.set(payload, 1);

        return buffer;
    }
}
class UpdateEntityPositionPacket extends AbstractPacket {
    private entity: Entity;
    constructor(entity: Entity) {
        super(PacketType.UPDATE_ENTITY_POSITION);
        this.entity = entity;
    }

    protected getPayload(): Uint8Array {
        const writer = new PacketWriter()

        writer.writeString(this.entity.id, true)
        writer.writeUint32(this.entity.pos.x)
        writer.writeUint32(this.entity.pos.y)

        return writer.toUint8Array()
    }
}
class CreateEntityPacket extends AbstractPacket {
    private entity: Entity;
    constructor(entity: Entity) {
        super(PacketType.CREATE_ENTITY);
        this.entity = entity;
    }

    protected getPayload(): Uint8Array {
        const writer = new PacketWriter();

        writer.writeString(this.entity.id, true);
        writer.writeUint32(this.entity.pos.x);
        writer.writeUint32(this.entity.pos.y);
        writer.writeUint16(this.entity.type);
        writer.writeString(this.entity.locID ?? "", true);

        return writer.toUint8Array()
    }
}
class DestroyEntityPacket extends AbstractPacket {
    private entity: Entity;
    constructor(entity: Entity) {
        super(PacketType.DESTROY_ENTITY);
        this.entity = entity;
    }

    protected getPayload(): Uint8Array {
        const writer = new PacketWriter();

        writer.writeString(this.entity.id);

        return writer.toUint8Array()
    }
}
class TimestepPacket extends AbstractPacket {
    constructor() { super(PacketType.TIMESTEP); }

    protected getPayload(): Uint8Array {
        return PacketWriter.EMPTY();
    }
}
class WelcomePacket extends AbstractPacket {
    constructor() { super(PacketType.WELCOME); }

    protected getPayload(): Uint8Array {
        return PacketWriter.EMPTY();
    }
}
class ForceHomepagePacket extends AbstractPacket {
    constructor() { super(PacketType.FORCE_HOMEPAGE); }

    protected getPayload(): Uint8Array {
        return PacketWriter.EMPTY();
    }
}
class AuthorizationSuccessPacket extends AbstractPacket {
    constructor() { super(PacketType.AUTHORIZATION_SUCCESS); }

    protected getPayload(): Uint8Array {
        return PacketWriter.EMPTY();
    }
}
class ErrorPacket extends AbstractPacket {
    private reason: string;
    constructor(reason: string) {
        super(PacketType.ERROR);
        this.reason = reason;
    }

    protected getPayload(): Uint8Array {
        const writer = new PacketWriter();

        writer.writeString(this.reason);

        return writer.toUint8Array()
    }
}
type TransmittableInstanceData = {
    id: string,
    canJoin: boolean,
    playerCount: number
}
class FetchInstancesPacket extends AbstractPacket {
    private instances: Array<TransmittableInstanceData>;
    constructor(instances: Array<TransmittableInstanceData>) {
        super(PacketType.FETCH_INSTANCES);
        this.instances = instances;
    }

    protected getPayload(): Uint8Array {
        const writer = new PacketWriter();

        writer.writeUint32(this.instances.length);
        for (const instance of this.instances) {
            writer.writeString(instance.id, true);
            writer.writeUint8(instance.canJoin ? 1 : 0);
            writer.writeUint32(instance.playerCount);
        }

        return writer.toUint8Array();
    }
}
class MapUpdatePacket extends AbstractPacket {
    private location: MapLocation;
    private data: LocationData;
    constructor(location: MapLocation, data: LocationData) {
        super(PacketType.MAP_UPDATE);
        this.location = location;
        this.data = data;
    }

    protected getPayload(): Uint8Array {
        const writer = new PacketWriter();

        writer.writeUint32(this.location.width);
        writer.writeUint32(this.location.height);
        writer.writeString(this.location.id, true);

        writer.writeUint32(this.data.tiles.length);
        for(const tile of this.data.tiles) {
            writer.writeUint16(tile.type);
            writer.writeUint16(tile.bg_color);
            writer.writeUint16(tile.fg_color);
        }
        writer.writeUint32(this.data.entities.length);
        for(const entity of this.data.entities) {
            writer.writeString(entity.id);
            writer.writeUint32(entity.pos.x);
            writer.writeUint32(entity.pos.y);
            writer.writeUint32(entity.type);
            writer.writeString(entity.locID ?? "", true);
        }

        return writer.toUint8Array();
    }
}
class InstanceConnectionPacket extends AbstractPacket {
    private id: string;
    private playerCount: number;
    constructor(id: string, playerCount: number) {
        super(PacketType.INSTANCE_CONNECTION);
        this.id = id;
        this.playerCount = playerCount;
    }

    protected getPayload(): Uint8Array {
        const writer = new PacketWriter();

        writer.writeString(this.id, true);
        writer.writeUint16(this.playerCount)

        return writer.toUint8Array();
    }
}

class SocketConnection {
    public ws: ServerWebSocket<{ source: string; }>;
    public onPacket: (data: ArrayBuffer) => any = (data: ArrayBuffer) => {};
    public id: string = generateRandomString(5);

    constructor(ws: ServerWebSocket<{ source: string; }>) { 
        this.ws = ws;
    }
    public async _onPacket(data: ArrayBuffer)  { await this.onPacket(data) }
    public sendPacket(packet: AbstractPacket)  { this.sendRaw(packet.toBuffer()) }
    public sendRaw(data: ArrayBuffer)          { this.ws.send(data) }
}

enum ActionType {
    MOVE = 0
}
type Action = {
    type: ActionType,
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
            case ActionType.MOVE: {
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
        this.broadcast(new UpdateEntityPositionPacket(entity));
    }

    private broadcast(packet: AbstractPacket, exclude: Array<Player>=new Array()) { this.players.forEach(p => { if(!exclude.includes(p)) { p.sock.sendPacket(packet) } }) }

    private timestep() {
        if(this.shouldKill) return;
        this.players.forEach(p => {
            if(p.queuedActions.length > 0) {
                this.executeAction(p.queuedActions[0]!, p)
                p.queuedActions.shift();
            }
        });
        this.next_timestep = Date.now()+this.timestepInterval;
        this.broadcast(new TimestepPacket())
        setTimeout(() => {
            this.timestep();
        }, this.timestepInterval)
    }

    public connect(sock: SocketConnection) {
        const p = new Player(this.db, sock); this.players.push(p);
        p.entity.pos.xySetIp(1, 1); p.extra_data.queued_pos = p.entity.pos.copy();
        sock.onPacket = (data: ArrayBuffer) => { this.onPlayerPacket(data, p) };
        sock.sendPacket(new InstanceConnectionPacket(this.id, this.playerCount()));
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
        }
        switch(action.type) {
            case ActionType.MOVE: {
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
        const loc_id = this.loc.locations[0]!.id
        this.loc.sendEntityToLocation(player.entity, loc_id);
        const loc_data = this.loc.getAllData(loc_id);
        this.broadcast(new CreateEntityPacket(player.entity), [player]);
        if(!player.entity.locID) return;
        player.sock.sendPacket(new MapUpdatePacket(loc_data[0], loc_data[1]));
    }
    private onPlayerLeave(player: Player) {
        this.broadcast(new DestroyEntityPacket(player.entity), [player])
    }
    private onPlayerPacket(data: ArrayBuffer, player: Player) {
        const reader = new PacketReader(data);
        const type = reader.readUint8();
        switch(type) {
            case PacketType.ACTION: {
                const action_type = reader.readUint8();
                let action_data;
                switch(action_type) {
                    case ActionType.MOVE: {
                        action_data = { "direction": reader.readUint8() } 
                    }
                }

                const action = {
                    "type": action_type,
                    "data": action_data
                } as Action;
                this.queueAction(player, action);
                break;
            }
            default: {
                player.sock.sendPacket(new ErrorPacket(`packet of type ${type}(${Object.values(PacketType)[type]}) doesn't have any behavior`));
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
        sock.onPacket = async (data: ArrayBuffer) => { await this.onPacket(data, sock) };
        sock.sendPacket(new WelcomePacket())
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
    public async routeIncomingData(ws: ServerWebSocket<{ source: string; }>, data: any) {
        const sock = this.wsToSockMap.get(ws);
        if(!sock) return; // TODO: error
        await sock._onPacket(data);
    }

    private async onPacket(data: ArrayBuffer, socket: SocketConnection) {
        const reader = new PacketReader(data);
        const type = reader.readUint8();
        switch(type) {
            case PacketType.FETCH_INSTANCES: {
                const instances = this.instances.map(i => { return {
                    playerCount: i.playerCount(),
                    id: i.id,
                    canJoin: i.canJoin()
                } as TransmittableInstanceData });
                socket.sendPacket(new FetchInstancesPacket(instances));
                break;
            }
            case PacketType.AUTHORIZATION_REQUEST: {
                const name = reader.readString(); const pass = reader.readString();
                const user = await this.auth.fetchAccount(name, pass);
                if(!user) {
                    socket.sendPacket(new ErrorPacket(`incorrect information / no account`)); 
                    break;
                }
                if(this.sockToUserMap.values().find(u => u.account.id == user.account.id)) {
                    break;
                }
                this.sockToUserMap.set(socket, user);
                socket.sendPacket(new AuthorizationSuccessPacket()); 
                break;
            }
            case PacketType.FIND_INSTANCE: {
                if(!this.sockToUserMap.get(socket)) {
                    socket.sendPacket(new ErrorPacket(`authorize before joining an instance`)); break;
                }
                this.sendToInstance(socket);
                break;
            }
            default: {
                socket.sendPacket(new ErrorPacket(`packet of type ${type} doesn't have any return behavior (try connecting to an instance?)`));
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