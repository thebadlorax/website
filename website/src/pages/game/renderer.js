/**
 * author thebadlorax
 * created on 06-05-2026-10h-35m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Engine, EngineSettings } from "./engine.js";
import { getApiLink } from "../common.js";

export class Loader {
    images;

    constructor() { this.images = {}; }; 

    loadImage(key, src) {
        var img = new Image();
    
        var d = new Promise(function (resolve, reject) {
            img.onload = function () {
                this.images[key] = img;
                resolve(img);
            }.bind(this);
    
            img.onerror = function () {
                reject('Could not load image: ' + src);
            };
        }.bind(this));
    
        img.src = src;
        return d;
    };

    getImage(key) { return (key in this.images) ? this.images[key] : null; };
};

export class Camera {
    constructor(map, width, height) {
        this.map = map;
        this.width = width;
        this.height = height;

        this.worldWidth  = map.data.cols * map.data.tsize;
        this.worldHeight = map.data.rows * map.data.tsize;

        this.x = 0;
        this.y = 0;
    }

    follow(sprite) {
        this.following = sprite;
    }

    update() {
        // Center camera on hero (world space)
        this.x = this.following.x - this.width / 2;
        this.y = this.following.y - this.height / 2;

        // Clamp ONLY if map is bigger than screen
        if (this.worldWidth > this.width) {
            this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.width));
        } else {
            this.x = (this.worldWidth - this.width) / 2; // negative → intentional centering
        }

        if (this.worldHeight > this.height) {
            this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.height));
        } else {
            this.y = (this.worldHeight - this.height) / 2;
        }

        // Convert hero world → screen coords
        this.following.screenX = this.following.x - this.x;
        this.following.screenY = this.following.y - this.y;
    }
};

export class WindowUIElement {
    constructor(ctx, x, y, w, h, type, data, window) {
        this.x = x; this.y = y; this.w = w; this.h = h; this.type = type;
        this.onclick = () => {}; this.visible = true; this.ctx = ctx; this.data = data;
        this.window = window;
    }

    destroy() {
        this.window.UIElements.splice(this.window.UIElements.indexOf(this), 1);
    }
};

export class Window {
    constructor(ctx, x, y, w, h, space="screen") {
        this.x = x; this.y = y; this.width = w; this.height = h;
        this.z = 0; this.ctx = ctx; this.visible = false; this.UIElements = [];
        this.space = space; this.onrender = () => {}; this.zindex = 1;
        this.opacity = 1; this.pass_clicks_through = false;
    };

    getRenderX(camera=null) {
        if(this.space === "world" && camera) {
            return this.x - camera.x;
        }
    
        return this.x;
    }
    
    getRenderY(camera=null) {
        if(this.space === "world" && camera) {
            return this.y - camera.y;
        }
    
        return this.y;
    }

    createUIElement(x, y, w, h, type, data=null) {
        let e = new WindowUIElement(this.ctx, x, y, w, h, type, data, this);
        this.UIElements.push(e);
        return e;
    }

    handleClick(mx, my, camera=null) {
        if(this.pass_clicks_through) return;
        const rx = this.getRenderX(camera);
        const ry = this.getRenderY(camera);
        this.UIElements.forEach(e => {
            if(!e.visible) return;
            if(Engine.rectanglesIntersect(mx-5, my-5, 10, 10, rx+e.x,ry+e.y, e.w, e.h)) {
                e.onclick();
            }
        })
    }

    draw(camera=null) {
        this.ctx.globalAlpha = this.opacity;
        const rx = this.getRenderX(camera);
        const ry = this.getRenderY(camera);

        this.ctx.fillStyle = "white";
        this.ctx.fillRect(rx, ry, this.width, this.height);
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(rx, ry, this.width, this.height);

        this.UIElements.forEach(e => {
            if(!e.visible) return;
            switch(e.type) {
                case "button": {
                    this.ctx.fillStyle = "gray";
                    this.ctx.fillRect(rx + e.x, ry + e.y, e.w, e.h);
                    this.ctx.strokeStyle = "black";
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(rx + e.x, ry + e.y, e.w, e.h);
                    break;
                }
                case "textbutton": {
                    this.ctx.fillStyle = "black";
                    //this.ctx.fillRect(rx + e.x, ry + e.x, e.w, e.h);
                    this.ctx.strokeStyle = e.data.strokeColor || "black";
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(rx + e.x, ry + e.y, e.w, e.h);
                    this.ctx.font = "13px monospace";

                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(
                        e.data.text,
                        rx + e.x + (e.w / 2),
                        ry + e.y + (e.h / 2)
                    );
                    break;
                }
                case "image": {
                    if(e.data.atlas == true) {
                        this.ctx.drawImage(
                            e.data.image, // image
                            (e.data.atlasIndex - 1) * e.data.tileSize, // source x
                            0, // source y
                            e.data.tileSize, // source width
                            e.data.tileSize, // source height
                            (rx + e.x)+1,
                            (ry + e.y)+1,
                            e.w-2, // target width
                            e.h-2 // target height
                        );
                    } else {
                        this.ctx.drawImage(e.data.image, (rx+e.x)+1, (ry+e.y)+1, e.w-2, e.h-2)
                    }

                    if(e.data.overlayColor != null) {
                        this.ctx.fillStyle = e.data.overlayColor;
                        this.ctx.fillRect((rx + e.x), (ry + e.y), e.w, e.h);
                    }
                    
                    this.ctx.strokeStyle = e.data.strokeColor || "black";
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(rx + e.x, ry + e.y, e.w, e.h);
                    break;
                }
                case "text": {
                    this.ctx.font = "13px monospace";
                    this.ctx.fillStyle = "black";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(
                        e.data.text,
                        rx + e.x + (e.w / 2),
                        ry + e.y + (e.h / 2)
                    );
                    break;
                }
                case "anim": {
                    const a = e.data.anim;
                    this.ctx.drawImage(
                        e.data.image, // image
                        (e.data.atlasIndex - 1) * e.data.tileSize, // source x
                        0, // source y
                        e.data.tileSize, // source width
                        e.data.tileSize, // source height
                        (rx + e.x)+1,
                        (ry + e.y)+1,
                        e.w-2, // target width
                        e.h-2 // target height
                    );
                }
            }
        });

        this.ctx.globalAlpha = 1;
    };
};

export class Renderer {
    constructor(ctx, camera, engine) {
        this.ctx = ctx;
        this.engine = engine;
        this.camera = camera;
        this.tileAtlas = this.engine.loader.getImage('tiles');

        this.windows = [];
        this.sprites = [];

        this.effects = [];
        this.active_cutscene = null;
        this.menus = new MenuRegistry(this).MENUS;
        this.active_menu = null;
    };

    _drawLayer(layer) {
        var startCol = Math.floor(this.camera.x / this.engine.hero.map.tsize);
        var endCol = Math.min(
            this.engine.hero.map.cols,
            startCol + Math.ceil(this.camera.width / this.engine.hero.map.tsize) + 1
        );
        var startRow = Math.floor(this.camera.y / this.engine.hero.map.tsize);
        var endRow = Math.min(
            this.engine.hero.map.rows,
            startRow + Math.ceil(this.camera.height / this.engine.hero.map.tsize) + 1
        );
    
        for (let c = startCol; c < endCol; c++) {
            for (let r = startRow; r < endRow; r++) {
                let tile = this.engine.hero.map.getTile(layer, c, r);
                let x = Math.floor(c * this.engine.hero.map.tsize - this.camera.x);
                let y = Math.floor(r * this.engine.hero.map.tsize - this.camera.y);
                
                if (tile !== 0) { // 0 => empty tile
                    this.ctx.drawImage(
                        this.tileAtlas, // image
                        (tile - 1) * this.engine.hero.map.tsize, // source x
                        0, // source y
                        this.engine.hero.map.tsize, // source width
                        this.engine.hero.map.tsize, // source height
                        Math.floor(x),
                        Math.floor(y),
                        this.engine.hero.map.tsize, // target width
                        this.engine.hero.map.tsize // target height
                    );
                }
            }
        }
    };

    _drawTriggers() {
        const map = this.engine.hero.map;
    
        if (!map.triggers) return;
    
        const tsize = map.tsize;
    
        for (const trigger of map.triggers) {

            let offset = null;
            let color_override = null;
            if(trigger.visual != null) {
                if(trigger.visual.color != null) color_override = trigger.visual.color
                if(trigger.visual.offset != null) offset = trigger.visual.offset;
            }

            let worldX; let worldY;
    
            // world position
            if(offset != null) {
                worldX = (trigger.x+offset.x) * tsize;
                worldY = (trigger.y+offset.y) * tsize;
            } else {
                worldX = trigger.x * tsize;
                worldY = trigger.y * tsize;
            }
            
    
            const x = Math.round(worldX - this.camera.x);
            const y = Math.round(worldY - this.camera.y);
    
            const width = (trigger.w || 1) * tsize;
            const height = (trigger.h || 1) * tsize;
    
            if(color_override != null) {
                this.ctx.fillStyle = color_override.fill;
                this.ctx.strokeStyle = color_override.stroke;
            } else {
                switch(trigger.type) {
                    case "portal":
                        this.ctx.fillStyle = "rgba(0, 100, 255, 0.35)";
                        this.ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
                        break;
                    case "dialogue":
                        this.ctx.fillStyle = "rgba(255, 255, 0, 0.35)";
                        this.ctx.strokeStyle = "rgba(255, 255, 0, 0.9)";
                        break;
                    default:
                        this.ctx.fillStyle = "rgba(255,255,255,0.2)";
                        this.ctx.strokeStyle = "white";
                        break;
                }
            }
            
    
            this.ctx.fillRect(x, y, width, height);
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);

            this.ctx.fillStyle = "white";
            this.ctx.font = "14px monospace";
            this.ctx.textAlign = "start";
            this.ctx.textBaseline = "alphabetic";
    
            this.ctx.fillText(
                trigger.type,
                x + 4,
                y + 16
            );
        }
    }

    _drawObjectsOnLayer(layer) {
        const m = this.engine.hero.map;
        const objs = m.getObjects().filter(o => o.zindex == layer);
        if(objs.length == 0) return;
        objs.forEach(o => {
            o.render(this.engine);
            if(o.draw_dialogue) o.drawDialogueWindow(this.engine);
        })
    }

    _drawGrid() {
        const map = this.engine.hero.map;
        const tsize = map.tsize;
    
        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                let worldX = c * tsize;
                let worldY = r * tsize;
    
                let x = Math.round(worldX - this.camera.x);
                let y = Math.round(worldY - this.camera.y);
    
                let isSolid = map.isSolidTileAtXY(
                    worldX + tsize / 2,
                    worldY + tsize / 2
                );
    
                if (isSolid) {
                    this.ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
                    this.ctx.fillRect(x, y, tsize, tsize);
                }

                if(this.engine.debug.level_editor.active) {
                    const sr = this.engine.debug.level_editor.multiselect.selection_rect;
                    if(sr != null) {
                        let inside_selection = Engine.rectanglesIntersect(c, r, 1, 1, sr.x, sr.y, sr.w+1, sr.h+1)
                        if(inside_selection) {
                            this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                            this.ctx.fillRect(x, y, tsize, tsize);
                        }
                    }
                }
    
                this.ctx.strokeStyle = "rgba(255,255,255,0.2)";
                this.ctx.strokeRect(x, y, tsize, tsize);
            }
        }
    };

    applyEffect(type, data) {
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

                this.effects.push(e);

                return e;
            }
        }
    }

    openMenu(menu) {
        this.engine.other_state = "menu";
        this.active_menu = menu;
    }

    closeMenu() {
        if(this.active_menu != null) {
            this.active_menu.submenus.forEach(m => m.visible = false);
            this.active_menu.submenus.forEach(m => m.submenus.forEach(e => e.visible = false))
            this.active_menu.UIElements.filter(e => e.type == "textbutton").forEach(e => e.data.strokeColor = "black");
            this.active_menu.submenus.forEach(m => m.UIElements.filter(e => e.type == "textbutton").forEach(e => e.data.strokeColor = "black"))
            this.active_menu.getAllUIElements().forEach(e => e.dragging = false);
            this.active_menu = null;
        };
        this.engine.other_state = null;
    }

    updateEffects(delta) {
        this.effects.forEach((e, index) => {
            switch(e.type) {
                case "fadeOutIn": {
                    e.updateTime += delta*1000;
                    const elapsed = e.updateTime - e.startTime;
                    
                    if(!e.onBlackCompleted && elapsed >= (e.ms+e.blackTime)/2) {
                        e.onBlackCompleted = true;
                        e.onBlack();
                    }

                    if (elapsed >= e.ms+200) {
                        this.effects.splice(index, 1);
                        return; 
                    }
                    break;
                }
            }
        });
    }

    render() { 
        const map = this.engine.hero.map;
        const layers = Object.values(map.data.layers);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height); 

        if(this.engine.state == 'main') {
            for(let x = 0; x < layers.length; x++) {
                this._drawLayer(x);
                this.sprites.filter(s => s.zindex == x && s.mapid == this.engine.hero.mapid).forEach(s => {
                    s.onrender();
                    s.render();
                });
                this._drawObjectsOnLayer(x);
            }
    
            if(this.engine.debug.show_grid || this.engine.debug.level_editor.active) {
                this._drawTriggers();
                this._drawGrid(); 
            }
    
            this.windows.filter(w => w.visible).forEach(w => { w.onrender(); w.draw(this.camera); });
    
            if(this.engine.debug.show_grid || this.engine.debug.level_editor.active) {
                this.engine.hero.drawHitbox(this.ctx);
            };
        } else if(this.engine.state == "combat") {
            this.engine.combat.render();
        } else if(this.engine.state == "cutscene") {
            if(this.active_cutscene != null) {
                this.ctx.drawImage(this.active_cutscene, 0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
                if(this.active_cutscene.ended) {
                    this.active_cutscene = null;
                    let e = this.applyEffect("fadeOutIn", {"ms": 300, "blackTime": 100});
                    e.onBlack = () => {
                        this.engine.state = "main";
                    }
                }
            }
        }; 

        this.effects.forEach((e, index) => {
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

        if(this.engine.other_state == "menu") {
            this.active_menu.render();
        };
    };
};

export class AnimationManager {
    constructor(image) {
        this.image = image;
        this.animations = [];
    }

    createAnimation(data) { this.animations.push(new Animation(data, this.image)); }

    updateAnimations(delta) { this.animations.forEach(a => a.update(delta)); }

    getAnimation(name) { return this.animations.find(a => a.name == name); }
}

export class Animation {
    constructor(data, image) {
        this.image = image;
        this.name = data.name;
        this.frames = data.frames;
        this.start_index = data.start_index;
        this.time = data.time;
        this.currentFrame = 0;
        this.frame_progress = 0;
        this.size = 64;
        this.active = true;
    }

    update(delta) {
        if(!this.active) return;
        this.frame_progress += delta;
        if(this.frame_progress >= this.time) {
            this.frame_progress = 0;
            this.currentFrame += 1; if(this.currentFrame >= this.frames) {
                this.currentFrame = 0;
            }
        }
    }

    getFrame() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const sx = this.currentFrame*this.size, sy = 0, sWidth = this.size, sHeight = this.size;
        canvas.width = sWidth;
        canvas.height = sHeight;
        ctx.drawImage(this.image, sx+(this.size*this.start_index), sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        return canvas;
    }
}

export class Cutscene {
    constructor(url, engine) {
        this.url = url;
        this.video = document.createElement("video");
        this.video.src = url;
        this.engine = engine;
        this.setupElement();
    }

    setupElement() {
        this.video.controls = false;
        this.video.autoplay = false;
        this.video.muted = true;
        this.video.width = this.engine.camera.width;
        this.video.height = this.engine.camera.height
    };

    play() {
        let e = this.engine.renderer.applyEffect("fadeOutIn", {"ms": 600, "blackTime": 100});
        e.onBlack = () => {
            this.engine.state = "cutscene";
            this.engine.renderer.active_cutscene = this.video;
            this.video.play();
        }
    }
}

export class MenuUIElement {
    constructor(ctx, x, y, w, h, type, data, menu) {
        this.x = x; this.y = y; this.w = w; this.h = h; this.type = type;
        this.onclick = null; this.visible = true; this.ctx = ctx; this.data = data;
        this.menu = menu; this.dragging = false; this.onchange = null;
    }

    destroy() {
        this.menu.UIElements.splice(this.menu.UIElements.indexOf(this), 1);
    }

    setup() {
        switch(this.type) {
            case "slider": {
                if(this.data.min == undefined) this.data.min = 0;
                if(this.data.max == undefined) this.data.max = 0;
                if(this.data.step == undefined) this.data.step = 1;
                if(this.data.progress == undefined) this.data.progress = (this.data.max/2);
                if(this.data.showVal == undefined) this.data.showVal = true;
            }
        }
    };

    setSliderFromMouse() {
        const mouseX = this.menu.renderer.engine.keyboard.mouseX;
        const rx = this.menu.getRenderX();
        const mw = this.menu.getWidth();
    
        const x = rx + (mw * this.x);
        const w = mw * this.w;
    
        let t = (mouseX - x) / w;
        t = Math.max(0, Math.min(1, t));
    
        let value =
            this.data.min +
            t * (this.data.max - this.data.min);
    
        value =
            Math.round(value / this.data.step) *
            this.data.step;

        if(this.data.progress != value) { 
            this.data.progress = value;
            if(this.onchange != null) this.onchange(); 
        }
    }

    render() {
        const rx = this.menu.getRenderX();
        const ry = this.menu.getRenderY();
        const mw = this.menu.getWidth();
        const mh = this.menu.getHeight();

        const ts = (this.data.fontSize || 13) * (this.menu.renderer.camera.width)*(0.0008+(0.0001*this.menu.renderer.engine.settings.settings.fss || 0));

        const pos = {
            "x": mw * this.x,
            "y": mh * this.y,
            "w": mw * this.w,
            "h": mh * this.h
        }
        switch(this.type) {
            case "button": {
                this.ctx.fillStyle = "gray";
                this.ctx.fillRect(rx + pos.x, ry + pos.y, pos.w, pos.h);
                this.ctx.strokeStyle = "black";
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(rx + pos.x, ry + pos.y, pos.w, pos.h);
                break;
            }
            case "textbutton": {
                if(this.data.bg_color != null) {
                    this.ctx.fillStyle = this.data.bg_color;
                    this.ctx.fillRect(rx + pos.x, ry + pos.y, pos.w, pos.h);
                }
                this.ctx.fillStyle = "black";
                this.ctx.strokeStyle = this.data.strokeColor || "black";
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(rx + pos.x, ry + pos.y, pos.w, pos.h);
                this.ctx.font = `${ts}px monospace`;

                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(
                    this.data.text,
                    rx + pos.x + (pos.w / 2),
                    ry + pos.y + (pos.h / 2)
                );
                if(this.data.fg_color != null) {
                    this.ctx.fillStyle = this.data.fg_color;
                    this.ctx.fillRect(rx + pos.x, ry + pos.y, pos.w, pos.h);
                }
                break;
            }
            case "image": {
                if(this.data.atlas == true) {
                    this.ctx.drawImage(
                        this.data.image, // image
                        (this.data.atlasIndex - 1) * this.data.tileSize, // source x
                        0, // source y
                        this.data.tileSize, // source width
                        this.data.tileSize, // source height
                        (rx + pos.x)+1,
                        (ry + pos.y)+1,
                        pos.w-2, // target width
                        pos.h-2 // target height
                    );
                } else {
                    this.ctx.drawImage(this.data.image, (rx+pos.x)+1, (ry+pos.y)+1, pos.w-2, pos.h-2)
                }

                if(this.data.overlayColor != null) {
                    this.ctx.fillStyle = this.data.overlayColor;
                    this.ctx.fillRect((rx + pos.x), (ry + pos.y), pos.w, pos.h);
                }
                
                this.ctx.strokeStyle = this.data.strokeColor || "black";
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(rx + pos.x, ry + pos.y, pos.w, pos.h);
                break;
            }
            case "text": {
                this.ctx.font = `${ts}px monospace`;
                this.ctx.fillStyle = "black";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(
                    this.data.text,
                    rx + pos.x + (pos.w / 2),
                    ry + pos.y + (pos.h / 2)
                );
                break;
            }
            case "slider": {
                const value = this.data.progress;
                const min = this.data.min;
                const max = this.data.max;
            
                const percent = (value - min) / (max - min);
            
                // Track
                this.ctx.fillStyle = "#888";
                this.ctx.fillRect(
                    rx + pos.x,
                    ry + pos.y + pos.h/2 - 3,
                    pos.w,
                    6
                );
            
                // Thumb
                const thumbX = rx + pos.x + (percent * pos.w);
            
                this.ctx.fillStyle = "#ddd";
                this.ctx.beginPath();
                this.ctx.arc(
                    thumbX,
                    ry + pos.y + pos.h/2,
                    pos.h/4,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            
                this.ctx.strokeStyle = "black";
                this.ctx.stroke();

                this.ctx.font = `${ts}px monospace`;
                this.ctx.fillStyle = "black";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                if(this.data.showVal) {
                    this.ctx.fillText(
                        this.data.progress.toFixed(2),
                        rx + pos.x + (pos.w*.95),
                        ry + pos.y + (pos.h*.9)
                    );
                }
                if(this.data.title != undefined) {
                    this.ctx.fillText(
                        this.data.title,
                        rx + pos.x + (pos.w*.5),
                        ry + pos.y
                    );
                }
                break;
            }
            case "toggle": {
                this.ctx.fillStyle = this.data.active ? "rgba(0, 255, 0, 0.3)" : "rgba(255, 0, 0, 0.3)";
                this.ctx.fillRect(rx + pos.x, ry + pos.y, pos.w, pos.h);

                this.ctx.fillStyle = "black";
                this.ctx.strokeStyle = this.data.strokeColor || "black";
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(rx + pos.x, ry + pos.y, pos.w, pos.h);
                this.ctx.font = `${ts}px monospace`;
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(
                    this.data.text,
                    rx + pos.x + (pos.w / 2),
                    ry + pos.y + (pos.h / 2)
                );
            }
        }
    }
};

export class Menu {
    constructor(renderer) {
        this.renderer = renderer;

        this.UIElements = [];
        this.submenus = [];

        this.visible = true;

        this.settings = {
            "color": {
                "bg": "white",
                "border": "black",
                "border_weight": 2,
                "game": "rgba(0, 0, 0, 0.6)"
            },
            "x": 0.01,
            "y": 0.025,
            "space": "screen",
            "width": 0.3,
            "height": 0.95,
            "hide_game": true,
            "rotation": 0 // degrees
        }
    }

    getWidth() { return this.renderer.camera.width * this.settings.width; }
    getHeight() { return this.renderer.camera.height * this.settings.height; }

    getRenderX() {
        if(this.settings.space === "world") {
            return this.settings.x - this.renderer.camera.x;
        }
        return this.renderer.camera.width * this.settings.x;
    }
    getRenderY() {
        if(this.settings.space === "world") {
            return this.settings.y - this.renderer.camera.y;
        }
        return this.renderer.camera.height * this.settings.y;
    }

    createUIElement(x, y, w, h, type, data=null) {
        let e = new MenuUIElement(this.renderer.ctx, x, y, w, h, type, data, this);
        e.setup();
        this.UIElements.push(e);
        return e;
    }

    render() {
        const ctx = this.renderer.ctx;
        const rx = this.getRenderX();
        const ry = this.getRenderY();

        if(this.settings.color.game != null) {
            ctx.fillStyle = this.settings.color.game;
            ctx.fillRect(0, 0, this.renderer.camera.width, this.renderer.camera.height);
        };

        ctx.save();

        ctx.rotate(this.settings.rotation * Math.PI / 180);
        ctx.fillStyle = this.settings.color.bg;
        ctx.fillRect(rx, ry, this.getWidth(), this.getHeight());
        ctx.strokeStyle = this.settings.color.border;
        ctx.lineWidth = this.settings.color.border_weight;
        ctx.strokeRect(rx, ry, this.getWidth(), this.getHeight());

        this.submenus.forEach(m => {
            if(m.visible) m.render();
        });

        this.UIElements.forEach(e => {
            if(e.visible) e.render();
        });

        ctx.restore();
    }

    getAllUIElements() {
        let l = [];
        const a = (m) => {
            l = l.concat(m.UIElements);
            m.submenus.filter(m => m.visible).forEach(m2 => a(m2));
        }
        a(this);
        return l;
    }

    update(delta) {
        this.getAllUIElements().forEach(e => {
            if(e.type === "slider" && e.dragging) {
                e.setSliderFromMouse(
                    this.renderer.engine.keyboard.mouseX
                );
            }
        });
    }

    onclick() {
        if( this.renderer.engine.keyboard.waiting) return;
        const mx = this.renderer.engine.keyboard.mouseX;
        const my = this.renderer.engine.keyboard.mouseY;
        const handleClick = (menu) => {
            menu.UIElements.forEach(e => {
                const rx = menu.getRenderX();
                const ry = menu.getRenderY();
                const mw = menu.getWidth();
                const mh = menu.getHeight();

                const pos = {
                    "x": mw * e.x,
                    "y": mh * e.y,
                    "w": mw * e.w,
                    "h": mh * e.h
                }
                if(!e.visible || (e.onclick == null && e.type != "slider")) return;
                if(Engine.rectanglesIntersect(mx-5, my-5, 10, 10, rx+pos.x,ry+pos.y, pos.w, pos.h)) {
                    if(e.type == "slider") {
                        e.dragging = true;
                        e.setSliderFromMouse(mx);
                    } else {
                        e.onclick();
                    }
                    
                }
            });
            menu.submenus.filter(m => m.visible).forEach(m => handleClick(m));
        };
        handleClick(this);
    }
};

export class MenuRegistry {
    constructor(renderer) {
        this.MENUS = {
            "escape_menu": new Menu(renderer),
            "settings_menu": new Menu(renderer),
            "combat_settings_menu": new Menu(renderer),
            "keybinds_menu": new Menu(renderer),
            "visual_settings_menu": new Menu(renderer),
            "main_menu": new Menu(renderer),
            "debug_settings_menu": new Menu(renderer)
        }
        this.setup();
    }

    setup() {
        this.clear();
        this._setup();
    }

    clear() {
        Object.values(this.MENUS).forEach(m => {
            m.UIElements = [];
            m.submenus = [];
        })
    }

    _setup() {
        const em = this.MENUS.escape_menu;
        const close_menu = () => {
            em.submenus.forEach(m => m.visible = false);
            em.submenus.forEach(m => m.submenus.forEach(e => e.visible = false))
            em.UIElements.filter(e => e.type == "textbutton").forEach(e => e.data.strokeColor = "black");
            em.submenus.forEach(m => m.UIElements.filter(e => e.type == "textbutton").forEach(e => e.data.strokeColor = "black"))
        }
        em.createUIElement(0.45, 0.01, 0.1, 0.1, "text", {"text":"menu","fontSize":"25"});
        let sb = em.createUIElement(0.05, 0.12, 0.9, 0.07, "textbutton", {"text":"settings"});
        sb.onclick = async () => {
            if(!sm.visible) {
                sm.visible = true;
                sb.data.strokeColor = "cyan";
            } else {
                close_menu()
            }
        }
        let eb = em.createUIElement(0.05, 0.7, 0.9, 0.07, "textbutton", {"text":"exit menu (esc)"})
        eb.onclick = () => {
            em.renderer.closeMenu();
            close_menu();
        }
        let btmb = em.createUIElement(0.05, 0.8, 0.9, 0.07, "textbutton", {"text":"back to main menu"})
        btmb.onclick = () => {
            em.renderer.closeMenu();
            close_menu();
            em.renderer.openMenu(this.MENUS.main_menu);
            document.title = "main menu"
        }
        let ehb = em.createUIElement(0.05, 0.9, 0.9, 0.07, "textbutton", {"text":"exit to homepage"})
        ehb.onclick = () => {
            if(confirm("are you sure")) window.location.href = "/";
        };
        let fb = em.createUIElement(0.05, 0.7, 0.9, 0.07, "textbutton", {"text":"forfeit","bg_color": "red"});
        fb.visible = false;
        fb.onclick = () => {
            if(!em.renderer.engine.combat.in_combat) return;
            em.renderer.engine.combat.onForfeit();
            em.renderer.closeMenu();
            close_menu();
        }

        const sm = this.MENUS.settings_menu;
        sm.settings = {
            "color": {
                "bg": "white",
                "border": "black",
                "border_weight": 2
            },
            "x": 0.32,
            "y": 0.025,
            "space": "screen",
            "width": 0.3,
            "height": 0.95,
            "hide_game": false,
            "rotation": 0 // degrees
        };
        sm.visible = false;
        em.submenus.push(sm);
        sm.createUIElement(0.45, 0.01, 0.1, 0.1, "text", {"text":"settings","fontSize":"25"});
        let kbb = sm.createUIElement(0.05, 0.12, 0.9, 0.07, "textbutton", {"text":"keybinds"});
        kbb.onclick = async () => {
            sm.submenus.filter(m => m != km).forEach(m => m.visible = false);
            sm.UIElements.filter(e => e.type == "textbutton").forEach(e => e.data.strokeColor = "black");
            if(!km.visible) {
                km.visible = true;
                kbb.data.strokeColor = "cyan";
            } else {
                km.visible = false;
                kbb.data.strokeColor = "black";
            }
        };
        let csb = sm.createUIElement(0.05, 0.22, 0.9, 0.07, "textbutton", {"text":"combat"});
        csb.onclick = async () => {
            sm.submenus.filter(m => m != csm).forEach(m => m.visible = false);
            sm.UIElements.filter(e => e.type == "textbutton").forEach(e => e.data.strokeColor = "black");
            if(!csm.visible) {
                csm.visible = true;
                csb.data.strokeColor = "cyan";
            } else {
                csm.visible = false;
                csb.data.strokeColor = "black";
            }
        };
        let vsb = sm.createUIElement(0.05, 0.32, 0.9, 0.07, "textbutton", {"text":"visual"});
        vsb.onclick = async () => {
            sm.submenus.filter(m => m != vsm).forEach(m => m.visible = false);
            sm.UIElements.filter(e => e.type == "textbutton").forEach(e => e.data.strokeColor = "black");
            if(!vsm.visible) {
                vsm.visible = true;
                vsb.data.strokeColor = "cyan";
            } else {
                vsm.visible = false;
                vsb.data.strokeColor = "black";
            }
        };
        let debugsb = sm.createUIElement(-1, 0.04, 0.2, 0.03, "textbutton", {"text":"debug"});
        debugsb.onclick = async () => {
            sm.submenus.filter(m => m != dsm).forEach(m => m.visible = false);
            sm.UIElements.filter(e => e.type == "textbutton").forEach(e => e.data.strokeColor = "black");
            if(!dsm.visible) {
                dsm.visible = true;
                debugsb.data.strokeColor = "cyan";
            } else {
                dsm.visible = false;
                debugsb.data.strokeColor = "black";
            }
        };
        let rpt = sm.createUIElement(0.05, 0.8, 0.9, 0.07, "textbutton", {"text":"redo performance test"});
        rpt.onclick = async () => {
            await em.renderer.engine.settings.swapSettingsWithBinds(await handlePerfTest());
            em.renderer.engine.resetControls();
            await em.renderer.engine.settings.modifySetting("fp", false);
            this.setup();
        }
        let rb = sm.createUIElement(0.05, 0.9, 0.9, 0.07, "textbutton", {"text":"reset", "bg_color": "red"});
        rb.onclick = async () => { if(confirm("are you sure? (will reload the page)")) await em.renderer.engine.settings._fullReset(); }

        const csm = this.MENUS.combat_settings_menu;
        csm.settings = {
            "color": {
                "bg": "white",
                "border": "black",
                "border_weight": 2
            },
            "x": 0.63,
            "y": 0.025,
            "space": "screen",
            "width": 0.3,
            "height": 0.95,
            "hide_game": false,
            "rotation": 0 // degrees
        };
        csm.visible = false;
        sm.submenus.push(csm);
        csm.createUIElement(0.45, 0.01, 0.1, 0.1, "text", {"text":"combat settings","fontSize":"25"});
        let btoic = csm.createUIElement(0.05, 0.12, 0.9, 0.07, "slider", {"min": 0.01, "max": 0.2, "step": 0.01, "title": "background text opacity (in combat)"});
        btoic.onchange = async () => { 
            if(em.renderer.engine.combat.in_combat) {
                if(em.renderer.engine.combat.turn == 1) em.renderer.engine.combat.combatVariables.bg_text_target_opacity = btoic.data.progress
            }
            await em.renderer.engine.settings.modifySetting("btoic", btoic.data.progress);
         }
        btoic.data.progress = em.renderer.engine.settings.settings.btoic || btoic.data.progress;
        let btooc = csm.createUIElement(0.05, 0.22, 0.9, 0.07, "slider", {"min": 0.01, "max": 0.2, "step": 0.01, "title": "background text opacity (out of combat)"});
        btooc.onchange = async () => { 
            if(em.renderer.engine.combat.in_combat) {
                if(em.renderer.engine.combat.turn == 0) {
                    em.renderer.engine.combat.combatVariables.bg_text_target_opacity = btooc.data.progress
                }
            }
            await em.renderer.engine.settings.modifySetting("btooc", btooc.data.progress); 
        }
        btooc.data.progress = em.renderer.engine.settings.settings.btooc || btooc.data.progress;
        let hs = csm.createUIElement(0.05, 0.32, 0.9, 0.07, "slider", {"min": 0.6, "max": 1.5, "step": 0.05, "title": "hand size"});
        hs.onchange = async () => { await em.renderer.engine.settings.modifySetting("hs", hs.data.progress); }
        hs.data.progress = em.renderer.engine.settings.settings.hs || hs.data.progress;
        let hyo = csm.createUIElement(0.05, 0.42, 0.9, 0.07, "slider", {"min": -180, "max": 60, "step": 1, "title": "hand vertical offset"});
        hyo.onchange = async () => { await em.renderer.engine.settings.modifySetting("hyo", hyo.data.progress); }
        hyo.data.progress = em.renderer.engine.settings.settings.hyo || hyo.data.progress;
        let dsb = csm.createUIElement(0.05, 0.52, 0.9, 0.07, "toggle", {"text":"combat drop shadows"});
        dsb.data.active = em.renderer.engine.settings.settings.ds || false
        dsb.onclick = () => { dsb.data.active = !em.renderer.engine.settings.settings.ds;
            em.renderer.engine.settings.modifySetting("ds", dsb.data.active); }
        let btb = csm.createUIElement(0.05, 0.62, 0.9, 0.07, "toggle", {"text":"combat background text"});
        btb.data.active = em.renderer.engine.settings.settings.bt || false
        btb.onclick = () => { btb.data.active = !em.renderer.engine.settings.settings.bt;
            em.renderer.engine.settings.modifySetting("bt", btb.data.active); }
        let misc_perf = csm.createUIElement(0.05, 0.72, 0.9, 0.07, "toggle", {"text":"misc performance improvements"});
        misc_perf.data.active = em.renderer.engine.settings.settings.mp || false
        misc_perf.onclick = () => { misc_perf.data.active = !em.renderer.engine.settings.settings.mp;
            em.renderer.engine.settings.modifySetting("mp", misc_perf.data.active); }
        let show_hb = csm.createUIElement(0.05, 0.82, 0.9, 0.07, "toggle", {"text":"show hitboxes"});
        show_hb.data.active = em.renderer.engine.settings.settings.shb || false
        show_hb.onclick = () => { show_hb.data.active = !em.renderer.engine.settings.settings.shb;
            em.renderer.engine.settings.modifySetting("shb", show_hb.data.active); }

        const km = this.MENUS.keybinds_menu;
        km.settings = {
            "color": {
                "bg": "white",
                "border": "black",
                "border_weight": 2
            },
            "x": 0.63,
            "y": 0.025,
            "space": "screen",
            "width": 0.3,
            "height": 0.95,
            "hide_game": false,
            "rotation": 0 // degrees
        };
        km.visible = false;
        sm.submenus.push(km);
        const banned_keybinds = ["Escape"]
        const refresh_keybinds = () => {
            km.UIElements.forEach(e => e.destroy());
            km.UIElements.filter(e => e.type == "text").forEach(e => e.destroy());
            km.UIElements.filter(e => e.type == "textbutton").forEach(e => e.destroy());
            km.createUIElement(0.45, 0.01, 0.1, 0.1, "text", {"text":"keybinds","fontSize":"25"});
            km.renderer.engine.settings.binds.binds.forEach((b, index) => {
                km.createUIElement(0.25, 0.11+(.0805*index), 0.1, 0.1, "text", {"text":b.name,"fontSize":"13"});
                let button = km.createUIElement(0.6, 0.13+(.08*index), 0.3, 0.06, "textbutton", {"text":`${b.bind.name}`});
                button.onclick = () => {
                    if(km.renderer.engine.keyboard.waiting) return;
                    button.data.strokeColor = "cyan"
                    button.data.text = `Click a key`
                    const handle = () => {
                        km.renderer.engine.keyboard.waitForKeyPress().then(async k => {
                            if(banned_keybinds.includes(k.code)) {
                                handle();
                                return;
                            }
                            km.renderer.engine.keyboard.setFunctionOnKeyPress(b.bind.code, () => {})
                            await km.renderer.engine.settings.binds.updateBind(b.id, k.key == " " ? "Space" : k.key, k.code);
                            km.renderer.engine.resetControls();
                            refresh_keybinds();
                        })
                    }
                    handle();
                    
                }
            })
        };
        refresh_keybinds();

        const vsm = this.MENUS.visual_settings_menu;
        vsm.settings = {
            "color": {
                "bg": "white",
                "border": "black",
                "border_weight": 2
            },
            "x": 0.63,
            "y": 0.025,
            "space": "screen",
            "width": 0.3,
            "height": 0.95,
            "hide_game": false,
            "rotation": 0 // degrees
        };
        vsm.visible = false;
        sm.submenus.push(vsm);
        vsm.createUIElement(0.45, 0.01, 0.1, 0.1, "text", {"text":"visual settings","fontSize":"25"});
        let fss = vsm.createUIElement(0.05, 0.12, 0.9, 0.07, "slider", {"min": -3, "max": 5, "step": 1, "title": "font size"});
        fss.onchange = async () => { await em.renderer.engine.settings.modifySetting("fss", fss.data.progress); }
        fss.data.progress = em.renderer.engine.settings.settings.fss ?? fss.data.progress;
        let ceb = vsm.createUIElement(0.05, 0.22, 0.9, 0.07, "toggle", {"text":"cursor effects (pointer, etc)"});
        ceb.data.active = em.renderer.engine.settings.settings.ce ?? false
        ceb.onclick = () => { ceb.data.active = !em.renderer.engine.settings.settings.ce;
            em.renderer.engine.settings.modifySetting("ce", ceb.data.active); }
        let npcab = vsm.createUIElement(0.05, 0.32, 0.9, 0.07, "toggle", {"text":"npc animations"});
        npcab.data.active = em.renderer.engine.settings.settings.npca ?? false
        npcab.onclick = () => { npcab.data.active = !em.renderer.engine.settings.settings.npca;
            em.renderer.engine.settings.modifySetting("npca", npcab.data.active); }

        const dsm = this.MENUS.debug_settings_menu;
        dsm.settings = {
            "color": {
                "bg": "white",
                "border": "black",
                "border_weight": 2
            },
            "x": 0.63,
            "y": 0.025,
            "space": "screen",
            "width": 0.3,
            "height": 0.95,
            "hide_game": false,
            "rotation": 0 // degrees
        };
        dsm.visible = false;
        sm.submenus.push(dsm);
        dsm.createUIElement(0.45, 0.01, 0.1, 0.1, "text", {"text":"debug settings","fontSize":"25"});
        let smmb = dsm.createUIElement(0.05, 0.12, 0.9, 0.07, "toggle", {"text":"skip main menu"});
        smmb.data.active = em.renderer.engine.settings.settings.smm ?? false
        smmb.onclick = () => { smmb.data.active = !em.renderer.engine.settings.settings.smm;
            em.renderer.engine.settings.modifySetting("smm", smmb.data.active); }
        let scnw = dsm.createUIElement(0.05, 0.22, 0.9, 0.07, "toggle", {"text":"supress console noob warning"});
        scnw.data.active = em.renderer.engine.settings.settings.scnw || false
        scnw.onclick = () => { scnw.data.active = !em.renderer.engine.settings.settings.scnw;
            em.renderer.engine.settings.modifySetting("scnw", scnw.data.active); }
        let test_scen = dsm.createUIElement(0.05, 0.32, 0.9, 0.07, "textbutton", {"text":"enter scenario"});
        test_scen.onclick = () => { const id = em.renderer.engine.data.scenarios.find(s => s.id == prompt("id")); if(!id) { alert("not real") } else { close_menu(); em.renderer.closeMenu(); em.renderer.engine.combat.enterCombat(id); } }
        let dd = dsm.createUIElement(0.05, 0.42, 0.9, 0.07, "textbutton", {"text":"log engine object to console"});
        dd.onclick = () => { console.log(em.renderer.engine) };
        
        const mm = this.MENUS.main_menu;
        mm.settings = {
            "color": {
                "bg": "rgba(200, 200, 200, 1)",
                "border": "black",
                "border_weight": 2
            },
            "x": 0,
            "y": 0,
            "space": "screen",
            "width": 1,
            "height": 1,
            "hide_game": true,
            "rotation": 0, // degrees
            "block_esc": true
        };
        mm.visible = false;
        mm.createUIElement(0.45, 0.05, 0.1, 0.1, "text", {"text":"game name","fontSize":"80"});
        let spb = mm.createUIElement(0.225, 0.3, 0.25, 0.1, "textbutton", {"text":"singleplayer","bg_color": "rgba(0, 255, 0, 1)","fontSize":"20"})
        const handlePerfTest = async () => {
            let settings = EngineSettings.defaultSettings.high
            em.renderer.ctx.canvas.style.display = "none";
            document.getElementById("perf_test").style.display = "block";
            const nextFrame = () => new Promise(requestAnimationFrame);
            for(let x = 0; x < 10; x++) { await nextFrame(); }
            const performance_test = async (iter) => {
                let p = new Promise((resolve, reject) => {
                    const engine = em.renderer.engine;
                    const start_time = Date.now();
                    engine.combat._enterCombat(engine.data.scenarios.find(s => s.id == "test"));
                    engine.combat.combatSettings.performance = true;
                    for(let x = 0; x < iter; x++) {
                        engine.combat.onClick();
                        engine.combat.combatUpdate(0.06);
                        engine.combat.render();
                    }
                    engine.combat.combatSettings.performance = false;
                    engine.combat._exitCombat();
                    const end_time = Date.now();
                    resolve(end_time-start_time)
                })
                return await p;
            };
            const ms = await performance_test(1000)
            let cs = null;
            if(ms > 5500) {
                cs = 0
            } else {
                cs = 1;
            }
            alert(`your computer is probably only good enough for ${cs == 0 ? "LOW" : "HIGH"} settings, but you can always change them if you want to`);
            settings = cs == 0 ? EngineSettings.defaultSettings.low : EngineSettings.defaultSettings.high
            if(!confirm("do you consent to collecting data on your computer to refine the performance test (very uninvasive)")) {
                alert("too bad i'm doing it anyways")
            }
            em.renderer.ctx.canvas.style.display = "block";
            document.getElementById("perf_test").style.display = "none";
            for(let x = 0; x < 10; x++) { await nextFrame(); }
            const user = JSON.parse(window.localStorage.getItem("user"));
            await fetch(getApiLink("/game/analytics/perfTest"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "data": {
                "computer": {
                    logicalCores: navigator.hardwareConcurrency || "Unknown", // CPU threads
                    estimatedRAM: navigator.deviceMemory || "Unknown",        // RAM in GB (approximate)
                    operatingSystem: navigator.userAgentData?.platform || navigator.platform,
                    screenResolution: `${screen.width}x${screen.height}`,
                    browserLanguage: navigator.language,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                  },
                  "user": user,
                  "ms": ms
            }})});
            return settings;
        }
        spb.onclick = async () => {
            if(em.renderer.engine.settings.settings.fp) {
                let settings = EngineSettings.defaultSettings.high
                const nextFrame = () => new Promise(requestAnimationFrame);
                if(!confirm("going to do a performance check to see what settings to give you (first time only)")) {
                    alert("ig bro, im gonna give you the good settings lets hope your computer doesn't explode");
                } else {
                    settings = await handlePerfTest();
                };
                await em.renderer.engine.settings.swapSettingsWithBinds(settings);
                em.renderer.engine.resetControls();
                await em.renderer.engine.settings.modifySetting("fp", false);
                this.setup();
            }
            console.log(em.renderer.engine.settings.isRecent())
            document.title = "game name"
            em.renderer.closeMenu();
        }
        let mpb = mm.createUIElement(0.525, 0.3, 0.25, 0.1, "textbutton", {"text":"multiplayer (wip)","fg_color":"rgba(128, 128, 128, 0.8)","fontSize":"20"})
        let bb = mm.createUIElement(0.375, 0.45, 0.25, 0.1, "textbutton", {"text":"exit","bg_color": "rgba(180, 0, 0, 0.65)","fontSize":"20"})
        bb.onclick = async () => {
            window.location.href = "/"
        }
        const v = Engine.getVersion();
        mm.createUIElement(0, 0.92, 0.08, 0.1, "text", {"text":`v${v[0]}.${v[1]}.${v[2]}`,"fontSize":"25"});
    };
};