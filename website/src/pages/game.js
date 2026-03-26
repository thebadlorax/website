/**
 * author thebadlorax
 * created on 23-03-2026-14h-33m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { clamp } from "./common.js";
import { getApiLink } from "./common.js";

//const CANVAS_BOUNDS_SCALING = .95;
let FPS = 60;
let loop_id;
let update_rate = 20;

document.addEventListener("keydown", function(e) {
    // Keycodes for arrow keys: Left (37), Up (38), Right (39), Down (40)
    if([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
      e.preventDefault(); // This stops the default scroll behavior
    }
  }, false);

class InputManager {
    constructor() { 
        this.keysDown = {}; 
        window.addEventListener("keydown", e => this.keysDown[e.code] = true); 
        window.addEventListener("keyup", e => delete this.keysDown[e.code]);
    };

    keyIsDown(code) {
        return this.keysDown[code];
    }
}

class Game {
    constructor() {
        this.renderer = new Renderer();
        this.objects = new Map();
        this.players = new Array();
        this.lastUpdateTime = 0;
        this.input = new InputManager();
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
    }

    async resolve(json) {
        switch(json.type) {
            case "state":
                switch(json.method) {
                    case "update":
                        let player = this.objects.get("player")

                        let serverFPS = Math.round(1000/((Date.now() - this.lastUpdateTime)));
                        let latency = clamp(Math.round(((Date.now() - this.lastUpdateTime))), 0, 1000)

                        if(document.getElementById("ad").checked) {
                            let auto_ds = clamp(latency + 15, 10, 150);
                            document.getElementById("desync").disabled = true;
                            document.getElementById("desync").value = auto_ds;
                            document.getElementById("desync-t").textContent = document.getElementById("desync").value
                        } else {
                            document.getElementById("desync").disabled = false;
                        }
                        let desync_amt = document.getElementById("desync").value;
                        if(Math.abs(player.x - json.content.you.x) > desync_amt) player.x = json.content.you.x;
                        if(Math.abs(player.y - json.content.you.y) > desync_amt) player.y = json.content.you.y;

                        document.getElementById("id").textContent = `Instance ID: ${json.content.info["instance-id"]}`;
                        document.getElementById("pc").textContent = `Player Count: ${json.content.info["player-count"]}`;
                        document.getElementById("pp").textContent = `Player Position: ${json.content.you.x}, ${json.content.you.y}`;
                        document.getElementById("wp").textContent = `World Position: ${json.content.you.w_x}, ${json.content.you.w_y}`;
                        document.getElementById("lc").textContent = `Latency: ${latency}ms`;
                        document.getElementById("sf").textContent = `Server FPS: ${serverFPS}`;

                        if(document.getElementById("di").checked) {
                            document.getElementById("pp").style.display = "block";
                            document.getElementById("wp").style.display = "block";
                            document.getElementById("id").style.display = "block";
                            document.getElementById("sf").style.display = "block";
                        } else {
                            document.getElementById("pp").style.display = "none";
                            document.getElementById("wp").style.display = "none";
                            document.getElementById("id").style.display = "none";
                            document.getElementById("sf").style.display = "none";
                        }

                        json.content.objects.forEach(o => {
                            if(this.objects.get(o.name).w_x != json.content.you.w_x || this.objects.get(o.name).w_y != json.content.you.w_y) this.objects.get(o.name).visible = false;
                            else this.objects.get(o.name).visible = true;
                            this.objects.get(o.name).x = o.x; this.objects.get(o.name).y = o.y;
                            if(this.renderer.images[o.name].width != 0) {
                                if(this.objects.get(o.name).scale != o.scale) {
                                    this.renderer.resizeImageProportionally(o.name, o.scale);
                                    this.objects.get(o.name).scale = o.scale;
                                }
                            }
                        }); 

                        let seen_players = new Array();
                        json.content.players.forEach(p => { seen_players.push(p); })
                        this.players.map(p => p.id).forEach(p => {
                            if(seen_players.map(p2 => p2.id).includes(p.id)) return;
                            delete this.players[p];
                        })
                        this.players = seen_players;
                        this.lastUpdateTime = Date.now()
                        break;
                } break;
            case "object":
                switch(json.method) {
                    case "create": this.createObject(json.content.name, json.content.src, json.content.w_x, json.content.w_y, json.content.x, json.content.y); break;
                    case "move":
                        if(json.content.set) { this.objects.get(json.content.name).x = json.content.position.x; this.objects.get(json.content.name).y = json.content.position.y; }
                        else { this.objects.get(json.content.name).x += json.content.position.x; this.objects.get(json.content.name).y += json.content.position.y; }
                        break;
                    case "destroy": this.destroy(json.content.name); break;
                }; break;
            case "rendering":
                switch(json.method) {
                    case "hide": this.renderer.hidden = true; break;
                    case "unhide": this.renderer.hidden = false; break;
                    case "background": await this.renderer.registerImage("bg", json.content.src).then(() => this.renderer.setBackground("bg")); break;
                } break;
            case "system":
                switch(json.method) {
                    case "auth": alert("make an account"); window.location.href = `${location.protocol}//${location.host}/?account`; break;
                } break;
        };
    }

    init() {
        this.renderer.init();
        this.createObject("player", "../res/game/player.png");
    }

    destroy(name) {
        return this.objects.delete(name);
    }

    createObject(name, src, w_x, w_y, x, y) {
        let obj = new Object(name, this.renderer, src);
        if(x) obj.x = x; if(y) obj.y = y;
        if(w_x) obj.w_x = w_x; if(w_y) obj.w_y = w_y;
        this.objects.set(name, obj);
        return obj;
    }

    update() {
        if(Date.now() - this.lastUpdateTime > (5*1000)) {
            this.renderer.hidden = true;
            document.getElementById("loading").textContent = `Connection Problems`
            document.getElementById("loading").style.display = "block";
            return;
        } else {
            this.renderer.hidden = false;
            document.getElementById("loading").style.display = "none";
        }
        let dv = [0, 0]; let speed_mult = 3;
        let player = this.objects.get("player");
        if(this.input.keyIsDown("KeyW") || this.input.keyIsDown("ArrowUp"   )) dv[1] -= 1;
        if(this.input.keyIsDown("KeyA") || this.input.keyIsDown("ArrowLeft" )) dv[0] -= 1;
        if(this.input.keyIsDown("KeyS") || this.input.keyIsDown("ArrowDown" )) dv[1] += 1;
        if(this.input.keyIsDown("KeyD") || this.input.keyIsDown("ArrowRight")) dv[0] += 1;
        player.x += dv[0] * speed_mult;
        player.y += dv[1] * speed_mult;
        player.x = clamp(player.x, 0, 725);
        this.ws.send(JSON.stringify({
            "type": "state",
            "method": "update",
            "content": {
                "keys": this.input.keysDown
            }
        }))
    }

    draw() {
        this.renderer.clear();
        if(this.renderer.hidden) return;
        if(this.renderer.background != "") this.renderer.drawImage(this.renderer.background, 0, 0);
        if(document.getElementById("sp").checked) {
            this.players.forEach(p => {
                this.renderer.drawImage("player", p.x, p.y);
            })
        }
        this.objects.get("player").draw();
        if(document.getElementById("so").checked) {
            this.objects.values().filter(o => o.name != "player").forEach(o => {
                o.draw();
            })
        }
        
    }
}

class Object {
    constructor(name, renderer, src) {
        this.r = renderer;
        this.name = name;
        this.visible = true;
        if(!src) this.src = "";
        else this.src = src;
        if(this.src) this.r.registerImage(name, this.src);
        this.x = 0;
        this.y = 0;
        this.w_x = 0;
        this.w_y = 0;
        this.scale = 1;
    }

    draw() {
        if(this.visible) this.r.drawImage(this.name, this.x, this.y);
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
        this.background = "";
        this.hidden = true;
    }

    setBackground(name) {
        this.background = name;
    }

    init() { document.getElementById("container").appendChild(this.canvas); }

    async registerImage(name, url) {
        return new Promise((resolve, reject) => {
            let img = document.createElement("img");
            img.src = url;
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Image load failed for ${url}`));
            img.src = url;
            this.images[name] = img;
        });
    }

    resizeImageProportionally(name, per) {
        let img = this.images[name];
        let width = img.width;
        let height = img.height;

        let maxWidth = width*per
        let maxHeight = height*per
    
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        if(width == 0 || height == 0) return false;
        /*console.log(ratio);
        console.log(maxWidth)
        console.log(maxHeight)
        console.log(width)
        console.log(height)
        console.log(per)*/
        
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

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getPercentOnCanvas(axis, per) { if(axis == "x") return (this.canvas.width) * (per/100); else return (this.canvas.height) * (per/100); }

    drawImage(name, x, y) { this.ctx.drawImage(this.images[name], x, y); }
}

