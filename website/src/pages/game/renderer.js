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
    constructor(ctx, x, y, w, h) {
        this.x = x; this.y = y; this.width = w; this.height = h;
        this.z = 0; this.ctx = ctx; this.visible = false; this.UIElements = [];
    };

    createUIElement(x, y, w, h, type, data=null) {
        let e = new WindowUIElement(this.ctx, x, y, w, h, type, data);
        this.UIElements.push(e);
        return e;
    }

    handleClick(mx, my) {
        this.UIElements.forEach(e => {
            if(Engine.rectanglesIntersect(mx, my, 10, 10, this.x+e.x,this.y+e.y, e.w, e.h)) {
                e.onclick();
            }
        })
    }

    draw() {
        if(!this.visible) return;
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(this.x, this.y, this.width, this.height);
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.x, this.y, this.width, this.height);

        this.UIElements.forEach(e => {
            if(!e.visible) return;
            switch(e.type) {
                case "button": {
                    this.ctx.fillStyle = "gray";
                    this.ctx.fillRect(this.x + e.x, this.y + e.x, e.w, e.h);
                    this.ctx.strokeStyle = "black";
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(this.x + e.x, this.y + e.y, e.w, e.h);
                    break;
                }
                case "textbutton": {
                    this.ctx.fillStyle = "black";
                    //this.ctx.fillRect(this.x + e.x, this.y + e.x, e.w, e.h);
                    this.ctx.strokeStyle = e.data.strokeColor || "black";
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(this.x + e.x, this.y + e.y, e.w, e.h);
                    this.ctx.font = `${e.data.fontSize}px`; 
                    this.ctx.fillText(e.data.text, (this.x+e.x)+(Math.floor(e.w/4)), (this.y+e.y)+(Math.floor(e.h/2)), e.w)
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
                            (this.x + e.x)+5,
                            (this.y + e.y)+5,
                            e.w-10, // target width
                            e.h-10 // target height
                        );
                    } else {
                        this.ctx.drawImage(e.data.image, (this.x+e.x)+5, (this.y+e.y)+5, e.w-10, e.h-10)
                    }
                    
                    this.ctx.strokeStyle = e.data.strokeColor || "black";
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(this.x + e.x, this.y + e.y, e.w, e.h);
                    break;
                }
            }
        })
    };
}