/**
 * author thebadlorax
 * created on 23-03-2026-14h-33m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { clamp } from "./common.js";
import { getApiLink } from "./common.js";

let FPS = 60;

const TRIGGER_FUNCTIONS = {
    "": (t) => {},
    "test": (t) => { console.log("test"); },
    "speak": (t) => {
        let player = t.game.objects.get("player");
        if(DISTANCE(t.x+(t.width/3), t.y+(t.width/3), player.x, player.y) > t.data.radius || t.game.extra_data.speech_window.visible) return;
        let lines = t.data.lines;
        let funcs = t.data.line_functions;
        let index = 0;
        t.game.extra_data.speech_portrait = t.data.portrait;
        t.game.extra_data.speech_next_line = lines[0];
        t.game.extra_data.speech_line_function = funcs[0];
        t.game.extra_data.speech_window.visible = true;
        t.game.extra_data.no_movement = true;
        t.game.extra_data.speech_window.onClick = (w, x, y) => {
            index += 1;
            t.game.extra_data.speech_line_function = funcs[index-1];
            let f = TRIGGER_FUNCTIONS[funcs[index-1]];
            if(f) f(t);
            if(index >= lines.length) {
                t.game.extra_data.speech_window.visible = false;
                delete t.game.speech_portrait;
                delete t.game.speech_next_line;
                delete t.game.extra_data.no_movement;
                delete t.game.extra_data.speech_next_line;
                return;
            };
            t.game.extra_data.speech_next_line = lines[index];
        };
    },
    "playSound": (t) => {
        t.game.audio.changeVolume(t.data.sound_id, t.data.volume || -1);
        t.game.audio.playSound(t.data.sound_id);
    }
}

const RECT_INTERSECTION = (x1, y1, w1, h1, x2, y2, h2, w2) => {
    return !(
        x1 + w1 < x2 || 
        y1 + h1 < y2 || 
        x1 > x2 + w2 || 
        y1 > y2 + h2
    )
};

const DISTANCE = (x1, y1, x2, y2) => {
    return Math.hypot(x2 - x1, y2 - y1);
};

document.addEventListener("keydown", function(e) {
    // Keycodes for arrow keys: Left (37), Up (38), Right (39), Down (40)
    if([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
      e.preventDefault(); // This stops the default scroll behavior
    }
  }, false);

class InputManager {
    constructor(game) { 
        this.keysDown = new Map(); 
        this.g = game;
        this.mousePos = [0, 0];
        this.onMouseMove = [];
        this.onButtonPress = {};
        window.addEventListener("keydown", e => { this.keysDown.set(e.code); if(this.onButtonPress.hasOwnProperty(e.code)) { e.preventDefault(true); this.onButtonPress[e.code](this.g) } }); 
        window.addEventListener("keyup", e => { this.keysDown.delete(e.code); } );
        this.g.renderer.canvas.addEventListener('mousemove', (event) => {
            const mousePos = this.getMousePos(this.g.renderer.canvas, event);
            this.mousePos[0] = mousePos.x; this.mousePos[1] = mousePos.y;
            this.onMouseMove.forEach(f => {
                f(this.g, mousePos.x, mousePos.y);
            })
        });
        this.g.renderer.canvas.addEventListener("click", () => {
            this.g.triggers.values().filter(t => t.tile_id == this.g.objects.get("player").tile_id).forEach(t => {
                if(RECT_INTERSECTION(t.x, t.y, t.w, t.h, this.mousePos[0]-15, this.mousePos[1]-15, 30, 30)) {
                    t.onClick(t);
                };
            })
            g.queue.push({
                "type": "input",
                "method": "click",
                "content": {"x": this.mousePos[0], "y": this.mousePos[1]}
            });
        })
    };

    keyIsDown(code) {
        return this.keysDown.has(code);
    }

    getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect(); // Get absolute position
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }
}

class Sound {
    constructor(am, src) {
        this.am = am;
        this.src = src;
        this.obj = new Audio(src);
        this.volume = 1;
    }

    async play() {
        let clone = this.obj.cloneNode(true);
        clone.volume = this.volume;
        return clone.play();
    }
}

class AudioManager {
    constructor(game) {
        this.game = game;
        this.sounds = new Map();
    }

    registerSound(id, src) {
        let s = new Sound(this, src);
        this.sounds.set(id, s);
        return s;
    }

    changeVolume(id, vol) {
        if(vol == -1) return;
        this.sounds.get(id).volume = vol;
    }

    playSound(id) { this.sounds.get(id).play(); }
}

class Game {
    constructor() {
        this.renderer = new Renderer();
        this.input = new InputManager(this);

        let speech_window = this.renderer.createWindow("speech", 1, 50, 550, 700, 200);
        speech_window.onRender = (w) => {
            w.canvas.fillStyle = "white";
            w.canvas.strokeStyle = "black";
            w.canvas.lineWidth = 10;
            w.canvas.fillRect(0, 0, w.width, w.height);
            w.canvas.strokeRect(0, 0, w.width, w.height);

            w.canvas.lineWidth = 5;
            w.canvas.beginPath();
            w.canvas.moveTo(190, 20);
            w.canvas.lineTo(190, 180);
            w.canvas.stroke();

            w.canvas.drawImage(Window.resizeImage(w.renderer.images[this.extra_data.speech_portrait] || w.renderer.images["none.png"], 150, 150), 20, 22);

            w.canvas.fillStyle = "black";
            w.canvas.font = "30px Arial"; 
            w.canvas.strokeStyle = "red";
            w.canvas.lineWidth = 1;
            w.canvas.textBaseline = "top";
            w.drawText(this.extra_data.speech_next_line, 200, 40, 450);
        };

        let inv_size = 100;
        let restricted_slots = [[0, 0], [5, 1], [3, 2], [1, 2]];
        let inventory_window = this.renderer.createWindow("inv", 0, 50, 50, 700, 300);
        inventory_window.onRender = (w) => {
            w.canvas.fillStyle = "white";
            w.canvas.strokeStyle = "black";
            w.canvas.lineWidth = 10;
            w.canvas.fillRect(0, 0, w.width, w.height);
            w.canvas.strokeRect(0, 0, w.width, w.height);

            w.canvas.beginPath();
            w.canvas.lineWidth = 1;

            let mP = this.input.mousePos;
            let mX = mP[0] - w.x; let mY = mP[1] - w.y;

            let desiredSize = inv_size;

            const cols = Math.round(w.width / desiredSize);
            const rows = Math.round(w.height / desiredSize);
            const stepX = w.width / cols;
            const stepY = w.height / rows;
            let counter = 0;
            let total = cols*rows;
          
            for (let i = 0; i <= cols; i++) {
                const x = i * stepX;
                w.canvas.moveTo(Math.round(x) + 0.5, 0);
                w.canvas.lineTo(Math.round(x) + 0.5, w.height);
            }
            
            for (let j = 0; j <= rows; j++) {
                const y = j * stepY;
                w.canvas.moveTo(0, Math.round(y) + 0.5);
                w.canvas.lineTo(w.width, Math.round(y) + 0.5);
            }

            restricted_slots.forEach(s => {
                const cellX = s[0] * stepX;
                const cellY = s[1] * stepY;
                w.canvas.fillStyle = "rgba(0, 0, 0, 0.3)";
                w.canvas.fillRect(cellX, cellY, stepX, stepY);
            })

            if (mX >= 0 && mX <= w.width && mY >= 0 && mY <= w.height) {
                const colIndex = Math.floor(mX / stepX); const rowIndex = Math.floor(mY / stepY);
                const cellX = colIndex * stepX; const cellY = rowIndex * stepY;
                if(restricted_slots.find(s => s[0] == colIndex && s[1] == rowIndex) == undefined) {
                    w.canvas.fillStyle = "rgba(0, 150, 255, 0.3)";
                    w.canvas.fillRect(cellX, cellY, stepX, stepY);
                }
            }
          
            w.canvas.stroke();
        };
        this.input.onButtonPress["Tab"] = ((g) => { inventory_window.visible = !inventory_window.visible; });

        this.audio = new AudioManager(this);
        this.objects = new Map();
        this.triggers = new Map();
        this.createObject("player", "../res/game/player.png", "start");
        this.players = new Array();
        this.lastUpdateTime = Date.now();
        this.visible_objects = new Array();
        this.visible_triggers = new Array();
        this.old_extra_data = {};
        this.extra_data = {};
        this.extra_data.speech_window = speech_window;
        this.player_data = {};
        this.queue = [];
        this.ws = new WebSocket(location.host.includes("66.65.25.15")
        ? `${location.protocol}//${location.host}/subdomain=api/game/live` : `${location.protocol}//api.${location.host}/game/live`);
        this.ws.addEventListener("message", async d => {
            await this.resolve(JSON.parse(d.data));
        }); this.ws.addEventListener("open", () => {
            this.ws.send(JSON.stringify({
                "type": "system",
                "method": "auth",
                "content": JSON.parse(window.localStorage.getItem("user"))
            }))
        });
    }

    reset() {
        this.ws = new WebSocket(location.host.includes("66.65.25.15")
        ? `${location.protocol}//${location.host}/subdomain=api/game/live` : `${location.protocol}//api.${location.host}/game/live`);
        this.ws.addEventListener("message", async d => {
            await this.resolve(JSON.parse(d.data));
        }); this.ws.addEventListener("open", () => {
            this.ws.send(JSON.stringify({
                "type": "system",
                "method": "auth",
                "content": JSON.parse(window.localStorage.getItem("user"))
            }))
        })
        this.objects = new Map();
        this.createObject("player", "../res/game/player.png");
        this.players = new Array();
        this.lastUpdateTime = 0;
    }

    async resolve(json) {
        switch(json.type) {
            case "state":
                switch(json.method) {
                    case "update":
                        let player = this.objects.get("player")
                        let serverFPS = Math.round(1000/((Date.now() - this.lastUpdateTime)));
                        let latency = clamp(Math.round(((Date.now() - this.lastUpdateTime))), 0, 1000);
                        let desync_amt = document.getElementById("desync").value;
                        if(Math.abs(player.x - json.content.you.x) > desync_amt) player.x = json.content.you.x;
                        if(Math.abs(player.y - json.content.you.y) > desync_amt) player.y = json.content.you.y;

                        this.player_data = json.content.you.data;

                        document.getElementById("pc").textContent = `Player Count: ${json.content.info["player-count"]}`;

                        if(document.getElementById("di").checked) {
                            document.getElementById("pp").style.display = "block";
                            document.getElementById("wp").style.display = "block";
                            document.getElementById("id").style.display = "block";
                            document.getElementById("sf").style.display = "block";
                            document.getElementById("mp").style.display = "block";
                            document.getElementById("rp").style.display = "block";
                            document.getElementById("oc").style.display = "block";
                            document.getElementById("pd").style.display = "block";

                            document.getElementById("id").textContent = `Instance ID: ${json.content.info["instance-id"]}`;
                            document.getElementById("pp").textContent = `Player Position: (${player.x}, ${player.y})`;
                            document.getElementById("rp").textContent = `Reported Player Position: ${json.content.you.x}, ${json.content.you.y})`
                            document.getElementById("wp").textContent = `Tile ID: "${json.content.you.tile_id}"`;
                            document.getElementById("lc").textContent = `Latency: ${latency}ms`;
                            document.getElementById("sf").textContent = `Server FPS: ${serverFPS}`;
                            document.getElementById("oc").textContent = `Object Count: ${this.objects.size - 1}`; // player is an obj
                            document.getElementById("mp").textContent = `Mouse Position: (${this.input.mousePos[0]}, ${this.input.mousePos[1]})`;
                            document.getElementById("pd").innerHTML = `latest data packet: <br>${JSON.stringify(this.player_data, null, 2)}`;
                        } else {
                            document.getElementById("pp").style.display = "none";
                            document.getElementById("wp").style.display = "none";
                            document.getElementById("id").style.display = "none";
                            document.getElementById("sf").style.display = "none";
                            document.getElementById("mp").style.display = "none";
                            document.getElementById("rp").style.display = "none";
                            document.getElementById("oc").style.display = "none";
                            document.getElementById("pd").style.display = "none";
                        }

                        json.content.objects.forEach(o => {
                            let obj = this.objects.get(o.name);
                            obj.tile_id = o.tile_id;
                            obj.x = o.x; obj.y = o.y;
                            let img = this.renderer.images[o.name];
                            if(img && img.complete && img.naturalWidth !== 0) {
                                if(obj.scale != o.scale) {
                                    this.renderer.resizeImageProportionally(o.name, o.scale);
                                    obj.scale = o.scale;
                                };
                            };
                        }); 

                        json.content.triggers.forEach(o => {
                            let t = this.triggers.get(o.id);
                            t.x = o.x; t.y = o.y; t.w = o.w; t.h = o.h;
                            t.tile_id = o.tile_id;
                            t.data = o.data;
                        });

                        player.tile_id = json.content.you.tile_id;

                        let seen_players = new Array();
                        json.content.players.forEach(p => { seen_players.push(p); })
                        this.players.map(p => p.id).forEach(p => {
                            if(seen_players.map(p2 => p2.id).includes(p.id)) return;
                            delete this.players[p];
                        })
                        this.players = seen_players;
                        this.lastUpdateTime = Date.now();
                        break;
                } break;
            case "object":
                switch(json.method) {
                    case "create": this.createObject(json.content.name, json.content.src, json.content.tile_id, json.content.x, json.content.y); break;
                    case "move":
                        if(json.content.set) { this.objects.get(json.content.name).x = json.content.position.x; this.objects.get(json.content.name).y = json.content.position.y; }
                        else { this.objects.get(json.content.name).x += json.content.position.x; this.objects.get(json.content.name).y += json.content.position.y; }
                        break;
                    case "destroy": this.destroy(json.content.name); break;
                }; break;
            case "trigger":
                switch(json.method) {
                    case "create": 
                        let t = this.createTrigger(json.content.id, "tag", json.content.x, json.content.y, json.content.w, json.content.h); 
                        t.onEnter = TRIGGER_FUNCTIONS[json.content.functions.enter || ""] || TRIGGER_FUNCTIONS[""];
                        t.onExit = TRIGGER_FUNCTIONS[json.content.functions.exit || ""] || TRIGGER_FUNCTIONS[""];
                        t.onTick = TRIGGER_FUNCTIONS[json.content.functions.tick || ""] || TRIGGER_FUNCTIONS[""];
                        t.onClick = TRIGGER_FUNCTIONS[json.content.functions.click || ""] || TRIGGER_FUNCTIONS[""];
                        t.tile_id = json.content.tile_id;
                        t.id = json.content.id;
                        break;
                } break;
            case "rendering":
                switch(json.method) {
                    case "hide": this.renderer.hidden = true; break;
                    case "unhide": this.renderer.hidden = false; break;
                    case "background": await this.renderer.registerImage("bg", json.content.src).then(() => this.renderer.setBackground("bg")); break;
                } break;
            case "system":
                switch(json.method) {
                    case "auth": 
                        if(json.content == "NO") {
                            alert("make an account"); window.location.href = `${location.protocol}//${location.host}/?account`; 
                        } else if(json.content == "ALR") {
                            alert("already connected"); window.location.href = `${location.protocol}//${location.host}`; 
                        } break;
                    case "exit": this.renderer.hidden = true; alert("connected from another session"); window.location.href = `${location.protocol}//${location.host}`; break;
                } break;
        };
    }

    init() {
        this.renderer.init();
    }

    destroy(name) {
        return this.objects.delete(name);
    }

    createObject(name, src, tile_id, x, y) {
        let obj = new Object(name, this.renderer, src);
        if(x) obj.x = x; if(y) obj.y = y;
        if(tile_id) obj.tile_id = tile_id;
        this.objects.set(name, obj);
        return obj;
    }

    createTrigger(id, tag, x, y, w, h) {
        let t = new Trigger(name, tag, this, x, y, w ,h);
        this.triggers.set(id, t);
        return t;
    }

    update() {
        let player = this.objects.get("player");
        if(Date.now() - this.lastUpdateTime > (5*1000)) {
            this.renderer.hidden = true;
            document.getElementById("loading").textContent = `Connection Problems`
            document.getElementById("loading").style.display = "block";
            return;
        }
        let dv = [0, 0]; let speed_mult = 3;
        this.visible_triggers.forEach(t => {
            t.onTick(t);
            let was_in = t.inside
            t.inside = t.intersects(player);
            if(was_in && !t.inside) t.onExit(t);
            if(!was_in && t.inside) t.onEnter(t);
        })
        if(this.input.keyIsDown("KeyW") || this.input.keyIsDown("ArrowUp"   )) dv[1] -= 1;
        if(this.input.keyIsDown("KeyA") || this.input.keyIsDown("ArrowLeft" )) dv[0] -= 1;
        if(this.input.keyIsDown("KeyS") || this.input.keyIsDown("ArrowDown" )) dv[1] += 1;
        if(this.input.keyIsDown("KeyD") || this.input.keyIsDown("ArrowRight")) dv[0] += 1;
        if(this.extra_data.no_movement) dv = [0, 0];
        let old_x = player.x;
        let old_y = player.y;
        let new_x = old_x + dv[0] * speed_mult;
        let new_y = old_y + dv[1] * speed_mult;
        new_x = Math.round(new_x);
        new_y = Math.round(new_y);
        let collidesX = false;
        let collidesY = false;

        this.objects.values().filter(o => this.visible_objects.includes(o.name) && o != player).forEach(o => {
            player.x = new_x; player.y = old_y;
            if (player.intersects(o)) collidesX = true;
            player.x = old_x; player.y = new_y;
            if (player.intersects(o)) collidesY = true;
        });
        player.x = collidesX ? old_x : new_x;
        player.y = collidesY ? old_y : new_y;

        let can_phase = true;

        if(!this.player_data.wallPhasing) {
            if(this.extra_data.wallPhasingDecay > 0) {
                this.extra_data.wallPhasingDecay -= 1;
            } else {
                can_phase = false;
            }
        } else {
            this.extra_data.wallPhasingDecay = 3;
        }

        player.y = clamp(player.y, can_phase ? -1000 : 0, can_phase ? 1000 : 725);
        player.x = clamp(player.x, can_phase ? -1000 : 0, can_phase ? 1000 : 725);

        this.queue.forEach(o => {
            this.ws.send(JSON.stringify(o));
        })
        this.queue = [];

        let send = false;

        let state = {
            "type": "state",
            "method": "update",
            "content": {
                "keys": Array.from(this.input.keysDown.keys())
            }
        };
        state.content.extra_data = this.extra_data;

        let send_counter = 6;

        if(this.extra_data.send_counter == undefined) { this.extra_data.send_counter = send_counter; }

        if(this.extra_data.send_counter == 0) {
            this.extra_data.send_counter = send_counter;
            send = true;
        } else {
            this.extra_data.send_counter -= 1;
        }

        if(this.old_extra_data != this.extra_data) { state.content.extra_data = this.extra_data; send = true;}

        if(this.input.keysDown.size > 0) { send = true; }

        if(send) { this.ws.send(JSON.stringify(state)); }

        this.old_extra_data = this.extra_data;
    }

    draw() {
        let player = this.objects.get("player");
        this.renderer.showBoundingBoxes = document.getElementById("sb").checked;
        this.renderer.clear();
        if(this.renderer.hidden) return;
        if(this.renderer.background != "") this.renderer.drawImage(this.renderer.background, 0, 0);
        this.players.forEach(p => {
            if(document.getElementById("sp").checked) this.renderer.drawImage("player", p.x, p.y);
            else this.renderer.drawBoundingBox("player", p.x, p.y, "pink")
        })
        this.objects.values().filter(o => o.name != "player" && o.tile_id == player.tile_id).forEach(o => {
            if(document.getElementById("so").checked) o.draw();
            else if(o.visible) this.renderer.drawBoundingBox(o.name, o.x, o.y, o.collides ? "red" : "blue");
        });
        this.triggers.values().filter(t => t.tile_id == player.tile_id).forEach(t => {
            t.draw();
        });
        player.draw();

        this.renderer.drawWindows();
        if(this.renderer.showBoundingBoxes) this.renderer.drawBoundBoxWH(this.input.mousePos[0]-15, this.input.mousePos[1]-15, 30, 30, "cyan")
    }
}

class Object {
    constructor(name, renderer, src) {
        this.r = renderer;
        this.name = name;
        this.visible = true;
        if(!src) this.src = "";
        else this.src = src;
        this.width = undefined; this.height = undefined;
        if(this.src) this.r.registerImage(name, this.src).then(w => {
            this.width = w.width; this.height = w.height;
        });
        this.x = 0;
        this.y = 0;
        this.tile_id = "";
        this.scale = 1;
        this.collides = true;
    }

    draw() {
        if(this.visible) this.r.drawImage(this.name, this.x, this.y);
    }

    intersects(other) {
        if(this.width == undefined || this.height == undefined 
            || other.width == undefined || other.height == undefined) return undefined;
        return !(
            this.x + this.width < other.x || 
            this.y + this.height < other.y || 
            this.x > other.x + (other.width*other.scale) || 
            this.y > other.y + (other.height*other.scale)
        )
    }
}

class Trigger {
    constructor(name, tag, game, x, y, w, h, tile_id) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.tile_id = tile_id;
        this.visible = true;
        this.active = true;
        this.inside = false;
        this.game = game;
        this.name = name;
        this.tag = tag;
        this.id = "";
        this.data = {};
        this.onEnter = function(t) {};
        this.onExit = function(t) {};
        this.onTick = function(t) {};
        this.onClick = function(t) {};
    }

    intersects(other) {
        if(this.width == undefined || this.height == undefined 
            || other.width == undefined || other.height == undefined) return undefined;
        return !(
            this.x + this.width < other.x || 
            this.y + this.height < other.y || 
            this.x > other.x + (other.width*other.scale) || 
            this.y > other.y + (other.height*other.scale)
        )
    }

    draw() {
        if(this.visible && this.game.renderer.showBoundingBoxes) {
            if(this.active) this.game.renderer.ctx.strokeStyle = "green";
            else this.game.renderer.ctx.strokeStyle = "blue";
            this.game.renderer.ctx.lineWidth = 2;
            this.game.renderer.ctx.strokeRect(this.x, this.y, this.width, this.height);
            if(this.data.radius) {
                this.game.renderer.circleBoundingBox(this.x+(this.width/3), this.y+(this.width/3), this.data.radius, "lime");
            }
        }
    }
}

class Window {
    constructor(r, z = 0, width, height, x, y) {
        this.renderer = r;
        this.z_index = z;
        this.width = width;
        this.height = height;
        this.canvas_obj = document.createElement("canvas");
        this.canvas_obj.width = width;
        this.canvas_obj.height = height;
        this.canvas = this.canvas_obj.getContext("2d");
        this.visible = false;
        this.x = x;
        this.y = y;
        this.onRender = function(w) {};
        this.onClick = function(w, x, y) {};
        this.renderer.canvas.addEventListener("click", e => {
            let c = this.renderer.canvas;
            const rect = c.getBoundingClientRect(); // Get absolute position
            let x = e.clientX - rect.left; 
            let y = e.clientY - rect.top;
            if(RECT_INTERSECTION(this.x, this.y, this.width, this.height, x-15, y-15, 30, 30)) {
                this.onClick(this, x, y);
            }
        });
    }

    static resizeImage(image, w, h) {
        let img = image;
        if(!img.complete || img.naturalWidth === 0) return;
        let width = img.width;
        let height = img.height;

        let maxWidth = w
        let maxHeight = h
    
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        if(width == 0 || height == 0) return false;
        
        const newWidth = width * ratio;
        const newHeight = height * ratio;
    
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        canvas.width = Math.round(newWidth);
        canvas.height = Math.round(newHeight);
        
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        return canvas;
    }

    static getLines(ctx, text, maxWidth) {
        var words = text.split(" ");
        var lines = [];
        var currentLine = words[0];
    
        for (var i = 1; i < words.length; i++) {
            var word = words[i];
            var width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    drawText(text, x, y, maxWidth) {
        let lines = Window.getLines(this.canvas, text, maxWidth);
        for(let z = 0; z < lines.length; z++) {
            let l = lines[z];
            let metrics = this.canvas.measureText(l);
            let height = ((metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent)-25) + (z*40);
            this.canvas.fillText(l, x, y+height, maxWidth);
        }
    }

    draw() {
        this.canvas.clearRect(0, 0, this.width, this.height);
        if(!this.visible) return;
        this.onRender(this);
        this.renderer.ctx.drawImage(this.canvas_obj, this.x, this.y);
        if(this.renderer.showBoundingBoxes) this.renderer.drawBoundBoxWH(this.x, this.y, this.width, this.height, "violet")
    }
}

class Renderer {
    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = 800//window.innerWidth*CANVAS_BOUNDS_SCALING;
        this.canvas.height = 800//window.innerHeight*CANVAS_BOUNDS_SCALING;
        this.canvas.classList.add("canvas");
        this.canvas.textContent = "you can't see the canvas for some reason, prob too old (unc)";
        this.ctx = this.canvas.getContext("2d");
        this.images = {};
        this.originalImages = {};
        this.background = "";
        this.hidden = true;
        this.showBoundingBoxes = false;
        this.windows = new Map();
        this.windowsOpen = false;
    }

    setBackground(name) {
        this.background = name;
    }

    init() { document.getElementById("container").appendChild(this.canvas); }

    async registerImage(name, url) {
        return new Promise((resolve, reject) => {
            let img = new Image();
            img.onload = () => {
                this.images[name] = img;
                this.originalImages[name] = img;
                resolve(img);
            };
            img.onerror = () => reject();
            img.src = url;
        });
    }

    resizeImageProportionally(name, per) {
        let img = this.originalImages[name];
        if(!img.complete || img.naturalWidth === 0) return;
        let width = img.width;
        let height = img.height;

        let maxWidth = width*per
        let maxHeight = height*per
    
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        if(width == 0 || height == 0) return false;
        
        const newWidth = width * ratio;
        const newHeight = height * ratio;
    
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        canvas.width = Math.round(newWidth);
        canvas.height = Math.round(newHeight);
        
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        this.images[name] = canvas;
        return true;
    }

    circleBoundingBox(x, y, r, color) {
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, 2*Math.PI);
        this.ctx.stroke();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getPercentOnCanvas(axis, per) { if(axis == "x") return (this.canvas.width) * (per/100); else return (this.canvas.height) * (per/100); }

    drawImage(name, x, y) { if(!this.images[name]) return; this.ctx.drawImage(this.images[name], x, y); if(this.showBoundingBoxes && name != this.background) this.drawBoundingBox(name, x, y); }

    drawBoundBoxWH(x, y, w, h, color) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, w, h)
    }

    drawBoundingBox(name, x, y, color = "red") { 
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, this.images[name].width, this.images[name].height)
    }

    createWindow(id, z_index, x, y, width, height) {
        let w = new Window(this, z_index, width, height, x, y);
        this.windows.set(id, w);
        return w;
    }

    drawWindows() {
        let keys = [...this.windows.keys()]
        let windows = [];
        keys.forEach(id => {
            let window = this.windows.get(id);
            windows.push(window);
        })
        windows.sort((a, b) => a.z_index - b.z_index);
        this.windowsOpen = windows.length > 0;
        windows.forEach(w => { w.draw(); })
    }
}

let imgs = [];

function preloadImagesWithCallback(imageUrls) {
    const promises = imageUrls.map(src => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { resolve(img); imgs.push([src, img]); updateLoadingBar(src.replace("res/game/", ""));}
        img.onerror = () => reject(src); 
        img.src = src;
    }));

    return Promise.all(promises);
}
let g;

document.getElementById("desync-t").textContent = document.getElementById("desync").value
document.getElementById("desync").addEventListener("input", () => {
    document.getElementById("desync-t").textContent = document.getElementById("desync").value
})
document.getElementById("stuck").addEventListener("click", () => {
    g.ws.send(JSON.stringify({"type": "input", "method": "stuck"}));
})
const textAsCheck = (t_id, c_id) => {
    document.getElementById(t_id).addEventListener("click", () => {
        document.getElementById(c_id).checked = !document.getElementById(c_id).checked
    });
}
textAsCheck("sot", "so");
textAsCheck("dit", "di");
textAsCheck("spt", "sp");
textAsCheck("sbb", "sb");

let files = await fetch(getApiLink("/game/files"));
files = await files.json();

let images = files.filter(f => f.includes(".png") || f.includes(".webp"));
let sounds = files.filter(f => f.includes(".mp3"));

let progress = 0;
let total = images.length + sounds.length;

function updateLoadingBar(src) {
    let t = document.getElementById("loading"); let t2 = document.getElementById("loading2");
    progress += 1;
    t.textContent = `LOADING: ${progress}/${total}`;
    t2.textContent = `"${src}"`
}

preloadImagesWithCallback(images).then(() => {
    g = new Game();
    g.init();
    imgs.forEach(i => {
        let src = i[0];
        let img = i[1];
        g.renderer.images[src.replaceAll("res/game/", "")] = img;
    });
    sounds.forEach(s => {
        g.audio.registerSound(s.replace("res/game/", ""), s);
        updateLoadingBar(s.replace("res/game/", ""));
    });
    document.getElementById("loading2").style.display = "none";
    document.getElementById("loading").textContent = "Starting"
    setInterval(() => { g.update(); g.draw(); }, (1000/FPS));
    document.getElementById("loading").style.display = "none";
});