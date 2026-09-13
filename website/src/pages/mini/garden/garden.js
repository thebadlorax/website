/**
 * author thebadlorax
 * created on 25-06-2026-18h-32m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Loader, drawRotatedImage, getRandomName } from "../mini-common.js";
import { Vector, Maths, Rect2D } from "../maths.js";
import { getApiLink, clamp, getRandomFromList } from "../../common.js";

export class Keyboard {
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
            if(document.hidden) {
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
        if(keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = true;
            if(this._key_functions[keyCode] != undefined) this._key_functions[keyCode]();
        }
    };

    _onKeyUp(event) {
        var keyCode = event.code;
        if(keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = false;
        }

        if(keyCode === "MetaLeft" || keyCode === "MetaRight") {
            for (const key in this._keys) {
                if(key !== "MetaLeft" && key !== "MetaRight") {
                    this._keys[key] = false;
                }
            }
        }
    };

    isDown(keyCode) {
        if(!(keyCode in this._keys)) {
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

class DirtSimulation {
    constructor(ctx) {
        this.ctx = ctx;
        this._previousElapsed = null;
    
        this.CELLSIZE = 10;
    
        this.bounds = { x: 0, y: 0,w: 0, h: 0 };
    
        this.gridWidth = 135;
        this.gridHeight = 135;
    
        const size = this.gridWidth * this.gridHeight;
        this.grid = new Uint8Array(size);
        this.velocity = new Float32Array(size);
        this.progress = new Float32Array(size);
        this.colors = new Uint8Array(size);
        this.types = new Uint8Array(size);
        this.updated = new Uint8Array(size);

        this.image = this.ctx.createImageData(
            this.gridWidth * this.CELLSIZE,
            this.gridHeight * this.CELLSIZE
        );

        this.canPlace = false;
        this.typeToPlace = 0;

        this.typeColors = [
            [ // dirt
                [101, 67, 33],
                [121, 85, 48],
                [139, 99, 57],
                [158, 117, 72] 
            ],
            [ // sand
                [193, 177, 133],
                [210, 194, 157],
                [220, 203, 171],
                [222, 204, 183] 
            ],
        ]
    
        this.mousePressed = false;
        this.mousePos = [0, 0];
        this.flip = false;
    }

    setBounds(bounds) { this.bounds = bounds; }

    index(x, y) { return y * this.gridWidth + x; }

    isInside(x, y) {
        const cx = this.gridWidth / 2;
        const radius = this.gridWidth / 2;
        const cy = 25;
    
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
    
        return dx * dx + dy * dy <= radius * radius;
    }

    get(x, y) {
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return 0;
        return this.grid[this.index(x, y)];
    }
    
    isSolid(x, y) {
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return true;
        if (!this.isInside(x, y)) return true;
        return this.grid[this.index(x, y)] === 1;
    }

    set(x, y, value) {
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return;

        const i = this.index(x, y);
        this.grid[i] = value;
        if (value === 1) {
            const type = this.typeToPlace;
            this.types[i] = type;
            this.colors[i] = Math.floor(Math.random() * this.typeColors[type].length);
        } else { this.types[i] = 0; this.colors[i] = 0; }
    }

    moveCell(x1, y1, x2, y2) {
        const from = this.index(x1, y1);
        const to = this.index(x2, y2);
    
        this.grid[from] = 0;
        this.grid[to] = 1;
    
        this.types[to] = this.types[from];
        this.colors[to] = this.colors[from];
    
        this.velocity[to] = this.velocity[from];
        this.progress[to] = this.progress[from];
    
        this.types[from] = 0;
        this.colors[from] = 0;
        this.velocity[from] = 0;
        this.progress[from] = 0;
    }

    updateCell(x, y, delta) {    
        const i = this.index(x, y);
    
        if (this.updated[i]) return;
        if (this.grid[i] !== 1) return;
    
        if (!this.isInside(x, y)) {
            this.set(x, y, 0);
            return;
        }
    
        this.updated[i] = 1;
    
        this.velocity[i] = clamp(this.velocity[i] + 50 * delta, 0, 10);
        this.progress[i] += this.velocity[i] * delta;
    
        let cellsToMove = Math.floor(this.progress[i]);
        if (cellsToMove > 8) cellsToMove = 8;
    
        let moved = 0;
    
        for (let d = 1; d <= cellsToMove; d++) {
            if (this.isSolid(x, y + d)) break;
            moved = d;
}
    
        if (moved > 0) { this.moveCell(x, y, x, y + moved); return; }
    
        const leftOpen = !this.isSolid(x - 1, y + 1);
        const rightOpen = !this.isSolid(x + 1, y + 1);
    
        if (leftOpen || rightOpen) {
            let dir; if (leftOpen && rightOpen) dir = Math.random() < 0.5 ? -1 : 1;
            else dir = leftOpen ? -1 : 1;
    
            this.moveCell(x, y, x + dir, y + 1);
            return;
        }
    
        this.velocity[i] = 0;
        this.progress[i] = 0;
    }

    update(delta) {
        this.updated.fill(0);
    
        if (this.mousePressed && this.canPlace) {
            const scaleX = this.gridWidth / this.bounds.w;
            const scaleY = this.gridHeight / this.bounds.h;
    
            // Subtract bounds.x and bounds.y before scaling to map screen mouse to grid coords
            const localMouseX = this.mousePos[0] - this.bounds.x;
            const localMouseY = this.mousePos[1] - this.bounds.y;
    
            const gx = Math.floor(localMouseX * scaleX);
            const gy = Math.floor(localMouseY * scaleY);
    
            for (let y = -4; y <= 4; y++) {
                for (let x = -4; x <= 4; x++) {
                    if (Math.random() > 0.8) this.set(gx + x, gy + y, 1);
                }
            }
        }
    
        for (let y = this.gridHeight - 1; y >= 0; y--) {
            const leftToRight = Math.random() < 0.5;
            const xStart = leftToRight ? 0 : this.gridWidth - 1;
            const xEnd = leftToRight ? this.gridWidth : -1;
            const xStep = leftToRight ? 1 : -1;
    
            for (let x = xStart; x !== xEnd; x += xStep) this.updateCell(x, y, delta);
        }
    }

    render() {
        const ctx = this.ctx;
        const image = this.image;
        const pixels = image.data;
    
        pixels.fill(0);
    
        const width = this.gridWidth * this.CELLSIZE;
    
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const i = this.index(x, y);
                if (this.grid[i] === 0) continue;
    
                const color = this.typeColors[this.types[i]][this.colors[i]];
    
                for (let py = 0; py < this.CELLSIZE; py++) {
                    for (let px = 0; px < this.CELLSIZE; px++) {
    
                        const pixelIndex = ((y * this.CELLSIZE + py) * width + (x * this.CELLSIZE + px)) * 4;
    
                        pixels[pixelIndex] = color[0];
                        pixels[pixelIndex + 1] = color[1];
                        pixels[pixelIndex + 2] = color[2];
                        pixels[pixelIndex + 3] = 255;
                    }
                }
            }
        }
    
        ctx.putImageData(image, 0, 0);
    }

    serializeBinary() {
        const bufferToBase64 = (buf) => {
            let binary = '';
            const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        };
    
        return JSON.stringify({
            width: this.gridWidth,
            height: this.gridHeight,
            grid: bufferToBase64(this.grid),
            types: bufferToBase64(this.types),
            colors: bufferToBase64(this.colors)
        });
    }
    
    deserializeBinary(jsonString) {
        if (!jsonString) return;
    
        const base64ToUint8 = (base64) => {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        };
    
        try {
            const data = JSON.parse(jsonString);
    
            const loadedGrid = base64ToUint8(data.grid);
            const loadedTypes = base64ToUint8(data.types);
            const loadedColors = base64ToUint8(data.colors);
    
            this.grid.set(loadedGrid);
            this.types.set(loadedTypes);
            this.colors.set(loadedColors);
            
            this.velocity.fill(0);
            this.progress.fill(0);
            this.updated.fill(0);
        } catch (err) {
            console.error("Failed to load binary simulation state:", err);
        }
    }
}

class Animation {
    constructor(frames, speed) {
        this.frames = frames;
        this.speed = speed;

        this.onComplete = null;
        this.hasCompleted = false;
        this.repeat = true;

        this.timer = 0;
        this.frame = 0;
    }

    setRepeatIp(flag) {
        this.repeat = flag;
        return this;
    }

    reset() {
        this.frame = 0;
        this.hasCompleted = false;
    }

    progress(delta) {
        this.timer += delta;
        if(this.timer > this.speed) {
            this.timer = 0;
            if(this.frame+1 >= this.frames.length) {
                if(this.onComplete != null && !this.hasCompleted) {
                    this.onComplete();
                    this.hasCompleted = true;
                }
                if(this.repeat) {
                    this.reset()
                }
                return;
            }
            this.frame += 1;
        }
    }

    get() {
        return this.frames[this.frame];
    }
}

class Animator {
    constructor() {
        this.animations = {};
        this.current = null;
    }
    addAnim(animation, key) {
        this.animations[key] = animation;
    }
    changeAnim(key) {
        this.current = this.animations[key];
    }
    resetAnim(key) {
        this.animations[key].reset();
    }
    resetAndChangeAnim(key) {
        this.resetAnim(key);
        this.changeAnim(key);
    }
    update(delta) {
        if(this.current.speed == -1) return;
        this.current.progress(delta);
    }
    get() {
        if(this.current == null) return;
        return this.current.get()
    }
}

class Sprite {
    constructor(rect, animator, scene) {
        this.rect = rect; this.anim = animator;
        this.scene = scene; this.layer = 1;
        this.extraData = {
            "renderOffset": Vector.two(0, 0),
            "updateFn": (delta) => {},
            "renderFn": null
        }
    }

    getBounds(bounds) {
        return new Rect2D(
            Vector.two(
                bounds.x + bounds.w * this.rect.pos.x,
                bounds.y + bounds.h * this.rect.pos.y
            ),
            bounds.w * this.rect.w,
            bounds.h * this.rect.h
        )
    }

    update(delta) {
        this.anim.progress(delta);
    }

    render(ctx, bounds) {
        const bb = this.getBounds(bounds);
        const off = this.extraData.renderOffset;
        if(this.extraData.renderFn != null) {
            this.extraData.renderFn(ctx);
            return;
        }
        ctx.drawImage(this.anim.get(), bb.pos.x + off.x, bb.pos.y + off.y, bb.w, bb.h);
    }
}

class Clickbox {
    constructor(rect, onclick) {
        this.rect = rect;
        this.onclick = onclick;
        this.active = true;
        this.cursor = "pointer"
    }

    getBounds(bounds) {
        return {
            x: bounds.x + bounds.w * this.rect.pos.x,
            y: bounds.y + bounds.h * this.rect.pos.y,
            w: bounds.w * this.rect.w,
            h: bounds.h * this.rect.h
        };
    }

    render(ctx, bounds) {
        let bb = this.getBounds(bounds);
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
    }

    withCursorStyle(cursor) {
        this.cursor = cursor;
        return this;
    }
}

const ALL_DIALOGUE = {
    "shopkeep": {
        "idle": [
            {
                "lines": [
                    {
                        "text": "this job is soooo boring"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.shopkeep.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "buy something or get out, punk"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.shopkeep.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "y'know what would be good right now"
                    },
                    {
                        "text": "cottage cheese"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.shopkeep.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "we're out of stock of a lot of things right now"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.shopkeep.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "stop bothering me"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.shopkeep.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "why are you talking to me, peasant?"
                    },
                    {
                        "text": "toil some more"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.shopkeep.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "have you ever noticed we live under a dome"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.shopkeep.anim.resetAndChangeAnim("idle") } }
            }
        ]
    } 
}

const PLANT_DATA = {
    "grass": {
        "display_name": "Grass",
        "seed_name": "Grass Seeds",
        "seed_art": "garden-art-29",
        "shop_price": 100,
        "description": "awesomely cheap and basic grass plant"
    }
}

const sceneData = {
    "garden": {
        "renderFn": (eng, layer0Sprites) => {
            const ctx = eng.ctx;
            const bb = eng.getBoundingBox();
    
            const skyOffset = 155;
            const percent = (eng.data.time / eng.data.dayLength) * 100;
            const degrees = -(percent / 100) * 360 + skyOffset;
            const skyScale = 1.3;
    
            const skyW = bb.w * skyScale;
            const skyH = bb.h * skyScale;
    
            const skyX = bb.x + (bb.w - skyW) / 2;
            const skyY = bb.y + (bb.h - skyH) / 2;
    
            drawRotatedImage(
                ctx,
                eng.data.sky_img,
                skyX,
                skyY,
                skyW,
                skyH,
                degrees
            );

            layer0Sprites.forEach(s => s.render(ctx, bb));
    
            ctx.drawImage(eng.data.gardenbg, 0, 0, 512, 512, bb.x, bb.y, bb.w, bb.h);
        },
        "clickboxes": [
            new Clickbox(new Rect2D(Vector.two(0.33, 0.28), 0.1, 0.1), (eng) => { 
                eng.spriteMap.door.anim.changeAnim("open")
            }).withCursorStyle("alias")
        ]
    },
    "shop": {
        "renderFn": (eng) => {
            const ctx = eng.ctx;
            const bb = eng.getBoundingBox();
    
            ctx.drawImage(eng.loader.getImage("garden-art-07"), 0, 0, 512, 512, bb.x, bb.y, bb.w, bb.h);
        },
        "clickboxes": [
            new Clickbox(new Rect2D(Vector.two(0.49, 0.28), 0.1, 0.1), (eng) => { 
                eng.spriteMap.shopkeep.anim.changeAnim("talk"); 
                eng.openRandomDialogueFromList(ALL_DIALOGUE.shopkeep.idle)
            }),
            new Clickbox(new Rect2D(Vector.two(0.145, 0.275), 0.16, 0.12), (eng) => { console.log("a") }),
            new Clickbox(new Rect2D(Vector.two(0.19, 0.06), 0.12, 0.14), (eng) => { console.log("b") }),
            new Clickbox(new Rect2D(Vector.two(0.41, 0.14), 0.1, 0.1), (eng) => { console.log("c") }),
            new Clickbox(new Rect2D(Vector.two(0.66, 0.08), 0.1, 0.1), (eng) => { console.log("d") }),
            new Clickbox(new Rect2D(Vector.two(0.83, 0.02), 0.1, 0.125), (eng) => { console.log("e") }),
            new Clickbox(new Rect2D(Vector.two(0.79, 0.185), 0.2, 0.15), (eng) => { console.log("f") })
        ],
        "movement": {
            "down": (eng) => {
                eng.swapScenes("garden")
            }
        }
    }
}

class Engine {
    constructor(ctx) {
        this.ctx = ctx;
        this.loader = new Loader();
        this.keyboard = new Keyboard();

        const scan = document.createElement("canvas");
        const scanctx = scan.getContext("2d", {
            willReadFrequently: true
        });
        scanctx.webkitImageSmoothingEnabled = false;
        scanctx.mozImageSmoothingEnabled = false;
        scanctx.imageSmoothingEnabled = false;
        
        this.sand = {
            "canvas": scan,
            "simulation": new DirtSimulation(scanctx),
            "timeout_timer": 5
        }

        this.mouse = new Rect2D(Vector.two(0, 0), 10, 10);
        
        this.fps_data = [];

        this.data = {
            "scenetime": 0,
            "scene": "garden",
            "gardenbg": null,
            "scale": 1.5,
            "dayLength": (1000*60)*10, // ms
            "time": 0,
            "showClickboxes": false,
            "tabOutTime": 0,
            "cloudTimer": Math.floor(Math.random()*10),
            "cursorOverride": null,
            "hands": {
                "yVel": null,
                "clamp": [null, null],
                "active": false
            },
            "dialogue": {
                "active": false,
                "line": 0,
                "data": null,
                "last_dialogue": null
            }
        }

        this.spriteMap = {}
        this.allSprites = [];
        this.screenEffects = [];
        this.globalClickboxes = [];

        this.block_movement = false;
    }

    async run() {
        await this.load()
        await this.init();
        window.requestAnimationFrame(this.tick.bind(this));
    }
    async load() {
        let r = await fetch(getApiLink("/mini/garden/files"));
        r = await r.json();
        await Promise.all(r.map(url => this.loader.loadImage(url.replace(".png", ""), `../res/mini/garden/${url}`)));
    }
    async init() {
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.imageSmoothingEnabled = false;
        this.refreshBounds();
        this.keyboard.listenForEvents(["Tab", "KeyS", "KeyL"]);
        this.keyboard.setFunctionOnKeyPress("Tab", () => {
            if(this.data.scene != "garden") return;
            const hand_amp = 3;

            this.data.hands = {
                "yVel": !this.data.hands.active ? hand_amp*-1 : hand_amp,
                "clamp": !this.data.hands.active ? [0, 1] : [-1, 1],
                "active": !this.data.hands.active
            };

            this.sand.simulation.canPlace = this.data.hands.active;
            this.hand_clickboxes.forEach(c => c.active = this.data.hands.active)
        })

        this.keyboard.setFunctionOnKeyPress("KeyS", () => {
            window.localStorage.setItem("garden_save", this.serialize());
            alert("saved")
        })
        this.keyboard.setFunctionOnKeyPress("KeyL", () => {
            this.deserialize(window.localStorage.getItem("garden_save"));
            alert("loaded")
        })

        window.addEventListener("resize", () => this.resize())
        this.ctx.canvas.addEventListener("mousemove", e => {
            this.mouse.pos.xySetIp(e.clientX, e.clientY);
        });

        this.ctx.canvas.addEventListener("mousedown", e => {
            if(e.button === 0) this.sand.simulation.typeToPlace = 0
            else this.sand.simulation.typeToPlace = 1;
            this.sand.simulation.mousePressed = true;

            if(e.button === 0) this.onClick();
        });
        
        this.ctx.canvas.addEventListener("mouseup", () => {
            this.sand.simulation.mousePressed = false;
            this.sand.timeout_timer = 5;
        });

        this.ctx.canvas.addEventListener("mousemove", e => {
            this.sand.simulation.mousePos = [e.clientX, e.clientY];
        })

        document.addEventListener("visibilitychange", () => {
            if(document.visibilityState === "hidden") {
                this.tabOutTime = performance.now(); 
            } else if(document.visibilityState === "visible") {
                if(this.tabOutTime > 0) {
                    const durationMs = performance.now() - this.tabOutTime;
                    
                    this.offlineProgress(durationMs)
                    this.tabOutTime = 0; 
                }
            }
        });

        document.addEventListener("contextmenu", e => { e.preventDefault(); })
        this.data.sky_img = this.loader.getImage("garden-art-06");
        const startingScene = 2;
        this.setSceneTime(startingScene);
        this.data.time = this.data.dayLength * 0.35;

        this.setupSprites();
        this.down_clickbox = new Clickbox(new Rect2D(Vector.two(0.45, 0.75), 0.18, 0.18), (eng) => { sceneData[eng.data.scene].movement.down(eng) })
            .withCursorStyle("alias")
        this.down_clickbox.active = false;
        this.globalClickboxes.push(this.down_clickbox);
        this.refreshMovementArrows();

        const timeouts = {}
        const callHandler = (fn, key) => {
            if(timeouts[key] == null) timeouts[key] = performance.now()-1000;
            if(timeouts[key] > performance.now()-500) return;
            fn();
            timeouts[key] = performance.now();
        }
        const settings_handler = (eng) => {
            console.log("settings");
        }
        const seeds_handler = (eng) => {
            console.log("seeds");
        }
        const exit_handler = (eng) => {
            window.location.href = "/"
        }

        this.hand_clickboxes = [
            // seeds bracelet
            new Clickbox(new Rect2D(Vector.two(0.05, 0.75), 0.25, 0.1),    () => { callHandler(seeds_handler, "seeds") }).withCursorStyle("pointer"),

            // settings bracelet
            new Clickbox(new Rect2D(Vector.two(0.71, 0.77), 0.045, 0.09),  () => { callHandler(settings_handler, "settings") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.76, 0.75), 0.055, 0.06),  () => { callHandler(settings_handler, "settings") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.825, 0.75), 0.04, 0.035), () => { callHandler(settings_handler, "settings") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.87, 0.725), 0.06, 0.04),  () => { callHandler(settings_handler, "settings") }).withCursorStyle("pointer"),

            // exit bracelet
            new Clickbox(new Rect2D(Vector.two(0.73, 0.88), 0.04, 0.03),    () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.76, 0.875), 0.05, 0.025),  () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.78, 0.84), 0.05, 0.03),    () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.82, 0.82), 0.05, 0.03),    () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.86, 0.8), 0.05, 0.03),    () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.9, 0.78), 0.05, 0.03),    () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
        ]
        this.hand_clickboxes.forEach(c => c.active = false)
        this.globalClickboxes = this.globalClickboxes.concat(this.hand_clickboxes)
    }
    tick(elapsed) {
        if(this._previousElapsed === null) {
            this._previousElapsed = elapsed;
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        }
    
        const delta = Math.min(
            (elapsed - this._previousElapsed) / 1000,
            0.12
        );
    
        this._previousElapsed = elapsed;

        if(this.fps_data.length == 5) this.fps_data.pop();
        this.fps_data.push(delta || 0);

        if(delta > 0) {
            if(this.sand.timeout_timer > 0 || this.sand.simulation.mousePressed) {
                this.sand.timeout_timer -= delta;
                this.sand.simulation.update(delta);
                this.sand.simulation.render()
            }
        } 

        this.update(delta);
        this.render();

        window.requestAnimationFrame(this.tick.bind(this));
    }

    openDialogue(data) {
        this.data.dialogue.last_dialogue = this.data.dialogue.data;
        this.data.dialogue.data = data;
        this.data.dialogue.line = 0;
        this.data.dialogue.active = true;
        this.setMovementBlocking(true);
    }

    openRandomDialogueFromList(l) {
        let nlist = l.filter(l1 => l1 != this.data.dialogue.last_dialogue);
        if(nlist.length == 0) nlist = l;
        this.openDialogue(getRandomFromList(nlist));
    }
    progressDialogue() {
        this.data.dialogue.line += 1;
        if(this.data.dialogue.line >= this.data.dialogue.data.lines.length) this.closeDialogue();
    }
    closeDialogue() {
        if(this.data.dialogue.data.fns.onEnd != null) this.data.dialogue.data.fns.onEnd(this);
        this.data.dialogue.data = null;
        this.data.dialogue.line = 0;
        this.data.dialogue.active = false;
        this.setMovementBlocking(false);
    }

    offlineProgress(ms) {
        this.update(ms/1000);
    }

    setupSprites() {
        let door_animator = new Animator();
        let open_anim = new Animation(this.loader.imageSet("garden-art-16", "garden-art-17", "garden-art-18"), 0.1)
        open_anim.repeat = false;
        open_anim.onComplete = () => {
            this.swapScenes("shop", () => { open_anim.reset(); door_animator.changeAnim("idle") });
        }
        door_animator.addAnim(open_anim, "open")
        
        door_animator.addAnim(new Animation(this.loader.imageSet("garden-art-15"), -1), "idle")
        const door = this.createSprite(new Rect2D(Vector.two(-0.125, -0.165), 1, 1), door_animator, "garden");
        this.spriteMap.door = door;
        door.anim.changeAnim("idle")

        let shopkeep_animator = new Animator();
        shopkeep_animator.addAnim(new Animation(this.loader.imageSet("garden-art-11", "garden-art-12", "garden-art-13", "garden-art-14"), 12), "idle")
        shopkeep_animator.addAnim(new Animation(this.loader.imageSet("garden-art-08", "garden-art-09", "garden-art-10", "garden-art-09"), 0.3), "talk")
        const shopkeep = this.createSprite(new Rect2D(Vector.two(0.05, -0.162), 1, 1), shopkeep_animator, "shop");
        this.spriteMap.shopkeep = shopkeep;
        shopkeep_animator.changeAnim("idle")

        let down_arrow_animator = new Animator();
        down_arrow_animator.addAnim(new Animation(this.loader.imageSet("garden-art-19", "garden-art-20", "garden-art-21", "garden-art-22", "garden-art-21", "garden-art-20", "garden-art-19"), 0.13), "idle")
        const down_arrow = this.createSprite(new Rect2D(Vector.two(0.17, 0.2), 0.8, 0.8), down_arrow_animator, "");
        down_arrow_animator.changeAnim("idle")
        this.spriteMap.down_arrow = down_arrow;

        let hand_animator = new Animator();
        hand_animator.addAnim(new Animation(this.loader.imageSet("garden-art-26"), -1), "idle");
        const hands = this.createSprite(new Rect2D(Vector.two(0, 1), 1, 1), hand_animator, "garden");
        hand_animator.changeAnim("idle");
        this.spriteMap.hands = hands;
        hands.extraData.updateFn = (delta) => {
            if(this.data.hands.yVel != null) {
                hands.rect.pos.y = clamp(hands.rect.pos.y + delta*this.data.hands.yVel, this.data.hands.clamp[0], this.data.hands.clamp[1])
            }
        }
        hands.extraData.renderFn = (ctx) => {
            //if(this.data.scenetime == 6) ctx.filter = "brightness(50%)";
            const bb = hands.getBounds(this.getBoundingBox());
            ctx.drawImage(hands.anim.get(), bb.pos.x, bb.pos.y, bb.w, bb.h);
            //ctx.filter = "none";
        }
    }

    createSprite(rect, animator, scene) {
        let s = new Sprite(rect, animator, scene)
        this.allSprites.push(s)
        return s;
    }
    spawnCloud() {
        const anim = new Animator();
        anim.addAnim(new Animation(this.loader.imageSet(getRandomFromList(["garden-art-23", "garden-art-24", "garden-art-25"])), -1), "idle");
        const size = clamp(Math.random()*2, 0.45, 0.55)
        const cloud = this.createSprite(new Rect2D(Vector.two(0.8 + (Math.random() * 0.2), -Math.random()*0.2), size, size), anim, "garden");
        cloud.layer = 0;
        cloud.extraData.cloudSpeed = clamp(Math.random(), 0.1, 0.3) * 0.2;
        cloud.extraData.updateFn = (delta) => {
            cloud.rect.pos.x -= delta * cloud.extraData.cloudSpeed;
        
            if (cloud.rect.pos.x < -1) {
                const index = this.allSprites.indexOf(cloud);
                if (index !== -1) this.allSprites.splice(index, 1);
            }
        };
        cloud.extraData.renderFn = (ctx) => {
            if(this.data.scenetime == 6) ctx.filter = "brightness(50%)";
            const bb = cloud.getBounds(this.getBoundingBox());
            ctx.drawImage(cloud.anim.get(), bb.pos.x, bb.pos.y, bb.w, bb.h);
            ctx.filter = "none";
        }
        cloud.anim.changeAnim("idle");
    }

    setSceneTime(time) {
        this.data.scenetime = time;
        this.changeGardenBg(`garden-art-0${this.data.scenetime-1}`)
    }

    resize() {
        const canvas = this.ctx.canvas;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        this.sand.canvas.width = window.innerWidth;
        this.sand.canvas.height = window.innerHeight;
        this.refreshBounds();
    }

    setMovementBlocking(flag) {
        this.block_movement = flag;
        this.refreshMovementArrows();
    }

    refreshMovementArrows() {
        let mvment = sceneData[this.data.scene].movement || {};
        if(this.block_movement) mvment = {};
        if(mvment.down != null) {
            this.down_clickbox.active = true;
            this.spriteMap.down_arrow.scene = this.data.scene;
        } else {
            this.down_clickbox.active = false;
            this.spriteMap.down_arrow.scene = "";
        }
    }

    swapScenes(newScene, onSwap=null) {
        let e = this.applyScreenEffect("fadeOutIn", {"ms": 400, "blackTime": 100});
        e.onBlack = () => {
            this.data.scene = newScene;
            if(onSwap != null) onSwap();
            this.refreshMovementArrows();

            if(this.data.hands.active) {
                this.data.hands.yVel = 100;
                this.data.hands.active = false;
            }
        }
    }

    changeGardenBg(key) {
        this.data.gardenbg = this.loader.getImage(key);
    }

    refreshBounds() {
        const canvas_bounds = { "width": this.ctx.canvas.width, "height": this.ctx.canvas.height }
        const bg_size = 512;
        const scale = Math.min(
            canvas_bounds.width  / bg_size,
            canvas_bounds.height / bg_size
        );
        const total_xpadding = canvas_bounds.width-(bg_size*scale)
        const total_ypadding = canvas_bounds.height-(bg_size*scale)
        this.data.bb = {
            "x": Math.floor(total_xpadding/2),
            "y": Math.floor(total_ypadding/2),
            "w": Math.floor(bg_size*scale),
            "h": Math.floor(bg_size*scale)
        };

        this.sand.simulation.setBounds(this.data.bb);
        this.sand.canvas.width = this.sand.simulation.gridWidth * this.sand.simulation.CELLSIZE;
        this.sand.canvas.height = this.sand.simulation.gridHeight * this.sand.simulation.CELLSIZE;
    }

    getBoundingBox() {
        return this.data.bb;
    }

    applyScreenEffect(type, data) {
        switch(type) {
            case "fadeOutIn": {
                const ms = data.ms;
                const fadeInTime = Math.floor(ms/2);
                const fadeOutTime = Math.floor(ms/2);

                const e = {
                    "type": type,
                    "startTime": Date.now(),
                    "ms": data.ms,
                    "updateTime": Date.now(),
                    "blackTime": data.blackTime,
                    "fadeInTime": fadeInTime,
                    "fadeOutTime": fadeOutTime,
                    "onFinish": () => {},
                    "onBlack": () => {},
                    "onBlackCompleted": false
                }

                this.screenEffects.push(e);

                return e;
            }
        }
    }
    updateEffects(delta) {
        this.screenEffects.forEach((e, index) => {
            switch(e.type) {
                case "fadeOutIn": {
                    e.updateTime += delta*1000;
                    const elapsed = e.updateTime - e.startTime;
                    
                    if(!e.onBlackCompleted && elapsed >= (e.ms+e.blackTime)/2) {
                        e.onBlackCompleted = true;
                        e.onBlack();
                    }

                    if(elapsed >= e.ms+200) {
                        this.screenEffects.splice(index, 1);
                        return; 
                    }
                    break;
                }
            }
        });
    }

    drawTextWrap(text, x, y, maxWidth, lineHeight) {
        const ctx = this.ctx;
        const words = text.split(' ');
        let line = '';
        
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          
          if(testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
          } else line = testLine;
          
        }
        ctx.fillText(line, x, y);
    }

    render() {
        const ctx = this.ctx;
        const bb = this.getBoundingBox();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        sceneData[this.data.scene].renderFn(this, this.allSprites.filter(s => s.scene == this.data.scene && s.layer == 0));
        if(this.data.scenetime == 6 && this.data.scene == "garden") ctx.filter = "brightness(50%)"
        this.allSprites.filter(s => s.scene == this.data.scene && s.layer > 0).sort((a, b) => a.layer - b.layer).forEach(s => s.render(ctx, bb));
        if(this.data.dialogue.active) {
            ctx.fillStyle = `rgba(255, 255, 255, 1)`;
            ctx.fillRect(bb.x+50, ctx.canvas.height-225, bb.w-100, 200);
            ctx.strokeStyle = `rgba(0, 0, 0, 1)`;
            ctx.strokeRect(bb.x+50, ctx.canvas.height-225, bb.w-100, 200);

            ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            ctx.font = `30px Arial`;
            const line = this.data.dialogue.data.lines[this.data.dialogue.line].text;
            this.drawTextWrap(line, bb.x+60, ctx.canvas.height-190, bb.w-90, 40)
        }

        if(this.data.scenetime == 6) ctx.filter = `brightness(50%)`
        ctx.drawImage(this.sand.canvas, bb.x, bb.y + (this.spriteMap.hands.rect.pos.y*ctx.canvas.height), bb.w, bb.h);
        ctx.filter = `none`;

        ctx.clearRect(0, 0, ctx.canvas.width, bb.y);
        ctx.clearRect(0, bb.y + bb.h, ctx.canvas.width, ctx.canvas.height);
        ctx.clearRect(0, bb.y, bb.x, bb.h);
        ctx.clearRect(bb.x + bb.w, bb.y, ctx.canvas.width, bb.h);

        this.screenEffects.forEach(e => {
            switch(e.type) {
                case "fadeOutIn": {
                    const elapsed = e.updateTime - e.startTime;
        
                    let alpha = 0;
        
                    if(elapsed < e.fadeOutTime) {
                        alpha = elapsed / e.fadeOutTime;
                    } else if(elapsed < e.fadeOutTime + e.blackTime) {
                        alpha = 1;
                    } else {
                        const fadeBackElapsed = elapsed - (e.fadeOutTime + e.blackTime);
                        alpha = 1 - (fadeBackElapsed / e.fadeInTime);
                    }
        
                    this.ctx.save(); 
                    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                    this.ctx.fillStyle = "black";
                    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
                    this.ctx.restore();
                    break;
                }
            }
        });

        if(this.data.showClickboxes) {
            sceneData[this.data.scene].clickboxes.filter(c => c.active).forEach(c => {
                c.render(ctx, bb)
            })

            this.globalClickboxes.filter(c => c.active).forEach(c => {
                ctx.filter = "hue-rotate(180deg)"
                c.render(ctx, bb)
                ctx.filter = "none";
            })
        }
    }

    onClick() {
        const bounds = this.getBoundingBox();

        /*const relx = (this.mouse.pos.x-bounds.x) / bounds.w;
        const rely = (this.mouse.pos.y-bounds.y) / bounds.h;*/

        if(this.data.dialogue.active) {
            this.progressDialogue();
            return;
        }
        if(!this.data.hands.active) {
            sceneData[this.data.scene].clickboxes.concat(this.globalClickboxes).filter(c => c.active).forEach(c => {
                const bb = c.getBounds(bounds);
                if(Maths.rectRect(this.mouse.pos.x-5, this.mouse.pos.y-5, this.mouse.w, this.mouse.h, bb.x, bb.y, bb.w, bb.h)) {
                    c.onclick(this);
                }
            });
        } else {
            this.globalClickboxes.filter(c => c.active).forEach(c => {
                const bb = c.getBounds(bounds);
                if(Maths.rectRect(this.mouse.pos.x-5, this.mouse.pos.y-5, this.mouse.w, this.mouse.h, bb.x, bb.y, bb.w, bb.h)) {
                    c.onclick(this);
                }
            });
        }
    }
    
    update(delta) {
        if(!delta) return;
        this.data.time += delta * 1000;
    
        if(this.data.time >= this.data.dayLength) this.data.time %= this.data.dayLength;
        const percent = (this.data.time / this.data.dayLength) * 100;

        this.updateEffects(delta);
    
        // modify bg for shadows
        let scene = 6;
        if(percent >= 15) scene = 1;
        if(percent >= 25) scene = 2;
        if(percent >= 42) scene = 3;
        if(percent >= 50) scene = 4;
        if(percent >= 55) scene = 5;
        if(percent >= 78) scene = 6;
    
        if(scene !== this.data.scenetime) this.setSceneTime(scene);

        this.allSprites.filter(s => s.scene == this.data.scene).forEach(s => {
            s.anim.update(delta);
        });
        this.allSprites.forEach(s => {
            s.extraData.updateFn(delta);
        })

        this.data.cloudTimer -= delta;
        if(this.data.cloudTimer < 0) {
            this.spawnCloud()
            this.data.cloudTimer = Math.floor(Math.random()*30);
        }

        const bounds = this.getBoundingBox();
        document.body.style.cursor = "default"
        if(this.sand.simulation.mousePressed && this.data.hands.active) document.body.style.cursor = "none"
        if(!this.data.hands.active) {
            sceneData[this.data.scene].clickboxes.concat(this.globalClickboxes).filter(c => c.active).forEach(c => {
                const bb = c.getBounds(bounds);
                if(Maths.rectRect(this.mouse.pos.x-5, this.mouse.pos.y-5, this.mouse.w, this.mouse.h, bb.x, bb.y, bb.w, bb.h)) {
                    document.body.style.cursor = c.cursor;
                }
            });
        } else {
            this.globalClickboxes.filter(c => c.active).forEach(c => {
                const bb = c.getBounds(bounds);
                if(Maths.rectRect(this.mouse.pos.x-5, this.mouse.pos.y-5, this.mouse.w, this.mouse.h, bb.x, bb.y, bb.w, bb.h)) {
                    document.body.style.cursor = c.cursor;
                }
            });
        }
        if(this.data.dialogue.active) document.body.style.cursor = "pointer"
    }

    serialize() {
        return JSON.stringify({
            "dirt": this.sand.simulation.serializeBinary()
        })
    }

    deserialize(jsonString) {
        const json = JSON.parse(jsonString);
        this.sand.simulation.deserializeBinary(json.dirt);
    }
}

const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d");

const engine = new Engine(ctx);
await engine.run();