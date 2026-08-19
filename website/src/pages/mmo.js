/**
 * author thebadlorax
 * created on 16-08-2026-09h-00m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Vector } from "./mini/maths.js";

const user = JSON.parse(window.localStorage.getItem("user"));
if(!user) { alert("make an account"); window.location.href = "/"; }

class Keyboard {
    _keys = {};
    _key_functions = {};
    constructor() {
        window.addEventListener('keydown', this._onKeyDown.bind(this));
        window.addEventListener('keyup', this._onKeyUp.bind(this));

        window.addEventListener("blur", () => {
            for (const key in this._keys) {
                this._keys[key] = false;
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                for (const key in this._keys) {
                    this._keys[key] = false;
                }
            }
        });

        this.waiting = false;
    };

    listenForEvents(keys) {
        keys.forEach(function (key) {
            this._keys[key] = false;
        }.bind(this));
    };

    setFunctionOnKeyPress(key, fn) {
        this._key_functions[key] = fn;
    }

    _onKeyDown(event) {
        var keyCode = event.code;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = true;
            if(this._key_functions[keyCode] != undefined) this._key_functions[keyCode]();
        }
    };

    _onKeyUp(event) {
        var keyCode = event.code;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = false;
        }

        if (keyCode === "MetaLeft" || keyCode === "MetaRight") {
            for (const key in this._keys) {
                if (key !== "MetaLeft" && key !== "MetaRight") {
                    this._keys[key] = false;
                }
            }
        }
    };

    isDown(keyCode) {
        if (!(keyCode in this._keys)) {
            throw new Error('Keycode ' + keyCode + ' is not being listened to');
        }
        return this._keys[keyCode];
    }

    waitForKeyPress() {
        const toggle = () => {
            this.waiting = false;
        }
        this.waiting = true;
        return new Promise(resolve => {
            function handler(event) {
                window.removeEventListener("keydown", handler);
                toggle();
                resolve(event);
            }
    
            window.addEventListener("keydown", handler);
        });
    }
}

const Tile_Colors = {
    "WHITE": `rgba(255, 255, 255, 1)`,
    "RED": `rgba(255, 0, 0, 1)`,
    "BLUE": `rgba(0, 0, 255, 1)`,
    "GREEN": `rgba(0, 255, 0, 1)`,
    "GREY": `rgba(127, 127, 127, 1)`,
    "YELLOW": `rgba(125, 125, 0, 1)`,
    "NONE": `rgba(0, 0, 0, 0);`
}; const Tileset = {
    "WALL": "#",
    "EMPTY": "·",
    "OPEN_DOOR": "'",
    "CLOSED_DOOR": "+",
    // entities, etc
    "PLAYER": "@",
}; const EntityTypes = [
    {
        "name": "player",
        "tile": "PLAYER"
    }
]

class Renderer {
    static TILE_SIZE = 32;
    static SIDEBAR_WIDTH = 12;
    constructor(ctx, engine) { 
        this.ctx = ctx;
        this.engine = engine;
        this.fps_data = new Array(); 
        this.render_info = {
            "map": {
                "rows": null,
                "columns": null,
                "bg_override": new Map()
            },
            "background_color": `rgba(0, 0, 0, 1)`,
            "test": false
        };
        Tile_Colors.NONE = this.render_info.background_color
        this.preload(); 
    }
    preload() {
        this.character_cache = new Map();
        Object.keys(Tile_Colors).forEach(s => this.character_cache.set(s, new Array()));
        Object.values(Tileset).forEach(char => {
            Object.entries(Tile_Colors).forEach(color => {
                const arr = this.character_cache.get(color[0])
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = Renderer.TILE_SIZE;
                canvas.height = Renderer.TILE_SIZE;
    
                ctx.font = `${Renderer.TILE_SIZE-4}px monospace`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = color[1];
                ctx.fillText(char, Math.floor(Renderer.TILE_SIZE/2), Math.floor(Renderer.TILE_SIZE/2))
    
                arr.push(canvas)
            })
        })
    }

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = this.render_info.background_color;
        ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        const inst = this.engine.data.current_instance;
        if(inst != null) {
            if(inst.location != null) {
                // draw map
                const loc = inst.location;
                let map_offset = Vector.two(0, 0);
                if(loc.info.width < this.render_info.map.rows) map_offset.x = Math.floor((this.render_info.map.rows-loc.info.width)/2)
                if(loc.info.height < this.render_info.map.columns) map_offset.y = Math.floor((this.render_info.map.columns-loc.info.height)/2)
                
                let c = 0; for(let y = 0; y < loc.info.height; y++) {
                    for(let x = 0; x < loc.info.width; x++) {
                        const t = loc.data.tiles[c];
                        let tile = this.character_cache.get(Object.keys(Tile_Colors)[t.fg_color])[t.type];
                        const entity = inst.getEntityOnTile(x, y);
                        if(entity != undefined) {
                            tile = this.character_cache.get("GREY")[Object.values(Tileset).indexOf(Tileset[EntityTypes[entity.type].tile])]
                        }
                        ctx.fillStyle = Object.values(Tile_Colors)[t.bg_color];
                        const o = this.render_info.map.bg_override.get(`${x};${y}`)
                        if(o != undefined) ctx.fillStyle = o;
                        ctx.fillRect((x+map_offset.x)*Renderer.TILE_SIZE, (y+map_offset.y)*Renderer.TILE_SIZE, Renderer.TILE_SIZE, Renderer.TILE_SIZE)
                        ctx.drawImage(tile, (x+map_offset.x)*Renderer.TILE_SIZE, (y+map_offset.y)*Renderer.TILE_SIZE)
                        c += 1;
                    }
                }
            }
        }

        // draw sidebar
        ctx.fillStyle = this.render_info.background_color;
        ctx.fillRect(ctx.canvas.width-(Renderer.SIDEBAR_WIDTH*Renderer.TILE_SIZE), 0, ctx.canvas.width, ctx.canvas.height)

        ctx.strokeStyle = `rgba(255, 255, 255, 1)`;
        ctx.beginPath();
        ctx.moveTo(ctx.canvas.width-(Renderer.SIDEBAR_WIDTH*Renderer.TILE_SIZE), 0)
        ctx.lineTo(ctx.canvas.width-(Renderer.SIDEBAR_WIDTH*Renderer.TILE_SIZE), ctx.canvas.height)
        ctx.stroke();

        // fps text
        ctx.fillStyle = `rgba(0, 0, 0, 1)`;
        ctx.fillStyle = `rgba(127, 127, 127, 1)`;
        ctx.font = "15px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let avg = 0; for(let x = 0; x < this.fps_data.length; x++) { avg += this.fps_data[x]; }; avg /= this.fps_data.length;
        ctx.fillText(`${(1/avg).toFixed(0)} fps`, ctx.canvas.width-35, 15);
        if(inst != null) {
            let t = inst.next_timestep - Date.now();
            if(!t) t = -1000;
            ctx.fillStyle = "white";
            ctx.textAlign = "left";
            ctx.fillText(t < 0 ? `next ts: soon?` : `next ts: ${t}ms`, ctx.canvas.width-(Renderer.SIDEBAR_WIDTH*Renderer.TILE_SIZE)+10, 15);
        }
    }
}

class Engine {
    constructor(ctx) {
        this.ctx = ctx;
        this.renderer = new Renderer(ctx, this);
        this.data = {
            "current_instance": null
        }
        this.keyboard = new Keyboard();
    }
    setupHandlers() {
        window.addEventListener("resize", () => { this._resize() });
        this._resize();
    }
    init() {
        this.keyboard.listenForEvents([
            "KeyQ", "KeyW", "KeyE", 
            "KeyA",         "KeyD",
            "KeyZ", "KeyX", "KeyC", 
        ])
        const moveAction = (dir) => {
            this.sock.sendPacket(new Packet("action", {
                "type": "move",
                "data": {
                    "direction": dir
                }
            }));
        }
        this.keyboard.setFunctionOnKeyPress("KeyQ", () => moveAction(5))
        this.keyboard.setFunctionOnKeyPress("KeyW", () => moveAction(0))
        this.keyboard.setFunctionOnKeyPress("KeyE", () => moveAction(4))
        this.keyboard.setFunctionOnKeyPress("KeyA", () => moveAction(3))
        this.keyboard.setFunctionOnKeyPress("KeyD", () => moveAction(1))
        this.keyboard.setFunctionOnKeyPress("KeyZ", () => moveAction(7))
        this.keyboard.setFunctionOnKeyPress("KeyX", () => moveAction(2))
        this.keyboard.setFunctionOnKeyPress("KeyC", () => moveAction(6))

        this.sock = new SocketConnection("/mmo/live")
        const sock = this.sock;

        sock.open(() => {
            sock.sendPacket(new Packet("authorize", { "name": user.account.name, "pass": user.account.pass }))
        });
        sock.onMessage = (data) => {
            const packet = Packet.fromFormatted(data)
        
            switch(packet.type) {
                case "authError": {
                    alert("something went wrong authorizing your account (try logging out and in again)")
                    window.location.href = "/";
                    break;
                }
                case "welcome": {
                    console.log("connected to server"); break;
                }
                case "authorize": {
                    sock.sendPacket(new Packet("findInstance", "")); break;
                }
                case "forceHomepage": {
                    if(packet.data != "") alert(packet.data);
                    window.location.href = "/";
                }
                case "instanceConnection": {
                    const inst = new Instance(sock, packet.data, this);
                    inst.transferSocketControl();
                    this.data.current_instance = inst;
                    break;
                }
                default: console.warn(`unhandled packet:\n${packet.toString()}`)
            }
        }

        this.setupHandlers();
    }

    update(delta) {}

    tick(elapsed) {
        if(this._previousElapsed === null) {
            this._previousElapsed = elapsed;
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        }
    
        const delta = Math.min((elapsed - this._previousElapsed) / 1000, 0.12);
        this._previousElapsed = elapsed;

        if(this.renderer.fps_data.length > 5) {
            this.renderer.fps_data.shift();
        }
        this.renderer.fps_data.push(delta);
    
        this.update(delta);
        this.renderer.render();
    
        window.requestAnimationFrame(this.tick.bind(this));
    }

    _resize() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;

        this.renderer.render_info.map.rows = Math.floor(this.ctx.canvas.width/Renderer.TILE_SIZE)-Renderer.SIDEBAR_WIDTH
        this.renderer.render_info.map.columns = Math.floor(this.ctx.canvas.height/Renderer.TILE_SIZE)
    }
}

class Packet {
    static fromFormatted(str) {
        const a = atob(str).split(";");
        return new Packet(a[0], JSON.parse(a[1]));
    }
    
    constructor(type, data) {
        this.type = type;
        this.data = data;
    }

    getFormatted() {
        return btoa(`${this.type};${JSON.stringify(this.data)}`);
    }
    toString() {
        return `packet[${this.type}]: ${JSON.stringify(this.data)}`
    }
}

class SocketConnection {
    constructor(path) {
        this.path = location.host.includes("66.65.25.15") ? 
            `${location.protocol}//${location.host}/subdomain=api${path}` : 
            `${location.protocol}//api.${location.host}${path}`;
        this.ws = null;
        this.onMessage = (msg) => {};
    }
    open(onOpen=()=>{}) {
        this.ws = new WebSocket(this.path);
        this.ws.addEventListener("message", (msg) => { this.onMessage(msg.data) })
        this.ws.addEventListener("open", onOpen)
    }

    sendPacket(packet) { this.sendRaw(packet.getFormatted()) }
    sendRaw(data)      { this.ws.send(data) }
}

class Instance {
    constructor(sock, info, engine) {
        this.sock = sock;
        this.id = info.id;
        this.eng = engine;
        this.next_timestep = null;

        this.location = null;
    }

    transferSocketControl() {
        console.log(`swapping to instance ${this.id}'s control`)
        this.sock.onMessage = (data) => {
            const packet = Packet.fromFormatted(data)

            switch(packet.type) {
                case "modifyEntity": {
                    const e = this.location.data.entities.find(e => e.id === packet.data.entityID || e.entityID === packet.data.entityID);
                    this.location.data.entities[this.location.data.entities.indexOf(e)] = packet.data;
                    break;
                }
                case "createEntity": {
                    this.location.data.entities.push(packet.data);
                    break;
                }
                case "destroyEntity": {
                    const e = this.location.data.entities.find(e => e.id === packet.data.entityID || e.entityID === packet.data.entityID);
                    this.location.data.entities.splice(this.location.data.entities.indexOf(e), 1);
                    break;
                }
                case "locationUpdate": {
                    this.location = packet.data;
                    break;
                }
                case "addBGOverride": {
                    this.eng.renderer.render_info.map.bg_override.set(`${packet.data.x};${packet.data.y}`, Object.values(Tile_Colors)[packet.data.color]);
                    break;
                }
                case "removeBGOverride": {
                    this.eng.renderer.render_info.map.bg_override.delete(`${packet.data.x};${packet.data.y}`);
                    break;
                }
                case "timestep": {
                    this.next_timestep = packet.data.next;
                    break;
                }
                default: console.warn(`unhandled packet:\n${packet.toString()}`)
            }
        }
    }

    getEntityOnTile(x, y) {
        return this.location.data.entities.find(e => e.pos.x === x && e.pos.y === y);
    }
    getTileAt(x, y) {
        console.log(this.location.data.tiles)
    }
}

const c = document.getElementById("main");
c.width = window.innerWidth;
c.height = window.innerHeight;
const e = new Engine(c.getContext("2d"));
e.init();
window.requestAnimationFrame(e.tick.bind(e));