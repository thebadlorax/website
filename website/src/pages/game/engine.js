/**
 * author thebadlorax
 * created on 06-05-2026-10h-55m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Keyboard } from "./controller.js";
import { Loader, Camera, Window, WindowUIElement } from "./renderer.js";
import { Map } from "./map.js";
import { downloadBlob, pickFile } from "./browser.js";

export class Engine {
    static rectanglesIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
        if (x1 + w1 <= x2 || x2 + w2 <= x1) return false;
        if (y1 + h1 <= y2 || y2 + h2 <= y1) return false;
        return true;
    }

    static async gzipCompressString(str) {
        const input = new TextEncoder().encode(str);
    
        const stream = new Blob([input])
            .stream()
            .pipeThrough(new CompressionStream("gzip"));
    
        const compressedBuffer =
            await new Response(stream).arrayBuffer();
    
        const bytes = new Uint8Array(compressedBuffer);
    
        // base64 encode
        let binary = "";
        for (const b of bytes) {
            binary += String.fromCharCode(b);
        }
    
        return btoa(binary);
    }

    static async gzipDecompressString(base64) {
        const binary = atob(base64);
    
        const bytes = Uint8Array.from(
            binary,
            c => c.charCodeAt(0)
        );
    
        const stream = new Blob([bytes])
            .stream()
            .pipeThrough(new DecompressionStream("gzip"));
    
        return await new Response(stream).text();
    }

    debug = {
        "show_grid": false,
        "level_editor": {
            "active": false,
            "selected_tile": null,
            "selected_layer": 0
        }
    };
    constructor(data) {
        this.data = data;
        this.tick = this.tick.bind(this);
        this.loader = new Loader();
        this.keyboard = new Keyboard();
        this.map = new Map();
        this.map.importMapData(this.data.map);
    }

    load() { return this.data.assets.map(b => this.loader.loadImage(b[0], b[1])) };

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
    
        let worldWidth  = this.map.getMapData(0, 0).data.cols * this.map.getMapData(0, 0).data.tsize;
        let worldHeight = this.map.getMapData(0, 0).data.rows * this.map.getMapData(0, 0).data.tsize;
    
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

        this.debug.level_editor.selected_window = new Window(this.ctx, 250, 250, 250, 250);
        let tilemap = this.loader.getImage("tiles");
        let tileCount = Math.floor(tilemap.width/64);
        for(let x = 0; x <= tileCount; x++) {
            let y_off = Math.floor((x*60)/190)*60
            let ele = this.debug.level_editor.selected_window.createUIElement(
                10+((x*60)-y_off*4), 10+y_off, 50, 50, "image", {"atlas": true, "image": tilemap, "tileSize": 64, "atlasIndex": x}
            );
            ele.onclick = () => {
                let e = this.debug.level_editor.selected_tile;
                this.map.getMapData(0, 0).setTile(this.debug.level_editor.selected_layer, e[0], e[1], x)
            }
        }; let layer0_button = this.debug.level_editor.selected_window.createUIElement(
            10, 190, 50, 50, "textbutton", {"text": "bg", "fontSize": "40", "strokeColor": "cyan"}
        ); layer0_button.onclick = () => {
            this.debug.level_editor.selected_layer = 0;
            layer0_button.data.strokeColor = "cyan";
            layer1_button.data.strokeColor = "black";
        }; let layer1_button = this.debug.level_editor.selected_window.createUIElement(
            70, 190, 50, 50, "textbutton", {"text": "fg", "fontSize": "20"}
        ); layer1_button.onclick = () => {
            this.debug.level_editor.selected_layer = 1;
            layer0_button.data.strokeColor = "black";
            layer1_button.data.strokeColor = "cyan";
        }; let export_button = this.debug.level_editor.selected_window.createUIElement(
            190, 190, 50, 50, "textbutton", {"text": "export", "fontSize": "20"}
        ); export_button.onclick = async () => {
            let t = Engine.gzipCompressString(JSON.stringify(mapdata));
            downloadBlob(t, `${prompt("name your creation:") || "untitled"}.sav`, "text/plain");
        }; let import_button = this.debug.level_editor.selected_window.createUIElement(
            130, 190, 50, 50, "textbutton", {"text": "import", "fontSize": "20"}
        ); import_button.onclick = async () => {
            let f = await pickFile();
            let t = JSON.parse(await Engine.gzipDecompressString(await f.text()));
            console.log(t)
            this.map.importMapData(t);
            mapdata = this.map.getMapData(0, 0)
            alert("imported")
        }; 

        window.addEventListener("resize", () => {
            this._resize();
        });

        window.addEventListener("click", (e) => {
            if(!this.debug.level_editor.active) return;
            let mx = e.clientX; let my = e.clientY;
            let tsize = this.map.getMapData(0, 0).data.tsize;
            let tx = Math.floor((mx + this.camera.x) / tsize);
            let ty = Math.floor((my + this.camera.y) / tsize);
            let st = this.debug.level_editor.selected_tile;
            if(this.debug.level_editor.selected_window.visible) {
                let intersects = Engine.rectanglesIntersect(mx, my, 10, 10, this.debug.level_editor.selected_window.x, this.debug.level_editor.selected_window.y,
                    this.debug.level_editor.selected_window.width, this.debug.level_editor.selected_window.height
                )
                if(intersects) {
                    this.debug.level_editor.selected_window.handleClick(mx, my);
                    return;
                }
            }
            if(st != null) {
                if(st[0] == tx && st[1] == ty) {
                    this.debug.level_editor.selected_tile = null;
                    this.debug.level_editor.selected_window.visible = false;
                    return;
                }
            }
            this.debug.level_editor.selected_tile = [tx, ty];
            this.debug.level_editor.selected_window.visible = true;
            //this.debug.level_editor.selected_window.x = mx - Math.floor(this.debug.level_editor.selected_window.width*1.1);
            //this.debug.level_editor.selected_window.y = my - Math.floor(this.debug.level_editor.selected_window.height/2);
            this.debug.level_editor.selected_window.x = Math.min(this.debug.level_editor.selected_tile[0]*64, window.innerWidth-this.debug.level_editor.selected_window.width-20)
            this.debug.level_editor.selected_window.y = Math.min(this.debug.level_editor.selected_tile[1]*64, window.innerHeight-this.debug.level_editor.selected_window.height-20)
            
        })

        this.keyboard.setFunctionOnKeyPress(this.keyboard.KEYCODES.ESCAPE, () => {
            this.debug.level_editor.active = !this.debug.level_editor.active;
            this.debug.level_editor.selected_tile = null;
            this.debug.level_editor.selected_window.visible = false;
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

        this.debug.show_grid = this.keyboard.isDown(this.keyboard.KEYCODES.G_KEY);
    
        this.hero.move(delta, dirx, diry);
        this.camera.update();
    };

    _drawLayer(layer) {
        var startCol = Math.floor(this.camera.x / this.map.getMapData(0, 0).data.tsize);
        var endCol = Math.min(
            this.map.getMapData(0, 0).data.cols,
            startCol + Math.ceil(this.camera.width / this.map.getMapData(0, 0).data.tsize)
        );
        var startRow = Math.floor(this.camera.y / this.map.getMapData(0, 0).data.tsize);
        var endRow = Math.min(
            this.map.getMapData(0, 0).data.rows,
            startRow + Math.ceil(this.camera.height / this.map.getMapData(0, 0).data.tsize)
        );
    
        for (var c = startCol; c < endCol; c++) {
            for (var r = startRow; r < endRow; r++) {
                var tile = this.map.getMapData(0, 0).getTile(layer, c, r);
                var x = Math.floor(c * this.map.getMapData(0, 0).data.tsize - this.camera.x);
                var y = Math.floor(r * this.map.getMapData(0, 0).data.tsize - this.camera.y);
                
                if (tile !== 0) { // 0 => empty tile
                    this.ctx.drawImage(
                        this.tileAtlas, // image
                        (tile - 1) * this.map.getMapData(0, 0).data.tsize, // source x
                        0, // source y
                        this.map.getMapData(0, 0).data.tsize, // source width
                        this.map.getMapData(0, 0).data.tsize, // source height
                        Math.floor(x),
                        Math.floor(y),
                        this.map.getMapData(0, 0).data.tsize, // target width
                        this.map.getMapData(0, 0).data.tsize // target height
                    );
                }
            }
        }
    };

    _drawGrid() {
        let mapdata = this.map.getMapData(0, 0);
        const tsize = this.map.getMapData(0, 0).data.tsize;
    
        for (let r = 0; r < this.map.getMapData(0, 0).data.rows; r++) {
            for (let c = 0; c < this.map.getMapData(0, 0).data.cols; c++) {
    
                // world position of tile
                let worldX = c * tsize;
                let worldY = r * tsize;
    
                // convert to screen space
                let x = Math.round(worldX - this.camera.x);
                let y = Math.round(worldY - this.camera.y);
    
                // check if tile is solid (any layer)
                let isSolid = this.map.getMapData(0, 0).isSolidTileAtXY(
                    worldX + tsize / 2,
                    worldY + tsize / 2
                );
    
                // draw fill
                if (isSolid) {
                    this.ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
                    this.ctx.fillRect(x, y, tsize, tsize);
                }

                if(this.debug.level_editor.active) {
                    let st = this.debug.level_editor.selected_tile;
                    if(st != null) {
                        if(st[0] == c && st[1] == r) {
                            this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                            this.ctx.fillRect(x, y, tsize, tsize);
                        }
                    }
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
        if(this.debug.show_grid || this.debug.level_editor.active) this._drawGrid(); 

        this.debug.level_editor.selected_window.draw();
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