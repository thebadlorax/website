/**
 * author thebadlorax
 * created on 06-05-2026-10h-55m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Keyboard } from "./controller.js";
import { Loader, Camera } from "./renderer.js";
import { Map } from "./map.js";
import { test_data_request } from "./data.js";

export class Engine {
    debug = {
        "show_grid": false
    };
    constructor() {
        this.tick = this.tick.bind(this);
        this.loader = new Loader();
        this.keyboard = new Keyboard();
        this.map = new Map();
        this.map.importMapData(test_data_request.map);
    }

    load() { return test_data_request.assets.map(b => this.loader.loadImage(b[0], b[1])) };

    run(context) {
        this.ctx = context;
        this._previousElapsed = 0;
    
        var p = this.load();
        Promise.all(p).then(() => {
            this.init();
            window.requestAnimationFrame(this.tick);
        });
    }

    tick(elapsed) {
        window.requestAnimationFrame(this.tick);

        this.ctx.clearRect(0, 0, 512, 512);

        var delta = (elapsed - this._previousElapsed) / 1000.0;
        delta = Math.min(delta, 0.25);
        this._previousElapsed = elapsed;

        this.update(delta);
        this.render();
    }

    init() {
        this.keyboard.listenForEvents(
            Object.values(this.keyboard.KEYCODES));
        this.tileAtlas = this.loader.getImage('tiles');
    
        let wwidth = window.innerWidth; let wheight = window.innerHeight;
    
        let mapdata = this.map.getMapData(0, 0);
    
        let worldWidth  = mapdata.data.cols * mapdata.data.tsize;
        let worldHeight = mapdata.data.rows * mapdata.data.tsize;
    
        this.hero = new Sprite(
            this.map,
            0,
            0,
            worldWidth / 2,
            worldHeight / 2,
            this.loader.getImage("player")
        );
    
        this.hero.x = Math.min(worldWidth, Math.max(0, this.hero.x));
        this.hero.y = Math.min(worldHeight, Math.max(0, this.hero.y));
    
        const canvas = this.ctx.canvas;
        canvas.width = wwidth;
        canvas.height = wheight;
        this.camera = new Camera(mapdata, canvas.width, canvas.height);
        this._resize();
    
        this.camera.follow(this.hero);
    
        window.addEventListener("resize", () => {
            this._resize();
        });
    };

    _resize() {
        const canvas = this.ctx.canvas;
    
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    
        this.camera.width = canvas.width;
        this.camera.height = canvas.height;
    
        this.camera.worldWidth  = this.camera.map.data.cols * this.camera.map.data.tsize;
        this.camera.worldHeight = this.camera.map.data.rows * this.camera.map.data.tsize;
    };

    update(delta) {
        var dirx = 0;
        var diry = 0;
        if (this.keyboard.isDown(this.keyboard.KEYCODES.LEFT_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.A_KEY)) { dirx += -1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.RIGHT_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.D_KEY)) { dirx += 1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.UP_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.W_KEY)) { diry += -1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.DOWN_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.S_KEY)) { diry += 1; }

        this.debug.show_grid = this.keyboard.isDown(this.keyboard.KEYCODES.ESCAPE);
    
        this.hero.move(delta, dirx, diry);
        this.camera.update();
    };

    _drawLayer(layer) {
        let mapdata = this.map.getMapData(0, 0);
        var startCol = Math.floor(this.camera.x / mapdata.data.tsize);
        var endCol = Math.min(
            mapdata.data.cols,
            startCol + Math.ceil(this.camera.width / mapdata.data.tsize)
        );
        var startRow = Math.floor(this.camera.y / mapdata.data.tsize);
        var endRow = Math.min(
            mapdata.data.rows,
            startRow + Math.ceil(this.camera.height / mapdata.data.tsize)
        );
    
        for (var c = startCol; c < endCol; c++) {
            for (var r = startRow; r < endRow; r++) {
                var tile = mapdata.getTile(layer, c, r);
                var x = Math.round(c * mapdata.data.tsize - this.camera.x);
                var y = Math.round(r * mapdata.data.tsize - this.camera.y);
                
                if (tile !== 0) { // 0 => empty tile
                    this.ctx.drawImage(
                        this.tileAtlas, // image
                        (tile - 1) * mapdata.data.tsize, // source x
                        0, // source y
                        mapdata.data.tsize, // source width
                        mapdata.data.tsize, // source height
                        Math.round(x),
                        Math.round(y),
                        mapdata.data.tsize, // target width
                        mapdata.data.tsize // target height
                    );
                }
            }
        }
    };

    _drawGrid() {
        let mapdata = this.map.getMapData(0, 0);
        const tsize = mapdata.data.tsize;
    
        for (let r = 0; r < mapdata.data.rows; r++) {
            for (let c = 0; c < mapdata.data.cols; c++) {
    
                // world position of tile
                let worldX = c * tsize;
                let worldY = r * tsize;
    
                // convert to screen space
                let x = Math.round(worldX - this.camera.x);
                let y = Math.round(worldY - this.camera.y);
    
                // check if tile is solid (any layer)
                let isSolid = mapdata.isSolidTileAtXY(
                    worldX + tsize / 2,
                    worldY + tsize / 2
                );
    
                // draw fill
                if (isSolid) {
                    this.ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
                    this.ctx.fillRect(x, y, tsize, tsize);
                }
    
                // draw grid border
                this.ctx.strokeStyle = "rgba(255,255,255,0.2)";
                this.ctx.strokeRect(x, y, tsize, tsize);
            }
        }
    };

    render() { 
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height); 
        this._drawLayer(0); 
        this.ctx.drawImage(
            this.hero.image,
            Math.round(this.hero.screenX - this.hero.width / 2),
            Math.round(this.hero.screenY - this.hero.height / 2)
        );
        this._drawLayer(1); 
        if(this.debug.show_grid) this._drawGrid(); 
    };
}

export class Sprite {
    constructor(map, mapx, mapy, x, y, img) {
        this.mapObj = map;
        this.worldMove(mapx, mapy);
        this.x = x;
        this.y = y;
        this.width = this.map.data.tsize;
        this.height = this.map.data.tsize;

        this.image = img;
    };

    worldMove(mapx, mapy) {
        this.mapx = mapx;
        this.mapy = mapy;
        this.map = this.mapObj.getMapData(this.mapx, this.mapy)
    };

    move(delta, dirx, diry, speed=250) {
        if (dirx !== 0 && diry !== 0) {
            const len = Math.sqrt(dirx * dirx + diry * diry);
            dirx /= len;
            diry /= len;
        }
        this.x += dirx * speed * delta;
        this._collide(dirx, 0);
        this.y += diry * speed * delta;
        this._collide(0, diry);
    
        var maxX = this.map.data.cols * this.map.data.tsize;
        var maxY = this.map.data.rows * this.map.data.tsize;
        this.x = Math.max(0, Math.min(this.x, maxX));
        this.y = Math.max(0, Math.min(this.y, maxY));
    };

    _collide(dirx, diry) {
        var row, col;
    
        var left = this.x - this.width / 2;
        var right = this.x + this.width / 2 - 1;
        var top = this.y - this.height / 2;
        var bottom = this.y + this.height / 2 - 1;
    
        if (dirx !== 0) {
            if (this.map.isSolidTileAtXY(left, top) ||
                this.map.isSolidTileAtXY(left, bottom) ||
                this.map.isSolidTileAtXY(right, top) ||
                this.map.isSolidTileAtXY(right, bottom)) {
    
                if (dirx > 0) {
                    col = this.map.getCol(right);
                    this.x = this.map.getX(col) - this.width / 2;
                } else {
                    col = this.map.getCol(left);
                    this.x = this.map.getX(col + 1) + this.width / 2;
                }
            }
        }
    
        if (diry !== 0) {
            if (this.map.isSolidTileAtXY(left, top) ||
                this.map.isSolidTileAtXY(right, top) ||
                this.map.isSolidTileAtXY(left, bottom) ||
                this.map.isSolidTileAtXY(right, bottom)) {
    
                if (diry > 0) {
                    row = this.map.getRow(bottom);
                    this.y = this.map.getY(row) - this.height / 2;
                } else {
                    row = this.map.getRow(top);
                    this.y = this.map.getY(row + 1) + this.height / 2;
                }
            }
        }
    };
}