/**
 * author thebadlorax
 * created on 06-05-2026-10h-35m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

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
}

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
}