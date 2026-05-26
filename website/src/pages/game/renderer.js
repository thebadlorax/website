/**
 * author thebadlorax
 * created on 06-05-2026-10h-35m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Engine } from "./engine.js";

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
            if(Engine.rectanglesIntersect(mx, my, 10, 10, rx+e.x,ry+e.y, e.w, e.h)) {
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

                this.effects.push({
                    "type": type,
                    "startTime": Date.now(),
                    "ms": data.ms,
                    "blackTime": data.blackTime,
                    "fadeInTime": fadeInTime,
                    "fadeOutTime": fadeOutTime
                });
            }
        }
    }

    openMenu(menu) {
        this.engine.state = "menu";
        this.active_menu = menu;
    }

    closeMenu() {
        this.engine.state = "main";
        this.active_menu = null;
    }

    render() { 
        const map = this.engine.hero.map;
        const layers = Object.values(map.data.layers);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height); 

        if(this.engine.state == 'main' || this.engine.state == 'menu') {
            if(this.engine.state == "menu") {
                if(this.active_menu.settings.hide_game) {
                    this.active_menu.render();
                    return;
                }
            }
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

            if(this.engine.state == "menu") {
                this.active_menu.render();
            }
        } else if(this.engine.state == "combat") {
            this.engine.combat.render();
        } else if(this.engine.state == "cutscene") {
            if(this.active_cutscene != null) {
                this.ctx.drawImage(this.active_cutscene, 0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
                if(this.active_cutscene.ended) {
                    this.active_cutscene = null;
                    this.applyEffect("fadeOutIn", {"ms": 300, "blackTime": 100});
                    setTimeout(() => {
                        this.engine.state = "main";
                    }, 150);
                }
            }
        }; 

        this.effects.forEach((e, index) => {
            switch(e.type) {
                case "fadeOutIn": {
                    const elapsed = Date.now() - e.startTime;
        
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

                    if (elapsed >= e.ms+200) {
                        this.effects.splice(index, 1);
                        return; 
                    }
                    break;
                }
            }
        });
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
        this.engine.renderer.applyEffect("fadeOutIn", {"ms": 600, "blackTime": 100});
        setTimeout(() => {
            this.engine.state = "cutscene";
            this.engine.renderer.active_cutscene = this.video;
            this.video.play();
        }, 350)
        
    }
}

export class MenuUIElement {
    constructor(ctx, x, y, w, h, type, data, menu) {
        this.x = x; this.y = y; this.w = w; this.h = h; this.type = type;
        this.onclick = null; this.visible = true; this.ctx = ctx; this.data = data;
        this.menu = menu;
    }

    destroy() {
        this.window.UIElements.splice(this.window.UIElements.indexOf(this), 1);
    }

    render() {
        const rx = this.menu.getRenderX();
        const ry = this.menu.getRenderY();
        switch(this.type) {
            case "button": {
                this.ctx.fillStyle = "gray";
                this.ctx.fillRect(rx + this.x, ry + this.y, this.w, this.h);
                this.ctx.strokeStyle = "black";
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(rx + this.x, ry + this.y, this.w, this.h);
                break;
            }
            case "textbutton": {
                if(this.data.bg_color != null) {
                    this.ctx.fillStyle = this.data.bg_color;
                    this.ctx.fillRect(rx + this.x, ry + this.y, this.w, this.h);
                }
                this.ctx.fillStyle = "black";
                this.ctx.strokeStyle = this.data.strokeColor || "black";
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(rx + this.x, ry + this.y, this.w, this.h);
                this.ctx.font = "13px monospace";

                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(
                    this.data.text,
                    rx + this.x + (this.w / 2),
                    ry + this.y + (this.h / 2)
                );
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
                        (rx + this.x)+1,
                        (ry + this.y)+1,
                        this.w-2, // target width
                        this.h-2 // target height
                    );
                } else {
                    this.ctx.drawImage(this.data.image, (rx+this.x)+1, (ry+this.y)+1, this.w-2, this.h-2)
                }

                if(this.data.overlayColor != null) {
                    this.ctx.fillStyle = this.data.overlayColor;
                    this.ctx.fillRect((rx + this.x), (ry + this.y), this.w, this.h);
                }
                
                this.ctx.strokeStyle = this.data.strokeColor || "black";
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(rx + this.x, ry + this.y, this.w, this.h);
                break;
            }
            case "text": {
                this.ctx.font = "13px monospace";
                this.ctx.fillStyle = "black";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(
                    this.data.text,
                    rx + this.x + (this.w / 2),
                    ry + this.y + (this.h / 2)
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

        this.settings = {
            "color": {
                "bg": "white",
                "border": "black",
                "border_weight": 2,
                "game": "rgba(0, 0, 0, 0.6)"
            },
            "x": 10,
            "y": this.renderer.camera.height*0.025,
            "space": "screen",
            "width": 400,
            "height": this.renderer.camera.height*0.95,
            "hide_game": false,
            "rotation": 0 // degrees
        }
    }

    getRenderX() {
        if(this.settings.space === "world") {
            return this.settings.x - this.renderer.camera.x;
        }
        return this.settings.x;
    }
    getRenderY() {
        if(this.settings.space === "world") {
            return this.settings.y - this.renderer.camera.y;
        }
        return this.settings.y;
    }

    createUIElement(x, y, w, h, type, data=null) {
        let e = new MenuUIElement(this.renderer.ctx, x, y, w, h, type, data, this);
        this.UIElements.push(e);
        return e;
    }

    render() {
        const ctx = this.renderer.ctx;
        const rx = this.getRenderX();
        const ry = this.getRenderY();

        ctx.fillStyle = this.settings.color.game;
        ctx.fillRect(0, 0, this.renderer.camera.width, this.renderer.camera.height);

        ctx.save();

        ctx.rotate(this.settings.rotation * Math.PI / 180);
        ctx.fillStyle = this.settings.color.bg;
        ctx.fillRect(rx, ry, this.settings.width, this.settings.height);
        ctx.strokeStyle = this.settings.color.border;
        ctx.lineWidth = this.settings.color.border_weight;
        ctx.strokeRect(rx, ry, this.settings.width, this.settings.height);

        this.submenus.forEach(m => {
            m.render();
        })

        this.UIElements.forEach(e => {
            e.render();
        });

        ctx.restore();
    }

    onclick() {
        const rx = this.getRenderX();
        const ry = this.getRenderY();
        const mx = this.renderer.engine.keyboard.mouseX;
        const my = this.renderer.engine.keyboard.mouseY;
        this.UIElements.forEach(e => {
            if(!e.visible || e.onclick == null) return;
            if(Engine.rectanglesIntersect(mx, my, 10, 10, rx+e.x,ry+e.y, e.w, e.h)) {
                e.onclick();
            }
        })
    }
}

export class MenuRegistry {
    constructor(renderer) {
        this.MENUS = {
            "escape_menu": new Menu(renderer)
        }
        this.setup();
    }

    setup() {
        const em = this.MENUS.escape_menu;
        em.createUIElement((em.settings.width/2)-50, 0, 100, 100, "text", {"text":"menu"});
        let pmb = em.createUIElement(25, 100, em.settings.width-50, 50, "textbutton", {"text":"performance mode"})
        pmb.data.bg_color = "red"
        pmb.onclick = () => {
            em.renderer.engine.settings.performance_mode = !em.renderer.engine.settings.performance_mode;
            pmb.data.bg_color = em.renderer.engine.settings.performance_mode ? "green" : "red"
            if(em.renderer.engine.settings.performance_mode) {
                alert("this turns off laggy effects like the background text in combat or cursor effects")
            }
        }
        let eb = em.createUIElement(25, 175, em.settings.width-50, 50, "textbutton", {"text":"exit"})
        eb.onclick = () => {
            alert("no main menu yet bruh")
        }
    }
}