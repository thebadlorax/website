/**
 * author thebadlorax
 * created on 06-05-2026-10h-55m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Keyboard } from "./controller.js";
import { Loader, Camera, Window } from "./renderer.js";
import { Map } from "./map.js";
import { downloadBlob, pickFile } from "./browser.js";

import { clamp } from "../common.js";

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
    }; static async gzipDecompressString(base64) {
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
            "selected_layer": 1
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
    
        let worldWidth  = this.map.getMapData(0, 0).data.cols * this.map.getMapData(0, 0).data.tsize;
        let worldHeight = this.map.getMapData(0, 0).data.rows * this.map.getMapData(0, 0).data.tsize;
    
        this.hero = new Sprite(
            this.map,
            0,
            0,
            Math.floor(worldWidth / 2),
            Math.floor(worldHeight / 2),
            this.loader.getImage("player")
        );
    
        this.hero.x = Math.min(worldWidth, Math.max(0, this.hero.x));
        this.hero.y = Math.min(worldHeight, Math.max(0, this.hero.y));
    
        const canvas = this.ctx.canvas;
        canvas.width = wwidth;
        canvas.height = wheight;
        this.camera = new Camera(this.map.getMapData(this.hero.mapx, this.hero.mapy), canvas.width, canvas.height);
        this._resize();
    
        this.camera.follow(this.hero);

        this.debug.level_editor.selected_window = new Window(this.ctx, 250, 250, 370, 370, "world");
        this.debug.level_editor.layer_subwindow = new Window(this.ctx, 250, 250, 200, 370, "world");
        let tilemap = this.loader.getImage("tiles");
        let tileCount = Math.floor(tilemap.width/64);
        let a = 0; let y_off = 10;
        let tile_buttons = []; let other_buttons = [];
        for(let x = 0; x <= tileCount; x++) {
            if(a >= 6) { a = 0; y_off += 60; }
            let ele = this.debug.level_editor.selected_window.createUIElement(
                10+(a*60), y_off, 50, 50, "image", {"atlas": true, "image": tilemap, "tileSize": 64, "atlasIndex": x}
            );
            ele.onclick = () => {
                let e = this.debug.level_editor.selected_tile;
                this.map.getMapData(this.hero.mapx, this.hero.mapy).setTile(this.debug.level_editor.selected_layer, e[0], e[1], x)
            };

            tile_buttons.push(ele);
            
            a+= 1;
        }; let layer_button = this.debug.level_editor.selected_window.createUIElement(
            10, 310, 50, 50, "textbutton", {"text": "layers", "fontSize": "40"}
        );
        
        let blocked_tiles_button = this.debug.level_editor.selected_window.createUIElement(
            130, 310, 50, 50, "textbutton", {"text": "objects", "fontSize": "20"}
        ); let wall_tile_button = this.debug.level_editor.selected_window.createUIElement(
            10, 10, 50, 50, "textbutton", {"text": "wall", "fontSize": "20"}
        ); wall_tile_button.visible = false; wall_tile_button.onclick = () => {
            let e = this.debug.level_editor.selected_tile;
            this.map.getMapData(this.hero.mapx, this.hero.mapy).setTile(0, e[0], e[1], 1)
        }; let clear_wall_tile_button = this.debug.level_editor.selected_window.createUIElement(
            70, 10, 50, 50, "textbutton", {"text": "nowall", "fontSize": "20"}
        ); clear_wall_tile_button.visible = false; clear_wall_tile_button.onclick = () => {
            let e = this.debug.level_editor.selected_tile;
            this.map.getMapData(this.hero.mapx, this.hero.mapy).setTile(0, e[0], e[1], 0)
        }; let portal_button = this.debug.level_editor.selected_window.createUIElement(
            130, 10, 50, 50, "textbutton", {"text": "portal", "fontSize": "20"}
        ); portal_button.visible = false; portal_button.onclick = () => {
            let e = this.debug.level_editor.selected_tile;
            let m = this.map.getMapData(this.hero.mapx, this.hero.mapy);
            m.createTrigger(e[0], e[1], parseInt(prompt("width")), parseInt(prompt("height")), "portal", {
                "mapx": parseInt(prompt("mapx")),
                "mapy": parseInt(prompt("mapy")),
                "outx": parseInt(prompt("outx")),
                "outy": parseInt(prompt("outy"))
            })
        };

        other_buttons.push(clear_wall_tile_button, wall_tile_button, portal_button)

        const createLayerButtons = () => {
            const layer_win = this.debug.level_editor.layer_subwindow;
            layer_win.UIElements = [];

            const layers = Object.values(this.map.getMapData(this.hero.mapx, this.hero.mapy).data.layers);

            let skipped = 0;

            for(let x = 0; x < layers.length; x++) {
                let layer = layers[x];
                if(!layer.visible) {
                    skipped += 1;
                    continue;
                }
                const ele = layer_win.createUIElement(
                    10, 10+((x-skipped)*60),
                    180, 50, "textbutton",
                    {
                        "text": layer.name,
                        "fontSize": "20",
                        "strokeColor": `${this.debug.level_editor.selected_layer == layer.id ? "cyan" : "black"}`
                    }
                );
                ele.onclick = () => {
                    this.debug.level_editor.selected_layer = layer.id;
                    createLayerButtons();
                }
            };

            if(layers.length <= 6) {
                let new_button = layer_win.createUIElement(
                    10, 10+((layers.length-skipped)*60),
                    180, 50, "textbutton",
                    {
                        "text": "+",
                        "fontSize": "20"
                    }
                );
                
                new_button.onclick = () => {
                    this.map.getMapData(this.hero.mapx, this.hero.mapy).createLayer(prompt("name"));
                    createLayerButtons();
                }
            }
        }
        
        layer_button.onclick = () => {
            this.debug.level_editor.layer_subwindow.visible = !this.debug.level_editor.layer_subwindow.visible;
            createLayerButtons();

            blocked_tiles_button.data.strokeColor = "black";
            tile_buttons.forEach(t => t.visible = true)
            other_buttons.forEach(t => t.visible = false)
        }; blocked_tiles_button.onclick = () => {
            if(layer_button.visible) {
                layer_button.visible = false;
                blocked_tiles_button.data.strokeColor = "cyan";
                this.debug.level_editor.layer_subwindow.visible = false;
                tile_buttons.forEach(t => t.visible = false)
                other_buttons.forEach(t => t.visible = true)
            } else {
                layer_button.visible = true;
                blocked_tiles_button.data.strokeColor = "black";
                tile_buttons.forEach(t => t.visible = true)
                other_buttons.forEach(t => t.visible = false)
            }

            
        }; 
        
        let export_button = this.debug.level_editor.selected_window.createUIElement(
            310, 310, 50, 50, "textbutton", {"text": "export", "fontSize": "20"}
        ); export_button.onclick = async () => {
            let t = await Engine.gzipCompressString(JSON.stringify(this.map.constructMapData()));
            downloadBlob(t, `${prompt("name your creation:") || "untitled"}.sav`, "text/plain");
        }; let import_button = this.debug.level_editor.selected_window.createUIElement(
            240, 310, 50, 50, "textbutton", {"text": "import", "fontSize": "20"}
        ); import_button.onclick = async () => {
            let f = await pickFile();
            let t = JSON.parse(await Engine.gzipDecompressString(await f.text()));
            this.map.importMapData(t);
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
                const win = this.debug.level_editor.selected_window;
                const rx = win.getRenderX(this.camera);
                const ry = win.getRenderY(this.camera);

                let intersects = Engine.rectanglesIntersect(
                    mx, my, 10, 10,
                    rx, ry,
                    win.width,
                    win.height
                );
                if(intersects) {
                    win.handleClick(mx, my, this.camera);
                    return;
                }
            }
            if(this.debug.level_editor.layer_subwindow.visible) {
                const layer_win = this.debug.level_editor.layer_subwindow;
                const rx = layer_win.getRenderX(this.camera);
                const ry = layer_win.getRenderY(this.camera);
                let intersects2 = Engine.rectanglesIntersect(
                    mx, my, 10, 10,
                    rx, ry,
                    layer_win.width,
                    layer_win.height
                );
                if(intersects2) {
                    layer_win.handleClick(mx, my, this.camera);
                    return;
                }
            }
            if(st != null) {
                if(st[0] == tx && st[1] == ty) {
                    this.debug.level_editor.selected_tile = null;
                    this.debug.level_editor.selected_window.visible = false;
                    this.debug.level_editor.layer_subwindow.visible = false;
                    return;
                }
            }

            let m = this.map.getMapData(this.hero.mapx, this.hero.mapy);
            let win = this.debug.level_editor.selected_window;
            let layer_win = this.debug.level_editor.layer_subwindow;
            this.debug.level_editor.selected_tile = [tx, ty];
            win.visible = true;
            win.x = clamp(m.getX(tx)+32, 0, (m.data.rows*m.data.tsize)-(win.width*1.2))
            win.y = clamp(m.getY(ty)+32, 0, (m.data.cols*m.data.tsize)-(win.height*1.2))
            layer_win.visible = false;
            layer_win.x = clamp(m.getX(tx)+32-(win.width/1.5), 0, (m.data.rows*m.data.tsize)-(win.width*1.2))
            layer_win.y = clamp(m.getY(ty)+32, 0, (m.data.cols*m.data.tsize)-(win.height*1.2))
            
        })

        this.keyboard.setFunctionOnKeyPress(this.keyboard.KEYCODES.ESCAPE, () => {
            this.debug.level_editor.active = !this.debug.level_editor.active;
            this.debug.level_editor.selected_tile = null;
            this.debug.level_editor.selected_window.visible = false;
            this.debug.level_editor.layer_subwindow.visible = false;
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

        const triggers = this.map.getMapData(this.hero.mapx, this.hero.mapy).triggers;
        triggers.forEach(t => {
            t.update(this.hero);
        });
    
        this.hero.move(delta, dirx, diry, this.keyboard.isDown(this.keyboard.KEYCODES.SHIFT) ? 500 : 250);
        this.camera.update();
    };

    _drawLayer(layer) {
        var startCol = Math.floor(this.camera.x / this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize);
        var endCol = Math.min(
            this.map.getMapData(this.hero.mapx, this.hero.mapy).data.cols,
            startCol + Math.ceil(this.camera.width / this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize) + 1
        );
        var startRow = Math.floor(this.camera.y / this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize);
        var endRow = Math.min(
            this.map.getMapData(this.hero.mapx, this.hero.mapy).data.rows,
            startRow + Math.ceil(this.camera.height / this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize) + 1
        );
    
        for (var c = startCol; c < endCol; c++) {
            for (var r = startRow; r < endRow; r++) {
                var tile = this.map.getMapData(this.hero.mapx, this.hero.mapy).getTile(layer, c, r);
                var x = Math.floor(c * this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize - this.camera.x);
                var y = Math.floor(r * this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize - this.camera.y);
                
                if (tile !== 0) { // 0 => empty tile
                    this.ctx.drawImage(
                        this.tileAtlas, // image
                        (tile - 1) * this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize, // source x
                        0, // source y
                        this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize, // source width
                        this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize, // source height
                        Math.floor(x),
                        Math.floor(y),
                        this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize, // target width
                        this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize // target height
                    );
                }
            }
        }
    };

    _drawTriggers() {
        const map = this.map.getMapData(this.hero.mapx, this.hero.mapy);
    
        if (!map.triggers) return;
    
        const tsize = map.data.tsize;
    
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
            
    
            // convert to screen space
            const x = Math.round(worldX - this.camera.x);
            const y = Math.round(worldY - this.camera.y);
    
            // size
            const width = (trigger.w || 1) * tsize;
            const height = (trigger.h || 1) * tsize;
    
            //
            // choose color by trigger type
            //
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
            
    
            // fill trigger area
            this.ctx.fillRect(x, y, width, height);
    
            // border
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);
    
            //
            // label
            //
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
        const tsize = this.map.getMapData(this.hero.mapx, this.hero.mapy).data.tsize;
    
        for (let r = 0; r < this.map.getMapData(this.hero.mapx, this.hero.mapy).data.rows; r++) {
            for (let c = 0; c < this.map.getMapData(this.hero.mapx, this.hero.mapy).data.cols; c++) {
    
                // world position of tile
                let worldX = c * tsize;
                let worldY = r * tsize;
    
                // convert to screen space
                let x = Math.round(worldX - this.camera.x);
                let y = Math.round(worldY - this.camera.y);
    
                // check if tile is solid (any layer)
                let isSolid = this.map.getMapData(this.hero.mapx, this.hero.mapy).isSolidTileAtXY(
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
        const layers = Object.values(this.map.getMapData(this.hero.mapx, this.hero.mapy).data.layers);
        this._drawLayer(1); 
        this.ctx.drawImage(
            this.hero.image,
            Math.round(this.hero.screenX - this.hero.width / 2),
            Math.round(this.hero.screenY - this.hero.height / 2)
        );
        this._drawLayer(2); 

        for(let x = 2; x < layers.length; x++) {
            this._drawLayer(x);
        }
        
        if(this.debug.show_grid || this.debug.level_editor.active) {
            this._drawTriggers();
            this._drawGrid(); 
        }

        this.debug.level_editor.selected_window.draw(this.camera);
        this.debug.level_editor.layer_subwindow.draw(this.camera);
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

        this.data = {};

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
        if (this.isInsideWall()) {
            this.unstuck();
        }
    
        var maxX = this.map.data.cols * this.map.data.tsize;
        var maxY = this.map.data.rows * this.map.data.tsize;
        //this.x = Math.max(0, Math.min(this.x, maxX));
        //this.y = Math.max(0, Math.min(this.y, maxY));
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

    isInsideWall() {
        const left = this.x - this.width / 2;
        const right = this.x + this.width / 2 - 1;
    
        const top = this.y - this.height / 2;
        const bottom = this.y + this.height / 2 - 1;
    
        return (
            this.map.isSolidTileAtXY(left, top) ||
            this.map.isSolidTileAtXY(right, top) ||
            this.map.isSolidTileAtXY(left, bottom) ||
            this.map.isSolidTileAtXY(right, bottom)
        );
    };

    unstuck(maxRadius = 8) {
        if (!this.isInsideWall()) return false;
    
        const tsize = this.map.data.tsize;
    
        const startCol = this.map.getCol(this.x);
        const startRow = this.map.getRow(this.y);
    
        // spiral/radius search
        for (let radius = 1; radius <= maxRadius; radius++) {
    
            for (let y = -radius; y <= radius; y++) {
                for (let x = -radius; x <= radius; x++) {
    
                    const col = startCol + x;
                    const row = startRow + y;
    
                    // skip inner area
                    if (
                        Math.abs(x) !== radius &&
                        Math.abs(y) !== radius
                    ) continue;
    
                    const worldX = this.map.getX(col) + tsize / 2;
                    const worldY = this.map.getY(row) + tsize / 2;
    
                    // temporarily test this spot
                    const oldX = this.x;
                    const oldY = this.y;
    
                    this.x = worldX;
                    this.y = worldY;
    
                    if (!this.isInsideWall()) {
                        return true;
                    }
    
                    this.x = oldX;
                    this.y = oldY;
                }
            }
        }
    
        return false;
    };
}

export class Trigger {
    constructor(x, y, w, h, type, data, visual) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type;
        this.data = data;
        this.visual = visual;

        this._inside = new WeakSet();
    }

    intersects(x, y, w, h, tsize) {
        const tx = this.x * tsize;
        const ty = this.y * tsize;

        const tw = (this.w || 1) * tsize;
        const th = (this.h || 1) * tsize;

        return Engine.rectanglesIntersect(
            x - w / 2,
            y - h / 2,
            w,
            h,

            tx,
            ty,
            tw,
            th
        );
    }

    update(sprite) {
        const hit = this.intersects(
            sprite.x,
            sprite.y,
            sprite.width,
            sprite.height,
            sprite.map.data.tsize
        );

        const wasInside = this._inside.has(sprite);

        if (hit && !wasInside) {
            this._inside.add(sprite);
            this.onEnter(sprite);
        }

        else if (!hit && wasInside) {
            this._inside.delete(sprite);
            this.onExit(sprite);
        }

        else if (hit && wasInside) {
            this.onStay(sprite);
        }
    }

    onEnter(sprite) {
        switch (this.type) {
            case "portal": {
                sprite.worldMove(this.data.mapx, this.data.mapy)
                sprite.x = sprite.map.getX(this.data.outx); sprite.y = sprite.map.getY(this.data.outy);
                break;
            }
        }
    }

    onExit(sprite) {
    }

    onStay(sprite) {
        
    }
}