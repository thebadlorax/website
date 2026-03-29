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
        if(DISTANCE(t.x+(t.width/3), t.y+(t.width/3), player.x, player.y) > t.data.radius) return;
        let lines = t.data.lines;
        let index = 0;
        t.game.extra_data.speech_portrait = t.data.portrait;
        t.game.extra_data.speech_next_line = lines[0];
        t.game.extra_data.speech_window.visible = true;
        t.game.extra_data.no_movement = true;
        t.game.extra_data.speech_window.onClick = (w, x, y) => {
            index += 1;
            if(index >= lines.length) {
                t.game.extra_data.speech_window.visible = false;
                t.game.extra_data.no_movement = false;
                return;
            };
            t.game.extra_data.speech_next_line = lines[index];
        } 
    }
}

const RECT_INTERSECTION = (x1, y1, w1, h1, x2, y2, h2, w2) => {
    return !(
        x1 + w1 < x2 || 
        y1 + h1 < y2 || 
        x1 > x2 + w2 || 
        y1 > y2 + w2
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
        this.keysDown = {}; 
        this.g = game;
        this.mousePos = [0, 0];
        window.addEventListener("keydown", e => this.keysDown[e.code] = true); 
        window.addEventListener("keyup", e => delete this.keysDown[e.code]);
        this.g.renderer.canvas.addEventListener('mousemove', (event) => {
            const mousePos = this.getMousePos(this.g.renderer.canvas, event);
            this.mousePos[0] = mousePos.x; this.mousePos[1] = mousePos.y;
        });
        this.g.renderer.canvas.addEventListener("click", () => {
            this.g.visible_triggers.forEach(t => {
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
        return this.keysDown[code];
    }

    getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect(); // Get absolute position
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }
}

class Game {
    constructor() {
        this.renderer = new Renderer();
        let speech_window = this.renderer.createWindow("speech", 0, 50, 550, 700, 200);
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

            w.canvas.drawImage(Window.resizeImage(w.renderer.images[this.extra_data.speech_portrait], 150, 150), 20, 22);

            w.canvas.fillStyle = "black";
            w.canvas.font = "30px Arial"; 
            w.canvas.strokeStyle = "red";
            w.canvas.lineWidth = 1;
            w.canvas.textBaseline = "top";
            w.canvas.fillText(this.extra_data.speech_next_line, 200, 40, 450);
        };
        this.objects = new Map();
        this.triggers = new Map();
        this.createObject("player", "../res/game/player.png", "start");
        this.players = new Array();
        this.lastUpdateTime = Date.now();
        this.visible_objects = new Array();
        this.visible_triggers = new Array();
        this.extra_data = {};
        this.extra_data.speech_window = speech_window;
        this.player_data = {};
        this.input = new InputManager(this);
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

                        this.visible_objects = new Array();
                        json.content.objects.forEach(o => {
                            let obj = this.objects.get(o.name);
                            this.visible_objects.push(o.name)
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

                        this.visible_triggers = new Array();
                        json.content.triggers.forEach(o => {
                            let t = this.triggers.get(o.id);
                            t.x = o.x; t.y = o.y; t.w = o.w; t.h = o.h;
                            t.tile_id = o.tile_id;
                            t.data = o.data;
                            this.visible_triggers.push(t);
                        });

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

        this.ws.send(JSON.stringify({
            "type": "state",
            "method": "update",
            "content": {
                "keys": this.extra_data.no_movement ? {} : this.input.keysDown
            }
        }))
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
        this.objects.values().filter(o => o.name != "player" && this.visible_objects.includes(o.name)).forEach(o => {
            if(document.getElementById("so").checked) o.draw();
            else if(o.visible) this.renderer.drawBoundingBox(o.name, o.x, o.y, o.collides ? "red" : "blue");
        });
        this.visible_triggers.forEach(t => {
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

    draw() {
        this.canvas.clearRect(0, 0, this.width, this.height);
        if(!this.visible) return;
        this.onRender(this);
        this.renderer.ctx.drawImage(this.canvas_obj, this.x, this.y);
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
        windows.forEach(w => { w.draw(); })
    }
}

let imgs = [];

function preloadImagesWithCallback(imageUrls) {
    let total = imageUrls.length; let progress = 0; let t = document.getElementById("loading"); let t2 = document.getElementById("loading2")
    t.textContent = `LOADING: ${progress}/${total}`
    const promises = imageUrls.map(src => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { resolve(img); imgs.push([src, img]); progress += 1; t.textContent = `LOADING: ${progress}/${total}`; t2.textContent = `"${src.replace("res/game/", "")}"`}
        img.onerror = () => reject(src); 
        img.src = src;
    }));

    return Promise.all(promises);
}

document.getElementById("desync-t").textContent = document.getElementById("desync").value
document.getElementById("desync").addEventListener("input", () => {
    document.getElementById("desync-t").textContent = document.getElementById("desync").value
})
const textAsCheck = (t_id, c_id) => {
    document.getElementById(t_id).addEventListener("click", () => {
        document.getElementById(c_id).checked = !document.getElementById(c_id).checked
    });
}
//textAsCheck("adt", "ad");
textAsCheck("sot", "so");
textAsCheck("dit", "di");
textAsCheck("spt", "sp");
textAsCheck("sbb", "sb");

/*const ad_handler = () => {
    if(!document.getElementById("ad").checked) document.getElementById("desync-t").textContent = document.getElementById("desync").value
}*/

//document.getElementById("adt").addEventListener("click", ad_handler)
//document.getElementById("ad").addEventListener("click", ad_handler)

let images = await fetch(getApiLink("/game/files"));
images = await images.json();

let g;
preloadImagesWithCallback(images).then(() => {
    document.getElementById("loading2").style.display = "none";
    document.getElementById("loading").textContent = "Connecting"
    g = new Game();
    g.init();
    imgs.forEach(i => {
        let src = i[0];
        let img = i[1];
        g.renderer.images[src.replaceAll("res/game/", "")] = img;
    })
    document.getElementById("loading").textContent = "Starting"
    setInterval(() => { g.update(); g.draw(); }, (1000/FPS));
    document.getElementById("loading").style.display = "none";
})