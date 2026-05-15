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
}

export class Window {
    constructor(ctx, x, y, w, h, space="screen") {
        this.x = x; this.y = y; this.width = w; this.height = h;
        this.z = 0; this.ctx = ctx; this.visible = false; this.UIElements = [];
        this.space = space; this.onrender = () => {}; this.zindex = 1;
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
        })
    };
}

export class Renderer {
    constructor(ctx, camera, engine) {
        this.ctx = ctx;
        this.engine = engine;
        this.camera = camera;
        this.tileAtlas = this.engine.loader.getImage('tiles');

        this.windows = [];
        this.sprites = [];

        this.effects = [];
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
                    let st = this.engine.debug.level_editor.selected_tile;
                    if(st != null) {
                        if(st[0] == c && st[1] == r) {
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

    render() { 
        const map = this.engine.hero.map;
        const layers = Object.values(map.data.layers);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height); 

        if(this.engine.state == 'main') {
            for(let x = 0; x < layers.length; x++) {
                this._drawLayer(x);
                this.sprites.filter(s => s.zindex == x && s.mapid == this.engine.hero.mapid).forEach(s => {
                    s.onrender();
                    this.ctx.drawImage(
                        s.image,
                        Math.round(s.screenX - s.width / 2),
                        Math.round(s.screenY - s.height / 2)
                    );
                })
            }
    
            if(this.engine.debug.show_grid || this.engine.debug.level_editor.active) {
                this._drawTriggers();
                this._drawGrid(); 
            }
    
            this.windows.filter(w => w.visible).forEach(w => { w.onrender(); w.draw(this.camera); });
    
            
    
            if(this.engine.debug.show_grid || this.engine.debug.level_editor.active) {
                this.engine.hero.drawHitbox(this.ctx);
            }
        } else if(this.engine.state == "combat") {
            this.engine.combat.render();
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

                    if (elapsed >= e.ms) {
                        this.effects.splice(index, 1);
                        return; 
                    }
                    break;
                }
            }
        });
    };
}