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
    constructor(ctx, x, y, w, h, type, data) {
        this.x = x; this.y = y; this.w = w; this.h = h; this.type = type;
        this.onclick = () => {}; this.visible = true; this.ctx = ctx; this.data = data;
    }
}

export class Window {
    constructor(ctx, x, y, w, h, space="screen") {
        this.x = x; this.y = y; this.width = w; this.height = h;
        this.z = 0; this.ctx = ctx; this.visible = false; this.UIElements = [];
        this.space = space;
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
        let e = new WindowUIElement(this.ctx, x, y, w, h, type, data);
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
        if(!this.visible) return;
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
            }
        })
    };
}