function preloadImagesWithCallback(imageUrls) {
    const promises = imageUrls.map(src => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(src); // Handle errors
        img.src = src;
    }));

    return Promise.all(promises);
}

document.getElementById("desync-t").textContent = document.getElementById("desync").value
document.getElementById("desync").addEventListener("input", () => {
    document.getElementById("desync-t").textContent = document.getElementById("desync").value
})
document.getElementById("fps-t").textContent = document.getElementById("fps").value
document.getElementById("fps").addEventListener("input", () => {
    document.getElementById("fps-t").textContent = document.getElementById("fps").value
})
document.getElementById("fps").addEventListener("change", () => {
    FPS = document.getElementById("fps").value;
    clearInterval(loop_id);
    loop_id = setInterval(() => { g.update(); if(!g.renderer.hidden) g.draw(); }, (1000/FPS));
})
const textAsCheck = (t_id, c_id) => {
    document.getElementById(t_id).addEventListener("click", () => {
        document.getElementById(c_id).checked = !document.getElementById(c_id).checked
    });
}
textAsCheck("adt", "ad");
textAsCheck("sot", "so");
textAsCheck("dit", "di");
textAsCheck("spt", "sp");

let g = new Game();

let images = await fetch(getApiLink("/game/files"));
images = await images.json();
preloadImagesWithCallback(images).then(() => {
    document.getElementById("loading").style.display = "none";
    g.init();
    loop_id = setInterval(() => { g.update(); if(!g.renderer.hidden) g.draw(); }, (1000/FPS));
})