/**
 * author thebadlorax
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Loader, drawRotatedImage, getRandomFromList, easeOutBack, easeInBack } from "../mini-common.js";
import { Vector, Maths, Rect2D, PhysicsContext2D, PhysicsSquare2D, getSquareAsVertices } from "../maths.js";
import { getApiLink, clamp } from "../../common.js";

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
    
        this.bounds = { x: 0, y: 0, w: 0, h: 0 };
    
        this.gridWidth = 200;
        this.gridHeight = 200;
    
        this.resetArrays();

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

    resetArrays() {
        const size = this.gridWidth * this.gridHeight;
        this.grid = new Uint8Array(size);
        this.velocity = new Float32Array(size);
        this.progress = new Float32Array(size);
        this.colors = new Uint8Array(size);
        this.types = new Uint8Array(size);
        this.updated = new Uint8Array(size);
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

    setFrame(frame) {
        this.timer = 0;
        this.frame = frame;
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
        this.current_key = null;
    }
    addAnim(animation, key) {
        this.animations[key] = animation;
    }
    changeAnim(key) {
        this.current = this.animations[key];
        this.current_key = key;
    }
    resetAnim(...keys) {
        keys.forEach(key => this.animations[key].reset())
    }
    resetAndChangeAnim(key) {
        this.resetAnim(key, this.current_key); 
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
            this.extraData.renderFn(ctx, bounds);
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

        this.extraData = {
        }
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
    }, 
    "stopgo": {
        "idle": [
            {
                "lines": [
                    {
                        "text": "i am son of himself"
                    },
                    {
                        "text": "created by himself"
                    },
                    {
                        "text": "revere me"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "one does not mess around with cosmic forces like you do, at least without punishment"
                    },
                    {
                        "text": "your punishment will come"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "i will impart some humor upon you from my acquaintance in 263CE"
                    },
                    {
                        "text": 'Someone needled a jokester:'
                    },
                    {
                        "text": `"I had your wife, without paying a dime."`
                    },
                    {
                        "text": 'He replied:'
                    },
                    {
                        "text": `"It's my duty as a husband to couple with such a monstrosity.`
                    },
                    {
                        "text": `What made you do it?"`
                    },
                    {
                        "text": "he spoke of how it would be funny for eternity"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "your parents had to walk uphill both ways"
                    },
                    {
                        "text": "i watched her closely, i would know"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "divinity isn't all it's made to be, young lad"
                    },
                    {
                        "text": "i remember my own garden, growing between my hands as a young deity"
                    },
                    {
                        "text": "ohhh, my haands................ how i miss them."
                    },
                    {
                        "text": "now i must tend to time and space instead of my plants"
                    },
                    {
                        "text": "but i do not forget"
                    }
                    
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "sometimes lads try to mess with spacetime, you know"
                    },
                    {
                        "text": "they don't know better, and they get smote"
                    },
                    {
                        "text": "nowadays we're not allowed to smite like that anymore, the olden days were better"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "that damn shop is always out of stock"
                    },
                    {
                        "text": "you still have to eat and drink as a deity"
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") } }
            },
            {
                "lines": [
                    {
                        "text": "you know i'm still the same person in all of the timelines, right?"
                    },
                    {
                        "text": "don't think you can hide what you did that one time..."
                    }
                ],
                "fns": { "onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") } }
            },
        ]
    } 
}

const ITEM_DATA = {
    GRASS_SEEDS: {
        display_name: "Grass Seeds",
        inventory: {
            art: "garden-art-29",
            size: 150
        },
        value: 100,
        description: "awesomely cheap and basic grass plant",
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
    },
    "saves": {
        "renderFn": (eng) => {
            const ctx = eng.ctx;
            const bb = eng.getBoundingBox();
    
            ctx.drawImage(eng.loader.getImage("garden-art-33"), 0, 0, 512, 512, bb.x, bb.y, bb.w, bb.h);
        },
        "clickboxes": [
            new Clickbox(new Rect2D(Vector.two(0.45, 0.45), 0.1, 0.25), (eng) => { 
                eng.spriteMap.stopgo.anim.changeAnim("talk"); 
                eng.openRandomDialogueFromList(ALL_DIALOGUE.stopgo.idle)
            }),

            new Clickbox(new Rect2D(Vector.two(0.15, 0.1), 0.2, 0.28), (eng) => { 
                if(eng.data.save_information.selected_slot == 0) {
                    eng.spriteMap.stopgo.anim.changeAnim("talk"); 
                    eng.openDialogue({
                        "lines": [
                            {
                                "text": "hey you're already in that timeline"
                            },
                            {
                                "text": "don't mess with me"
                            }
                        ],
                        "fns": {"onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") }}
                    });
                    return;
                }
                eng.spriteMap.stopgo.anim.changeAnim("talk"); 
                let l = [
                    {
                        "text": "well now, that's certainly a choice"
                    },
                    {
                        "text": `slot 1, is it?`
                    },
                    {
                        "text": "well now, you know what they say about swapping timelines...."
                    }
                ];
                if(!eng.data.save_information.saves[1].exists) {
                    l.push({
                        "text": "actually, do you know how hard it is to make a new timeline?"
                    },
                    {
                        "text": "it's quite a lot of work. why should i, at your whim?"
                    },
                    {
                        "text": "hmmm????"
                    },
                    {
                        "text": "oh im just messing around here you go"
                    })
                }
                eng.openDialogue({
                    "lines": l,
                    "fns": {"onEnd": async (eng) => { 
                        eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle"); 
                        await eng.swapSave(0); 
                        eng.swapScenes("garden", async () => {
                            await eng.refreshSave();
                            await eng.getAllSaveInformation();
                        })
                    }}
                })
            }),
            new Clickbox(new Rect2D(Vector.two(0.4, 0.1), 0.2, 0.28), (eng) => { 
                if(eng.data.save_information.selected_slot == 1) {
                    eng.spriteMap.stopgo.anim.changeAnim("talk"); 
                    eng.spriteMap.stopgo.anim.current.setFrame(1);
                    eng.openDialogue({
                        "lines": [
                            {
                                "text": "hey you're already in that timeline"
                            },
                            {
                                "text": "don't mess with me"
                            }
                        ],
                        "fns": {"onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") }}
                    });
                    return;
                }
                eng.spriteMap.stopgo.anim.changeAnim("talk"); 
                eng.spriteMap.stopgo.anim.current.setFrame(1);

                let l = [
                    {
                        "text": "good pick, lad"
                    },
                    {
                        "text": `slot 2 it is then?`
                    },
                    {
                        "text": "well, off we go!"
                    }
                ]
                if(!eng.data.save_information.saves[1].exists) {
                    l.push({
                        "text": "actually, do you know how hard it is to make a new timeline?"
                    },
                    {
                        "text": "it's quite a lot of work. why should i, at your whim?"
                    },
                    {
                        "text": "hmmm????"
                    },
                    {
                        "text": "oh im just messing around here you go"
                    })
                }
                eng.openDialogue({
                    "lines": l,
                    "fns": {"onEnd": async (eng) => { 
                        eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle"); 
                        await eng.swapSave(1); 
                        eng.swapScenes("garden", async () => {
                            await eng.refreshSave();
                            await eng.getAllSaveInformation();
                        })
                    }}
                })
            }),
            new Clickbox(new Rect2D(Vector.two(0.65, 0.1), 0.2, 0.28), (eng) => { 
                if(eng.data.save_information.selected_slot == 2) {
                    eng.spriteMap.stopgo.anim.changeAnim("talk"); 
                    eng.spriteMap.stopgo.anim.current.setFrame(2);
                    eng.openDialogue({
                        "lines": [
                            {
                                "text": "hey you're already in that timeline"
                            },
                            {
                                "text": "don't mess with me"
                            }
                        ],
                        "fns": {"onEnd": (eng) => { eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle") }}
                    });
                    return;
                }
                eng.spriteMap.stopgo.anim.changeAnim("talk"); 
                eng.spriteMap.stopgo.anim.current.setFrame(2);

                let l = [
                    {
                        "text": "you actually chose slot 3?"
                    },
                    {
                        "text": `why would you need 3 slots?`
                    },
                    {
                        "text": "3's an unlucky number, you know..."
                    }
                ]
                if(!eng.data.save_information.saves[2].exists) {
                    l.push({
                        "text": "actually, do you know how hard it is to make a new timeline?"
                    },
                    {
                        "text": "it's quite a lot of work. why should i, at your whim?"
                    },
                    {
                        "text": "hmmm????"
                    },
                    {
                        "text": "oh im just messing around here you go"
                    })
                }
                eng.openDialogue({
                    "lines": l,
                    "fns": {"onEnd": async (eng) => { 
                        eng.spriteMap.stopgo.anim.resetAndChangeAnim("idle"); 
                        await eng.swapSave(2); 
                        eng.swapScenes("garden", async () => {
                            await eng.refreshSave()
                            await eng.getAllSaveInformation();
                        })
                    }}
                })
            }),
        ],
        "movement": {
            "down": (eng) => {
                eng.swapScenes("garden", () => {
                    eng.toggleHands();
                    eng.data.hands.yVel = -100;
                })
            }
        }
    }
}

class Save {
    static settings_index = {
        AUTOSAVE_INTERVAL: 0,
        DO_AUTOSAVES: 1,
        HIDE_NOTIFICATIONS: 2,
        TRANSPARENT_NOTIFICATIONS: 3,
        DO_CLOUDS: 4,
        SCENE_TRANSITION_SPEED: 5,
        DO_CURSOR_EFFECTS: 6,
        OPTIMIZE_DIRT: 7,
        PHYSICS_ITERATIONS: 8
    }
    static PERFORMANCE_SETTINGS = {
        0: null,
        1: null,
        2: null,
        3: null,
        4: false,
        5: null,
        6: false,
        7: true,
        8: 1
    }
    static DEFAULT_SETTINGS = () => { return [
        60,
        true,
        false,
        false,
        true,
        400,
        true,
        false,
        10
    ] }
    constructor() {
        this.dirt = null;
        this.inventory = null;

        this.settings = Save.DEFAULT_SETTINGS();
    }

    optimizeSettingsForPerformance() { Object.values(Save.PERFORMANCE_SETTINGS).forEach((s, i) => this.settings[i] = s) }

    addItemToInventory() {}

    serialize(eng) {
        return JSON.stringify({
            "dirt": eng.dirt.simulation.serializeBinary(),
            "settings": this.settings
        });
    }
    static fromSerialized(data) {
        const json = JSON.parse(data);
        const save = new Save();
        save.dirt = json.dirt;
        save.settings = json.settings;
        return save;
    }

    refreshValuesInEngine(eng) {
        eng.dirt.simulation.deserializeBinary(this.dirt);
        if(this.dirt == null) eng.dirt.simulation.resetArrays();
        eng.dirt.timeout_timer = 1;
    }
    refreshValuesFromEngine(eng) {
        this.dirt = eng.dirt.simulation.serialize();
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

        const pcan = document.createElement("canvas");
        const pcanctx = pcan.getContext("2d");
        pcan.width = window.innerWidth;
        pcan.height = window.innerHeight;
        pcanctx.webkitImageSmoothingEnabled = false;
        pcanctx.mozImageSmoothingEnabled = false;
        pcanctx.imageSmoothingEnabled = false;
        this.physics = {
            "canvas": pcan,
            "ctx": pcanctx,
            "simulation": new PhysicsContext2D(Vector.four(0, 0, 512, 512)),
            "size": 512
        }
        this.dirt = {
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
            "lastSave": new Date().toLocaleTimeString(),
            "timeToNextAutosave": null,
            "frame": 0,
            "hands": {
                "yVel": null,
                "clamp": [null, null],
                "active": false
            },
            "notifications": [],
            "dialogue": {
                "active": false,
                "line": 0,
                "data": null,
                "last_dialogue": null,
                "timer": 0,
                speed: 25 // ms
            }
        }

        this.spriteMap = {}
        this.allSprites = [];
        this.screenEffects = [];
        this.globalClickboxes = [];

        this.block_movement = false;
    }

    async run() {
        const loading_div = document.getElementById("loading");
        const loading_text = document.getElementById("loading-text")
        const loadStartTime = performance.now();
        let dots = 0;
        const dot_interval = setInterval(() => {
            if(dots === 21) return;
            else if(dots === 6) {
                const ele = document.createElement("p");
                ele.id = "filler-text"
                ele.textContent = "this is taking a while...";
                loading_div.appendChild(ele);
            }
            else if(dots === 12) document.getElementById("filler-text").textContent = "this is taking a REALLY LONG TIME!"
            else if(dots === 20) {
                loading_text.textContent = "(:-[)|￣|_";
                document.getElementById("filler-text").textContent = "something is probably wrong :(";
                dots += 1;
                return;
            }
            loading_text.textContent += ".";
            dots += 1;
        }, 500)
        await this.load();
        await this.init();
        const loadTime = performance.now() - loadStartTime;
        console.log(`loaded in ${loadTime/1000}s!`);
        clearInterval(dot_interval);

        loading_div.remove();
        this.ctx.canvas.style.display = "block";
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
        this.keyboard.listenForEvents(["Space", "KeyS", "KeyC", "KeyD"]);
        this.keyboard.setFunctionOnKeyPress("Space", () => {
            if(this.data.scene != "garden") return;
            this.toggleHands();
        })

        this.keyboard.setFunctionOnKeyPress("KeyS", async () => {
            await this.uploadSaveData();
            this.spawnNotification("saved the game", `last saved: ${this.data.lastSave}`, 3*1000, { "color": "rgba(255, 255, 255, 1)"});
            this.data.lastSave = new Date().toLocaleTimeString();
            this.data.timeToNextAutosave = this.save.settings[Save.settings_index.AUTOSAVE_INTERVAL];
        })
        this.keyboard.setFunctionOnKeyPress("KeyC", async () => {
            this.dirt.simulation.resetArrays();
            this.dirt.timeout_timer = 5;
        })
        this.keyboard.setFunctionOnKeyPress("KeyD", async () => {
            this.data.showClickboxes = !this.data.showClickboxes
        })

        window.addEventListener("resize", () => this.resize())
        this.ctx.canvas.addEventListener("mousemove", e => {
            this.mouse.pos.xySetIp(e.clientX, e.clientY);
            this.dirt.simulation.mousePos = [e.clientX, e.clientY];
        });

        this.ctx.canvas.addEventListener("mousedown", e => {
            if(e.button === 0) this.dirt.simulation.typeToPlace = 0
            else this.dirt.simulation.typeToPlace = 1;
            this.dirt.simulation.mousePressed = true;

            if(e.button === 0) this.onClick();
        });
        
        this.ctx.canvas.addEventListener("mouseup", () => {
            this.dirt.simulation.mousePressed = false;
            this.dirt.timeout_timer = 5;
        });

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

        await this.refreshSave(); // must be before setupSprites
        this.data.timeToNextAutosave = this.save.settings[Save.settings_index.AUTOSAVE_INTERVAL]; // must be after refreshSave
        this.setupSprites();
        this.down_clickbox = new Clickbox(new Rect2D(Vector.two(0.45, 0.75), 0.18, 0.18), (eng) => { sceneData[eng.data.scene].movement.down(eng) })
            .withCursorStyle("alias")
        this.down_clickbox.active = false;
        this.globalClickboxes.push(this.down_clickbox);
        this.refreshMovementArrows();
        
        let timeout;
        const callHandler = (fn) => {
            if(timeout == null) timeout = performance.now()-1000;
            if(timeout > performance.now()-500) return;
            fn();
            timeout = performance.now();
        }
        const settings_handler = () => {
            console.log("settings");
        };
        let spawn = 0;
        const seeds_handler = () => {
            const w = 150;

            spawn += 1;
            this.physics.simulation.physicsObjects.forEach(o => o.extraData.floorCollision = false);
            
            for(let a = 0; a < 10; a++) {
                const o = new PhysicsSquare2D(Vector.two(clamp(Math.floor(Math.random() * this.physics.size), w, this.physics.size - w/2), (3*-w) + Math.random()*(2*w)), w);
                o.art = Math.random() > 0.5 ? this.loader.getImage("garden-art-29") : this.loader.getImage("garden-art-28")
                o.draw = (ctx) => {
                    ctx.save();
                    ctx.translate(o.pos.x, o.pos.y);
                    ctx.rotate(o.angle);
                    const invHalf = -o.size / 2;
                    ctx.drawImage(o.art, invHalf, invHalf, o.size, o.size)
                    ctx.restore();
                }
                this.physics.simulation.addObject(o)
            };
        }
        const exit_handler = () => {
            window.location.href = "/"
        }
        const saves_handler = () => {
            this.swapScenes("saves");
            //this.toggleHands();
        }
        const unlocks_handler = () => {
            console.log("unlocks")
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
            new Clickbox(new Rect2D(Vector.two(0.73, 0.88), 0.04, 0.03),   () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.76, 0.875), 0.05, 0.025), () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.78, 0.84), 0.05, 0.03),   () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.82, 0.82), 0.05, 0.03),   () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.86, 0.8), 0.05, 0.03),    () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            new Clickbox(new Rect2D(Vector.two(0.9, 0.78), 0.05, 0.03),    () => { callHandler(exit_handler, "exit") }).withCursorStyle("alias"),
            
            // saves bracelet
            new Clickbox(new Rect2D(Vector.two(0.75, 0.93), 0.04, 0.03),   () => { callHandler(saves_handler, "saves") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.78, 0.925), 0.05, 0.025), () => { callHandler(saves_handler, "saves") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.8, 0.89), 0.05, 0.03),    () => { callHandler(saves_handler, "saves") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.84, 0.87), 0.05, 0.03),   () => { callHandler(saves_handler, "saves") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.88, 0.85), 0.05, 0.03),   () => { callHandler(saves_handler, "saves") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.92, 0.83), 0.05, 0.03),   () => { callHandler(saves_handler, "saves") }).withCursorStyle("pointer"),

            // unlocks bracelet
            new Clickbox(new Rect2D(Vector.two(0.75, 0.98), 0.04, 0.03),   () => { callHandler(unlocks_handler, "unlocks") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.78, 0.975), 0.05, 0.025), () => { callHandler(unlocks_handler, "unlocks") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.8, 0.94), 0.05, 0.03),    () => { callHandler(unlocks_handler, "unlocks") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.84, 0.92), 0.05, 0.03),   () => { callHandler(unlocks_handler, "unlocks") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.88, 0.9), 0.05, 0.03),    () => { callHandler(unlocks_handler, "unlocks") }).withCursorStyle("pointer"),
            new Clickbox(new Rect2D(Vector.two(0.92, 0.88), 0.05, 0.03),   () => { callHandler(unlocks_handler, "unlocks") }).withCursorStyle("pointer"),
        ]
        this.hand_clickboxes.forEach(c => c.active = false)
        this.globalClickboxes = this.globalClickboxes.concat(this.hand_clickboxes).reverse();
    }
    tick(elapsed) {
        if(this._previousElapsed === null) {
            this._previousElapsed = elapsed;
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        }

        this.frame = this.frame == 0 ? 1 : 0;
    
        const delta = Math.min(
            (elapsed - this._previousElapsed) / 1000,
            0.12
        );
    
        this._previousElapsed = elapsed;

        if(this.fps_data.length == 5) this.fps_data.pop();
        this.fps_data.push(delta || 0);

        if(!Number.isFinite(delta)) {
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        };

        if(this.dirt.timeout_timer > 0 || this.dirt.simulation.mousePressed) {
            this.dirt.timeout_timer -= delta;
            if(this.save.settings[Save.settings_index.OPTIMIZE_DIRT]) {
                if(this.frame == 0) this.dirt.simulation.update(delta*2);
            } else this.dirt.simulation.update(delta);
            this.dirt.simulation.render()
        }

        this.physics.simulation.iterations = this.save.settings[Save.settings_index.PHYSICS_ITERATIONS];
        this.physics.simulation.step(delta);
        this.physics.simulation.draw(this.physics.ctx);

        this.update(delta);
        this.render();

        window.requestAnimationFrame(this.tick.bind(this));
    }

    toggleHands() {
        const hand_amp = 3;

        this.data.hands = {
            "yVel": !this.data.hands.active ? hand_amp*-1 : hand_amp,
            "clamp": !this.data.hands.active ? [0, 1] : [-1, 1],
            "active": !this.data.hands.active
        };

        this.dirt.simulation.canPlace = this.data.hands.active;
        this.hand_clickboxes.forEach(c => c.active = this.data.hands.active)
        if(!this.data.hands.active) {
            this.physics.simulation.simulationVariables.GRAVITY = PhysicsContext2D.DEFAULT_SIM_VARIABLES().GRAVITY*4;
            this.physics.simulation.physicsObjects.forEach(o => o.extraData.floorCollision = false);
        } else this.physics.simulation.simulationVariables.GRAVITY = PhysicsContext2D.DEFAULT_SIM_VARIABLES().GRAVITY;
    }

    openDialogue(data) {
        this.data.dialogue.data = data;
        this.data.dialogue.line = 0;
        this.data.dialogue.active = true;
        this.data.dialogue.timer = 0;
        this.setMovementBlocking(true);
    }

    openRandomDialogueFromList(l) {
        let nlist = l.filter(l1 => l1 != this.data.dialogue.last_dialogue);
        if(nlist.length == 0) nlist = l;
        const d = getRandomFromList(nlist);
        this.data.dialogue.last_dialogue = d;
        this.openDialogue(d);
    }
    progressDialogue() {
        if((this.data.dialogue.timer*1000) < this.data.dialogue.data.lines[this.data.dialogue.line].text.length * this.data.dialogue.speed) {
            this.data.dialogue.timer = 100;
            return;
        }
        this.data.dialogue.line += 1;
        this.data.dialogue.timer = 0;
        if(this.data.dialogue.line >= this.data.dialogue.data.lines.length) this.closeDialogue();
    }
    closeDialogue() {
        if(this.data.dialogue.data.fns.onEnd != null) this.data.dialogue.data.fns.onEnd(this);
        this.data.dialogue.data = null;
        this.data.dialogue.line = 0;
        this.data.dialogue.active = false;
        this.setMovementBlocking(false);
    }

    spawnNotification(title, subtitle, lifetime, opts = {
        color: "rgba(255, 255, 255, 1)",
        fontSizes: [30, 20]
    }) {
        const now = performance.now();
    
        const n = {
            creationTime: now,
            endTime: now + lifetime,
    
            enterDuration: 400,
            exitDuration: 300,
    
            title,
            subtitle,
            color: opts.color,
            fontSizes: opts.fontSizes,
            lifetime
        };
    
        this.data.notifications.push(n);
        return n;
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
            const bb = hands.getBounds(this.getBoundingBox());
            ctx.drawImage(hands.anim.get(), bb.pos.x, bb.pos.y, bb.w, bb.h);
        }

        let stopgo_animator = new Animator();
        stopgo_animator.addAnim(new Animation(this.loader.imageSet("garden-art-34"), -1), "idle");

        stopgo_animator.addAnim(new Animation(this.loader.imageSet("garden-art-35"), -1), "red");
        sceneData.saves.clickboxes[1].extraData = { "stopgoColor": "red" }
        stopgo_animator.addAnim(new Animation(this.loader.imageSet("garden-art-37"), -1), "green");
        sceneData.saves.clickboxes[2].extraData = { "stopgoColor": "green" }
        stopgo_animator.addAnim(new Animation(this.loader.imageSet("garden-art-39"), -1), "blue");
        sceneData.saves.clickboxes[3].extraData = { "stopgoColor": "blue" }

        stopgo_animator.addAnim(new Animation(this.loader.imageSet("garden-art-36", "garden-art-38", "garden-art-40"), 0.8), "talk");
        const stopgo = this.createSprite(new Rect2D(Vector.two(0, 0.07), 1, 1), stopgo_animator, "saves");
        this.spriteMap.stopgo = stopgo;
        stopgo_animator.changeAnim("idle")

        const colors = ["#b26161", "#569353", "#748ebc"];
        const setupSave = (art, pos, amp, speed, slot) => {
            let anim = new Animator();
            anim.addAnim(new Animation(this.loader.imageSet(`garden-art-${art}`), -1), "idle");
            const save = this.createSprite(new Rect2D(pos, 0.5, 0.5), anim, "saves");
            anim.changeAnim("idle");

            save.extraData.time = 0;
            save.extraData.updateFn = (delta) => {
                save.extraData.time += delta * 0.1;
                save.rect.pos.y = Math.sin(save.extraData.time * speed) * amp;
            };
            save.extraData.renderFn = (ctx, bounds) => {
                const bb = save.getBounds(bounds);

                // todo: turn off w/ performance mode
                const selected = this.data.save_information.selected_slot == slot;
                const exists = this.data.save_information.saves[slot].exists || selected;

                ctx.globalAlpha = exists ? 1 : 0.5
                ctx.shadowColor = colors[slot];
                ctx.shadowBlur = selected ? 40 : 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                ctx.drawImage(save.anim.get(), bb.pos.x, bb.pos.y, bb.w, bb.h);
                ctx.shadowBlur = 0; 
                ctx.globalAlpha = 1
            }
        }

        setupSave(30, Vector.two(0, 0),    0.02,  30, 0);
        setupSave(31, Vector.two(0.25, 0), 0.013, 40, 1);
        setupSave(32, Vector.two(0.5, 0),  0.017, 25, 2);
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

        this.dirt.canvas.width = window.innerWidth;
        this.dirt.canvas.height = window.innerHeight;

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

    swapScenes(newScene, onSwap=null, releaseHands=true) {
        let e = this.applyScreenEffect("fadeOutIn", {"ms": this.save.settings[Save.settings_index.SCENE_TRANSITION_SPEED], "blackTime": 100});
        e.onBlack = () => {
            this.data.scene = newScene;
            this.refreshMovementArrows();

            if(this.data.hands.active && releaseHands) {
                this.toggleHands()
                this.data.hands.yVel = 100;
            }

            if(onSwap != null) onSwap();
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

        this.dirt.simulation.setBounds(this.data.bb);
        this.dirt.canvas.width = this.dirt.simulation.gridWidth * this.dirt.simulation.CELLSIZE;
        this.dirt.canvas.height = this.dirt.simulation.gridHeight * this.dirt.simulation.CELLSIZE;
        this.dirt.timeout_timer = 5;

        this.physics.canvas.width = this.data.bb.w;
        this.physics.canvas.height = this.data.bb.h;

        const oldW = this.physics.simulation.bounds.z;
        const oldH = this.physics.simulation.bounds.w;

        const scaleX = this.data.bb.w / oldW;
        const scaleY = this.data.bb.h / oldH;

        for (const obj of this.physics.simulation.physicsObjects) {
            obj.pos.x *= scaleX;
            obj.pos.y *= scaleY;

            obj.size *= (scaleX + scaleY)/2;
        }

        this.physics.simulation.bounds = Vector.four(
            0,
            0,
            this.data.bb.w,
            this.data.bb.h
        );
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

    async autosave() {
        await this.uploadSaveData();
        this.spawnNotification("autosave", `last saved: ${this.data.lastSave}`, 3*1000, { "color": "rgba(255, 255, 255, 1)"});
        this.data.lastSave = new Date().toLocaleTimeString();
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
            const characters = line.slice(0, this.data.dialogue.timer / this.data.dialogue.speed * 1000)
            this.drawTextWrap(characters, bb.x+60, ctx.canvas.height-190, bb.w-100, 40);
        }

        if(this.data.scenetime == 6) ctx.filter = `brightness(50%)`
        ctx.drawImage(this.dirt.canvas, bb.x, bb.y + (this.spriteMap.hands.rect.pos.y*bb.h), bb.w, bb.h);
        ctx.drawImage(this.physics.canvas, bb.x, bb.y);
        ctx.filter = `none`;

        if(!this.save.settings[Save.settings_index.HIDE_NOTIFICATIONS]) {
            if(this.save.settings[Save.settings_index.TRANSPARENT_NOTIFICATIONS]) ctx.globalAlpha = 0.5;
            const notifProperties = { "w": bb.w*0.3, "h": bb.h*0.1, "yPadding": bb.h*0.02, "xPadding": -bb.h*0.03 };
            this.data.notifications.forEach((n, i) => {        
                const now = performance.now();
    
                const enterT = Math.min((now - n.creationTime) / n.enterDuration, 1);
                const exitStart = n.endTime - n.exitDuration;
                const exitT = Math.max(0, Math.min((now - exitStart) / n.exitDuration, 1.5));
                const enter = easeOutBack(enterT);
                const exit = easeInBack(exitT);
    
                const targetX = (bb.x + bb.w) - notifProperties.w + notifProperties.xPadding;
                const targetY = bb.y + notifProperties.yPadding * (i + 1) + notifProperties.h * i;
                const pos = Vector.two(targetX + (1 - enter) * notifProperties.w + exit * notifProperties.w, targetY);
    
                ctx.fillStyle = n.color ?? `rgba(255, 255, 255, 1)`;
                ctx.fillRect(pos.x, pos.y, notifProperties.w, notifProperties.h);
                ctx.strokeStyle = `rgba(0, 0, 0, 1)`;
                ctx.strokeRect(pos.x, pos.y, notifProperties.w, notifProperties.h);
    
                ctx.fillStyle = `rgba(0, 0, 0, 1)`;
                const font_sizes = (n.fontSizes ?? [0.1, 0.08]).map(s => s *= notifProperties.w);
                ctx.font = `${font_sizes[0]}px Arial`;
                ctx.fillText(n.title, pos.x+Math.floor(font_sizes[0]/3), pos.y+font_sizes[0])
                ctx.font = `${font_sizes[1]}px Arial`;
                ctx.fillStyle = `rgba(128, 128, 128, 1)`;
                ctx.fillText(n.subtitle, pos.x+Math.floor(font_sizes[0]/3), pos.y+notifProperties.h-(font_sizes[1]/2))
            });
            ctx.globalAlpha = 1;
        }

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

        if(this.mouse.pos.x > bounds.x && this.mouse.pos.x < (bounds.w+bounds.x)) {
            const mousePos = this.mouse.pos.sub(bounds.x, bounds.y);
            const cursor_vertices = getSquareAsVertices(this.mouse.pos, 10, 0);
            let has_clicked = false;
            this.physics.simulation.physicsObjects.forEach(o => {
                if(has_clicked) return;
                const pos = o.pos.xyAdd(bounds.x, bounds.y);
                const info = Maths.SAT(pos.x, pos.y, mousePos.x, mousePos.y, getSquareAsVertices(pos, o.size, o.angle), cursor_vertices);
                if(info) {
                    this.physics.simulation.physicsObjects.splice(this.physics.simulation.physicsObjects.indexOf(o), 1);
                    has_clicked = true;
                }
            })
            if(has_clicked) {
                this.dirt.simulation.mousePressed = false;
                return;
            }
        }

        if(this.data.dialogue.active) { this.progressDialogue(); return; }
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

        this.allSprites.filter( s => s.scene == this.data.scene ).forEach(s => {
            s.anim.update(delta)
            });
        this.allSprites.forEach(s => s.extraData.updateFn(delta))

        if(this.save.settings[Save.settings_index.DO_CLOUDS]) {
            this.data.cloudTimer -= delta;
            if(this.data.cloudTimer < 0) {
                this.spawnCloud()
                this.data.cloudTimer = Math.floor(Math.random()*30);
            }
        }
        

        const bounds = this.getBoundingBox();
        this.physics.simulation.physicsObjects.forEach(o => {
            if(bounds.h - o.pos.y < o.size*-1.1) this.physics.simulation.physicsObjects.splice(this.physics.simulation.physicsObjects.indexOf(o), 1)
        })

        if(this.data.dialogue.active) this.data.dialogue.timer += delta;

        if(this.save.settings[Save.settings_index.DO_AUTOSAVES]) {
            this.data.timeToNextAutosave -= delta;
            if(this.data.timeToNextAutosave < 0) {
                this.autosave();
                this.data.timeToNextAutosave = this.save.settings[Save.settings_index.AUTOSAVE_INTERVAL];
            }
        }

        this.data.notifications.forEach(n => {
            n.lifetime -= (delta*1000);
            if(n.lifetime < 0) {
                this.data.notifications.splice(this.data.notifications.indexOf(n), 1);
            }
        })


        // cursor effects
        document.body.style.cursor = "default";
        if(!this.save.settings[Save.settings_index.DO_CURSOR_EFFECTS]) return;
        if(this.data.dialogue.active) {
            document.body.style.cursor = "pointer";
            return;
        }
        if(this.dirt.simulation.mousePressed && this.data.hands.active) {
            if((this.mouse.pos.y-bounds.y) / bounds.h < 0.65) document.body.style.cursor = "none"
        }
        if(!this.data.hands.active) {
            const d = {};
            sceneData[this.data.scene].clickboxes.concat(this.globalClickboxes).filter(c => c.active).forEach(c => {
                const bb = c.getBounds(bounds);
                if(Maths.rectRect(this.mouse.pos.x-5, this.mouse.pos.y-5, this.mouse.w, this.mouse.h, bb.x, bb.y, bb.w, bb.h)) {
                    document.body.style.cursor = c.cursor;
                    if(c.extraData.stopgoColor != null && d.stopgo == null) {
                        this.spriteMap.stopgo.anim.resetAndChangeAnim(c.extraData.stopgoColor)
                        d.stopgo = true;
                    }
                }
            });
            if(!d.stopgo) this.spriteMap.stopgo.anim.resetAndChangeAnim("idle")
        } else {
            this.globalClickboxes.filter(c => c.active).forEach(c => {
                const bb = c.getBounds(bounds);
                if(Maths.rectRect(this.mouse.pos.x-5, this.mouse.pos.y-5, this.mouse.w, this.mouse.h, bb.x, bb.y, bb.w, bb.h)) {
                    document.body.style.cursor = c.cursor;
                }
            });

            const cursor_vertices = getSquareAsVertices(this.mouse.pos, 10, 0);
            const mousePos = this.mouse.pos.sub(bounds.x, bounds.y);
            if(mousePos.x < 0 || mousePos.x > bounds.w) return
            this.physics.simulation.physicsObjects.forEach(o => {
                const pos = o.pos.xyAdd(bounds.x, bounds.y);
                const info = Maths.SAT(pos.x, pos.y, mousePos.x, mousePos.y, getSquareAsVertices(pos, o.size, o.angle), cursor_vertices);
                if(info) {
                    document.body.style.cursor = "pointer";
                }
            })
        }
    }

    async uploadSaveData() {
        const user = JSON.parse(window.localStorage.getItem("user"));
        await fetch(getApiLink("/mini/garden/saves/set"), {
            method: "POST",
            body: JSON.stringify({
                "name": user.account.name,
                "pass": user.account.pass,
                "save": this.save.serialize(this)
            })
        });
        await this.getAllSaveInformation()
    }
    async fetchSaveData() {
        try {
            const user = JSON.parse(window.localStorage.getItem("user"));
            const req = await fetch(getApiLink("/mini/garden/saves/get"), {
                method: "POST",
                body: JSON.stringify({
                    "name": user.account.name,
                    "pass": user.account.pass
                })
            }); ;
            return await req.json();
        } catch { return null; }
    }
    async refreshSave() {
        const save_data = await this.fetchSaveData();
        if(save_data != null) {
            this.save = Save.fromSerialized(JSON.stringify(save_data));
        }
        else {
            this.save = new Save();
            console.log("fresh save")
            this.spawnNotification("welcome to hell", "first join the game", 5*1000, { "color": "rgba(252, 220, 92, 1)" })
            await this.uploadSaveData()
        }
        this.save.refreshValuesInEngine(this);
        await this.getAllSaveInformation()
    }
    async getAllSaveInformation() {
        const user = JSON.parse(window.localStorage.getItem("user"));
        const req = await fetch(getApiLink("/mini/garden/saves/list"), {
            method: "POST",
            body: JSON.stringify({
                "name": user.account.name,
                "pass": user.account.pass
            })
        });

        this.data.save_information = await req.json();
    }
    async swapSave(slot) {
        const user = JSON.parse(window.localStorage.getItem("user"));
        await fetch(getApiLink("/mini/garden/saves/setSlot"), {
            method: "POST",
            body: JSON.stringify({
                "name": user.account.name,
                "pass": user.account.pass,
                "save_slot": slot
            })
        });
    }
}

const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d");

const engine = new Engine(ctx);
await engine.run();