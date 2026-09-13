/**
 * author thebadlorax
 * created on 25-06-2026-18h-32m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Loader, drawRotatedImage } from "../mini-common.js";
import { Vector, Maths, Rect2D } from "../maths.js";
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
            "updateFn": (delta) => {}
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
        ctx.drawImage(this.anim.get(), bb.pos.x + off.x, bb.pos.y + off.y, bb.w, bb.h);
    }
}

class Clickbox {
    constructor(rect, onclick) {
        this.rect = rect;
        this.onclick = onclick;
        this.active = true;
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
            })
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
                eng.openDialogue({
                    "lines": [
                        {
                            "text": "this is a super long string of dialogue to test my beautiful dialogue system"
                        },
                        {
                            "text": "this is a second super long string of dialogue to test my beautiful dialogue system"
                        },
                    ],
                    "fns": { "onEnd": () => { eng.spriteMap.shopkeep.anim.resetAndChangeAnim("idle") } }
                }); 
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
            "hands": {
                "yVel": null,
                "clamp": [null, null]
            },
            "dialogue": {
                "active": false,
                "line": 0,
                "data": null
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
        this.keyboard.listenForEvents(["Tab"]);
        this.keyboard.setFunctionOnKeyPress("Tab", () => {
            if(this.data.scene != "garden") return;
            const hand_amp = 3;
            this.data.hands = {
                "yVel": this.data.hands.yVel != hand_amp*-1 ? hand_amp*-1 : hand_amp,
                "clamp": this.data.hands.yVel != hand_amp*-1 ? [0, 1] : [-1, 1]
            };
        })
        window.addEventListener("resize", () => this.resize())
        this.ctx.canvas.addEventListener("mousemove", e => {
            this.mouse.pos.xySetIp(e.clientX, e.clientY);
        });
        this.ctx.canvas.addEventListener("click", () => {
            this.onClick();
        })
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                this.tabOutTime = performance.now(); 
            } else if (document.visibilityState === "visible") {
                if (this.tabOutTime > 0) {
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
        this.down_clickbox.active = false;
        this.globalClickboxes.push(this.down_clickbox);
        this.refreshMovementArrows();
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

        this.update(delta);
        this.render();

        window.requestAnimationFrame(this.tick.bind(this));
    }

    openDialogue(data) {
        this.data.dialogue.data = data;
        this.data.dialogue.line = 0;
        this.data.dialogue.active = true;
        this.setMovementBlocking(true);
    }
    progressDialogue() {
        this.data.dialogue.line += 1;
        if(this.data.dialogue.line >= this.data.dialogue.data.lines.length) this.closeDialogue();
    }
    closeDialogue() {
        if(this.data.dialogue.data.fns.onEnd != null) this.data.dialogue.data.fns.onEnd();
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
        hand_animator.addAnim(new Animation(this.loader.imageSet("garden-art-27"), -1), "idle");
        const hands = this.createSprite(new Rect2D(Vector.two(0, 1), 1, 1), hand_animator, "garden");
        hand_animator.changeAnim("idle");
        this.spriteMap.hands = hands;
        hands.extraData.updateFn = (delta) => {
            if(this.data.hands.yVel != null) {
                hands.rect.pos.y = clamp(hands.rect.pos.y + delta*this.data.hands.yVel, this.data.hands.clamp[0], this.data.hands.clamp[1])
            }

        }
    }

    createSprite(rect, animator, scene) {
        let s = new Sprite(rect, animator, scene)
        this.allSprites.push(s)
        return s;
    }
    spawnCloud() {
        const anim = new Animator();
        anim.addAnim(new Animation(this.loader.imageSet(Math.random() > 0.5 ? "garden-art-25" : "garden-art-26"), -1), "idle");
        const size = clamp(Math.random()*2, 0.45, 0.55)
        const cloud = this.createSprite(new Rect2D(Vector.two(0.8 + (Math.random() * 0.2), -Math.random()*0.2), size, size), anim, "garden");
        cloud.layer = 0;
        cloud.extraData.cloudSpeed = clamp(Math.random(), 0.1, 0.3) * 0.2;
        cloud.extraData.updateFn = (delta) => {
            cloud.rect.pos.x -= delta*cloud.extraData.cloudSpeed;
            if(cloud.rect.pos < -1) this.allSprites.splice(this.allSprites.indexOf(cloud), 1);
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
        }
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

                    if (elapsed >= e.ms+200) {
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
          
          if (testWidth > maxWidth && n > 0) {
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

        ctx.save();
        ctx.rect(bb.x, bb.y, bb.w, bb.h);
        ctx.clip();

        sceneData[this.data.scene].renderFn(this, this.allSprites.filter(s => s.scene == this.data.scene && s.layer == 0));
        this.allSprites.filter(s => s.scene == this.data.scene && s.layer > 0).sort((a, b) => a.layer - b.layer).forEach(s => s.render(ctx, bb));
        if(this.data.dialogue.active) {
            ctx.fillStyle = `rgba(255, 255, 255, 1)`
            ctx.fillRect(bb.x+50, ctx.canvas.height-225, bb.w-100, 200)
            ctx.strokeStyle = `rgba(0, 0, 0, 1)`
            ctx.strokeRect(bb.x+50, ctx.canvas.height-225, bb.w-100, 200)

            ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            ctx.font = `30px Arial`;
            const line = this.data.dialogue.data.lines[this.data.dialogue.line].text;
            this.drawTextWrap(line, bb.x+60, ctx.canvas.height-190, bb.w-90, 40)
        }

        ctx.restore(); // clip out everything beyond the bounds

        this.screenEffects.forEach(e => {
            switch(e.type) {
                case "fadeOutIn": {
                    const elapsed = e.updateTime - e.startTime;
        
                    let alpha = 0;
        
                    if (elapsed < e.fadeOutTime) {
                        alpha = elapsed / e.fadeOutTime;
                    } else if (elapsed < e.fadeOutTime + e.blackTime) {
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
            sceneData[this.data.scene].clickboxes.concat(this.globalClickboxes).filter(c => c.active).forEach(c => {
                c.render(ctx, bb)
            })
        }
    }

    onClick() {
        const bounds = this.getBoundingBox();
        if(this.data.dialogue.active) {
            this.progressDialogue();
            return;
        }
        if(this.data.hands.yVel == null || this.data.hands.yVel > 0) {
            sceneData[this.data.scene].clickboxes.concat(this.globalClickboxes).filter(c => c.active).forEach(c => {
                const bb = c.getBounds(bounds);
                if(Maths.rectRect(this.mouse.pos.x-5, this.mouse.pos.y-5, this.mouse.w, this.mouse.h, bb.x, bb.y, bb.w, bb.h)) {
                    c.onclick(this);
                }
            });
        }
    }
    
    update(delta) {
        if (!delta) return;
        this.data.time += delta * 1000;
    
        if (this.data.time >= this.data.dayLength) this.data.time %= this.data.dayLength;
        const percent = (this.data.time / this.data.dayLength) * 100;

        this.updateEffects(delta);
    
        // modify bg for shadows
        let scene = 6;
        if (percent >= 15) scene = 1;
        if (percent >= 25) scene = 2;
        if (percent >= 42) scene = 3;
        if (percent >= 50) scene = 4;
        if (percent >= 55) scene = 5;
        if (percent >= 78) scene = 6;
    
        if (scene !== this.data.scenetime) this.setSceneTime(scene);

        this.allSprites.filter(s => s.scene == this.data.scene).forEach(s => {
            s.anim.update(delta);
        });
        this.allSprites.forEach(s => {
            s.extraData.updateFn(delta);
        })

        this.data.cloudTimer -= delta;
        if(this.data.cloudTimer < 0) {
            if(scene < 4) this.spawnCloud()
            this.data.cloudTimer = Math.floor(Math.random()*30);
        }

        const bounds = this.getBoundingBox();
        document.body.style.cursor = "default"
        if(this.data.hands.yVel == null || this.data.hands.yVel > 0) {
            sceneData[this.data.scene].clickboxes.concat(this.globalClickboxes).filter(c => c.active).forEach(c => {
                const bb = c.getBounds(bounds);
                if(Maths.rectRect(this.mouse.pos.x-5, this.mouse.pos.y-5, this.mouse.w, this.mouse.h, bb.x, bb.y, bb.w, bb.h)) {
                    document.body.style.cursor = "pointer"
                }
            });
        }
        if(this.data.dialogue.active) document.body.style.cursor = "pointer"
    }
}

const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d");

const engine = new Engine(ctx);
await engine.run();