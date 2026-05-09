/**
 * author thebadlorax
 * created on 06-05-2026-10h-55m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Keyboard } from "./controller.js";
import { Loader, Camera, Window, Renderer } from "./renderer.js";
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
            "selected_layer": 1,
            "ui": {},
            "first_open": true
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
        this.renderer = new Renderer(context, this);
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
    
        let worldWidth  = this.map.getMapData(`home`).cols * this.map.getMapData(`home`).tsize;
        let worldHeight = this.map.getMapData(`home`).rows * this.map.getMapData(`home`).tsize;
    
        this.hero = new Sprite(
            this.map,
            "home",
            Math.floor(worldWidth / 2),
            Math.floor(worldHeight / 2),
            this.loader.getImage("player"),
            this
        );
    
        this.hero.x = Math.min(worldWidth, Math.max(0, this.hero.x));
        this.hero.y = Math.min(worldHeight, Math.max(0, this.hero.y));
    
        const canvas = this.ctx.canvas;
        canvas.width = wwidth;
        canvas.height = wheight;
        this.camera = new Camera(this.hero.map, canvas.width, canvas.height);
        this._resize();
    
        this.camera.follow(this.hero);

        this.debug.level_editor.selected_window          = new Window(this.ctx, 250, 250, 370, 370, "world");
        this.debug.level_editor.layer_subwindow          = new Window(this.ctx, 250, 250, 200, 370, "world");
        this.debug.level_editor.info_subwindow           = new Window(this.ctx, 250, 250, 370, 70,  "world");
        this.debug.level_editor.tile_settings_subwindow  = new Window(this.ctx, 250, 250, 200, 370,  "world");
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
                this.hero.map.setTile(this.debug.level_editor.selected_layer, e[0], e[1], x)
            };

            tile_buttons.push(ele);
            
            a+= 1;
        }; let layer_button = this.debug.level_editor.selected_window.createUIElement(
            10, 310, 50, 50, "textbutton", {"text": "layers", "fontSize": "40"}
        ); let map_button = this.debug.level_editor.selected_window.createUIElement(
            80, 310, 50, 50, "textbutton", {"text": "map", "fontSize": "40"}
        );
        
        let blocked_tiles_button = this.debug.level_editor.selected_window.createUIElement(
            140, 310, 50, 50, "textbutton", {"text": "objects", "fontSize": "20"}
        ); let wall_tile_button = this.debug.level_editor.selected_window.createUIElement(
            10, 10, 50, 50, "textbutton", {"text": "wall", "fontSize": "20"}
        ); wall_tile_button.visible = false; wall_tile_button.onclick = () => {
            let e = this.debug.level_editor.selected_tile;
            this.hero.map.setTile(0, e[0], e[1], 1)
        }; let clear_wall_tile_button = this.debug.level_editor.selected_window.createUIElement(
            70, 10, 50, 50, "textbutton", {"text": "nowall", "fontSize": "20"}
        ); clear_wall_tile_button.visible = false; clear_wall_tile_button.onclick = () => {
            let e = this.debug.level_editor.selected_tile;
            this.hero.map.setTile(0, e[0], e[1], 0)
        }; let portal_button = this.debug.level_editor.selected_window.createUIElement(
            130, 10, 50, 50, "textbutton", {"text": "portal", "fontSize": "20"}
        ); portal_button.visible = false; portal_button.onclick = () => {
            let e = this.debug.level_editor.selected_tile;
            let m = this.hero.map;
            let width = parseInt(prompt("portal width (grid)")); if(!width && width != 0) return;
            let height = parseInt(prompt("portal height (grid)")); if(!height && height != 0) return;
            let mapid = prompt("mapID (name of the map in the map tab)"); if(!mapid  && mapid != 0) return;
            if(!Object.keys(this.map.maps).includes(mapid)) {
                alert("invalid mapID (check the map)");
                return;
            }
            let outx = parseInt(prompt("teleport x (grid x to send player to)")); if(!outx && outx != 0) return;
            if(outx > this.map.maps[mapid].rows) {
                alert("i won't stop you but this x value will take the player outside the map")
            }
            let outy = parseInt(prompt("teleport y (grid x to send player to)")); if(!outy && outy != 0) return;
            if(outy > this.map.maps[mapid].cols) {
                alert("i won't stop you but this y value will take the player outside the map")
            }
            m.createTrigger(e[0], e[1], width, height, "portal", {
                "mapid": mapid,
                "outx": outx,
                "outy": outy
            });
            handle_tinfo_window();
        };

        other_buttons.push(clear_wall_tile_button, wall_tile_button, portal_button)
        let map_buttons = [];

        const createLayerButtons = () => {
            const layer_win = this.debug.level_editor.layer_subwindow;
            layer_win.UIElements = [];

            const layers = Object.values(this.hero.map.data.layers);

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
                    this.hero.map.createLayer(prompt("name"));
                    createLayerButtons();
                }
            }
        }

        const createMap = () => {
            const maps = this.map.maps;
            const values = Object.values(maps);
            map_buttons.forEach(e => e.destroy());
            map_buttons = [];

            let a = 0; let y_off = 0;
            
            for(let x = 0; x < values.length; x++) {
                const m = values[x];
                if(a > 2) { y_off += 1; a = 0; };
                let mb = this.debug.level_editor.selected_window.createUIElement(
                    10+((x-y_off*3)*120), 10+(y_off*120), 110, 110, "textbutton", 
                    {"text": `${m.id}`, "fontSize": "40", "strokeColor": `${this.hero.mapid == m.id ? "cyan" : "black"}`}
                );
                mb.onclick = () => {
                    this.hero.worldMove(m.id);
                    let m2 = this.hero.map;
                    this.hero.x =
                        m2.getX(Math.floor(m2.rows / 2)) +
                        m2.tsize / 2;

                    this.hero.y =
                        m2.getY(Math.floor(m2.cols / 2)) +
                        m2.tsize / 2;
                    map_button.onclick();
                }
                map_buttons.push(mb);
                a += 1;
            }

            a += 1; if(a > 3) { y_off += 1; a = 0; };

            let new_button = this.debug.level_editor.selected_window.createUIElement(
                10+(((values.length-y_off*3))*120), 10+(y_off*120),
                110, 110, "textbutton",
                {
                    "text": "+",
                    "fontSize": "20"
                }
            );
            new_button.onclick = () => {
                let n = prompt("name") || "unnamed";
                if(Object.keys(maps).includes(n)) {
                    alert("already exists");
                    return;
                }
                let m2 = this.map.createMapData(n, parseInt(prompt("columns")) || 10, parseInt(prompt("rows")) || 10);
                createMap();
            }

            map_buttons.push(new_button); 
        }

        map_button.onclick = () => {
            if(layer_button.visible) {
                layer_button.visible = false;
                map_button.visible = true;
                blocked_tiles_button.visible = false;
                this.debug.level_editor.layer_subwindow.visible = false;
                tile_buttons.forEach(t => t.visible = false)
                map_button.data.strokeColor = "cyan";
                createMap();
            } else {
                layer_button.visible = true;
                blocked_tiles_button.visible = true;
                map_button.visible = true;
                map_button.data.strokeColor = "black";
                map_buttons.forEach(t => t.visible = false)
                tile_buttons.forEach(t => t.visible = true)
            }
        }

        this.debug.level_editor.layer_button = layer_button;
        
        layer_button.onclick = () => {
            this.debug.level_editor.layer_subwindow.visible = !this.debug.level_editor.layer_subwindow.visible;
            createLayerButtons();

            blocked_tiles_button.data.strokeColor = "black";
            tile_buttons.forEach(t => t.visible = true)
            other_buttons.forEach(t => t.visible = false)
        }; blocked_tiles_button.onclick = () => {
            if(layer_button.visible) {
                layer_button.visible = false;
                map_button.visible = false;
                blocked_tiles_button.data.strokeColor = "cyan";
                this.debug.level_editor.layer_subwindow.visible = false;
                tile_buttons.forEach(t => t.visible = false)
                other_buttons.forEach(t => t.visible = true)
            } else {
                layer_button.visible = true;
                map_button.visible = true;
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

        this.debug.level_editor.ui.player_pos_text = this.debug.level_editor.info_subwindow.createUIElement(
            150, -10, 50, 50, "text", {
                "text": "player pos: (xxx, xxx)"
            }
        ); this.debug.level_editor.ui.player_worldpos_text = this.debug.level_editor.info_subwindow.createUIElement(
            150, 10, 50, 50, "text", {
                "text": "map pos: (x, x)"
            }
        ); this.debug.level_editor.ui.selected_tile_text = this.debug.level_editor.info_subwindow.createUIElement(
            150, 30, 50, 50, "text", {
                "text": "selected tile: (x, x)"
            }
        );

        window.addEventListener("resize", () => {
            this._resize();
        });

        const handle_tinfo_window = () => {
            let win = this.debug.level_editor.selected_window;
            let wx = win.x; let wy = win.y;
            let m = this.hero.map;

            const triggers = m.getTriggersOnTile(this.debug.level_editor.selected_tile[0], this.debug.level_editor.selected_tile[1]);
            const tinfo_win = this.debug.level_editor.tile_settings_subwindow;
            if(triggers.length > 0) {
                let trigger = triggers[0];
                let has_visual_offset = false;
                if(trigger.visual != null) {
                    if(trigger.visual.offset != null) has_visual_offset = true;
                }
                tinfo_win.visible = true;
                tinfo_win.x = wx+(m.tsize*6)
                tinfo_win.y = wy
                tinfo_win.UIElements = [];

                tinfo_win.createUIElement(
                    70, 10, 50, 50, "text", {
                        "text": `type: ${trigger.type}`
                    }
                ); tinfo_win.createUIElement(
                    70, 30, 50, 50, "text", {
                        "text": `grid position: (${trigger.x}, ${trigger.y})`
                    }
                ); if(has_visual_offset) {
                    tinfo_win.createUIElement(
                        70, 50, 50, 50, "text", {
                            "text": `visual offset: (${trigger.visual.offset.x}, ${trigger.visual.offset.y})`
                        }
                    );
                }
                tinfo_win.createUIElement(
                    70, has_visual_offset ? 70 : 50, 50, 50, "text", {
                        "text": `width: ${trigger.w}, height: ${trigger.h}`
                    }
                );

                switch(trigger.type) {
                    case "portal": {
                        tinfo_win.createUIElement(
                            70, 110, 50, 50, "text", {
                                "text": `mapID: ${trigger.data.mapid}`
                            }
                        ); tinfo_win.createUIElement(
                            70, 130, 50, 50, "text", {
                                "text": `destination (x, y): (${trigger.data.outx}, ${trigger.data.outy})`
                            }
                        );
                    }
                };
            } else {
                tinfo_win.visible = false;
            }
        }

        window.addEventListener("click", (e) => {
            if(!this.debug.level_editor.active) return;
            let mx = e.clientX; let my = e.clientY;
            let m = this.hero.map;
            let tsize = m.tsize;
            let tx = Math.floor((mx + this.camera.x) / tsize);
            let ty = Math.floor((my + this.camera.y) / tsize);
            if(tx >= m.rows || ty >= m.cols) {
                return;
            }
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
                    this.debug.level_editor.info_subwindow.visible = false;
                    this.debug.level_editor.tile_settings_subwindow.visible = false;
                    return;
                }
            }

            
            
            let win = this.debug.level_editor.selected_window;
            let layer_win = this.debug.level_editor.layer_subwindow;
            this.debug.level_editor.selected_tile = [tx, ty];
            win.visible = true;
            let wx = clamp(m.getX(tx)+Math.floor(m.tsize/2), 210, (m.rows*m.tsize)-(win.width*1.2));
            let wy = clamp((m.getY(ty)+Math.floor(m.tsize/2)), 110, (m.cols*m.tsize)-(win.height*1.2));
            win.x = wx;
            win.y = wy;
            this.debug.level_editor.info_subwindow.visible = true;
            this.debug.level_editor.info_subwindow.x = wx;
            this.debug.level_editor.info_subwindow.y = wy - 100;
            layer_win.visible = false;
            layer_win.x = clamp(wx-(m.tsize*3.35), 0, (m.rows*m.tsize)-(win.width*1.2))
            layer_win.y = clamp(wy, 110, (m.cols*m.tsize)-(win.height*1.2))

            //const tile = m.getTile(this.debug.level_editor.selected_layer, tx, ty);
            handle_tinfo_window();
        })

        this.keyboard.setFunctionOnKeyPress(this.keyboard.KEYCODES.ESCAPE, () => {
            if(this.debug.level_editor.first_open) {
                alert("triggers don't activate while in level editor mode");
                this.debug.level_editor.first_open = false;
            }
            this.debug.level_editor.active = !this.debug.level_editor.active;
            this.debug.level_editor.selected_tile = null;
            this.debug.level_editor.selected_window.visible = false;
            this.debug.level_editor.layer_subwindow.visible = false;
            this.debug.level_editor.info_subwindow.visible = false;
            this.debug.level_editor.tile_settings_subwindow.visible = false;
        });  
    };

    _resize() {
        const canvas = this.ctx.canvas;
    
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    
        this.camera.width = canvas.width;
        this.camera.height = canvas.height;
    
        this.camera.worldWidth  = this.camera.map.cols * this.camera.map.tsize;
        this.camera.worldHeight = this.camera.map.rows * this.camera.map.tsize;
    };

    update(delta) {
        var dirx = 0;
        var diry = 0;
        if (this.keyboard.isDown(this.keyboard.KEYCODES.LEFT_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.A_KEY)) { dirx += -1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.RIGHT_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.D_KEY)) { dirx += 1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.UP_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.W_KEY)) { diry += -1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.DOWN_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.S_KEY)) { diry += 1; }

        this.debug.show_grid = this.keyboard.isDown(this.keyboard.KEYCODES.G_KEY);

        const triggers = this.hero.map.triggers;
        if(!this.debug.level_editor.active) {
            triggers.forEach(t => {
                t.update(this.hero);
            });
        }
       
    
        this.hero.move(delta, dirx, diry, this.keyboard.isDown(this.keyboard.KEYCODES.SHIFT) ? 500 : 250);
        this.camera.update();
    };

    _drawLayer(layer) {
        var startCol = Math.floor(this.camera.x / this.hero.map.tsize);
        var endCol = Math.min(
            this.hero.map.cols,
            startCol + Math.ceil(this.camera.width / this.hero.map.tsize) + 1
        );
        var startRow = Math.floor(this.camera.y / this.hero.map.tsize);
        var endRow = Math.min(
            this.hero.map.rows,
            startRow + Math.ceil(this.camera.height / this.hero.map.tsize) + 1
        );
    
        for (var c = startCol; c < endCol; c++) {
            for (var r = startRow; r < endRow; r++) {
                var tile = this.hero.map.getTile(layer, c, r);
                var x = Math.floor(c * this.hero.map.tsize - this.camera.x);
                var y = Math.floor(r * this.hero.map.tsize - this.camera.y);
                
                if (tile !== 0) { // 0 => empty tile
                    this.ctx.drawImage(
                        this.tileAtlas, // image
                        (tile - 1) * this.hero.map.tsize, // source x
                        0, // source y
                        this.hero.map.tsize, // source width
                        this.hero.map.tsize, // source height
                        Math.floor(x),
                        Math.floor(y),
                        this.hero.map.tsize, // target width
                        this.hero.map.tsize // target height
                    );
                }
            }
        }
    };

    _drawTriggers() {
        const map = this.hero.map;
    
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
        const tsize = this.hero.map.tsize;
    
        for (let r = 0; r < this.hero.map.rows; r++) {
            for (let c = 0; c < this.hero.map.cols; c++) {
    
                // world position of tile
                let worldX = c * tsize;
                let worldY = r * tsize;
    
                // convert to screen space
                let x = Math.round(worldX - this.camera.x);
                let y = Math.round(worldY - this.camera.y);
    
                // check if tile is solid (any layer)
                let isSolid = this.hero.map.isSolidTileAtXY(
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
        const layers = Object.values(this.hero.map.data.layers);
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
        this.debug.level_editor.ui.player_pos_text.data.text = `player pos: (${Math.floor(this.hero.x)}, ${Math.floor(this.hero.y)}) (grid: (${this.hero.map.getCol(this.hero.x)}, ${this.hero.map.getRow(this.hero.y)}))`
        this.debug.level_editor.ui.player_worldpos_text.data.text = `mapID: ${this.hero.mapid}`;
        let st = this.debug.level_editor.selected_tile || ["n/a, n/a"];
        this.debug.level_editor.ui.selected_tile_text.data.text = `selected tile: (${st[0]}, ${st[1]})`;
        this.debug.level_editor.info_subwindow.draw(this.camera)
        this.debug.level_editor.tile_settings_subwindow.draw(this.camera);

        if(this.debug.show_grid || this.debug.level_editor.active) {
            this.hero.drawHitbox(this.ctx);
        }
    };
}

export class Sprite {
    constructor(map, id, x, y, img, eng) {
        this.mapObj = map;
        this.mapid = id;
        this.map = this.mapObj.getMapData(this.mapid)
        this.x = x;
        this.y = y;
        this.width = this.map.tsize;
        this.height = this.map.tsize;
        this.engine = eng;

        this.data = {};

        this.image = img;
    };

    worldMove(id) {
        this.mapid = id;
        this.map = this.mapObj.getMapData(this.mapid)
        this.engine.camera.map = this.map;

        this.engine.camera.worldWidth =
            this.map.cols * this.map.tsize;

        this.engine.camera.worldHeight =
            this.map.rows * this.map.tsize;
        this.engine.debug.level_editor.selected_tile = null;
        this.engine.debug.level_editor.selected_window.visible = false;
        this.engine.debug.level_editor.layer_subwindow.visible = false;
        this.engine.debug.level_editor.info_subwindow.visible = false;

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
    
        var maxX = this.map.cols * this.map.tsize;
        var maxY = this.map.rows * this.map.tsize;
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
    
        const tsize = this.map.tsize;
    
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

    drawHitbox(ctx) {
        ctx.fillStyle = "rgba(255, 192, 203, 0.6)";
        ctx.fillRect(
            (this.x - this.engine.camera.x) - Math.floor(this.width / 2),
            (this.y - this.engine.camera.y) - Math.floor(this.height / 2),
            this.width,
            this.height
        );
    
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
        ctx.arc(
            this.x - this.engine.camera.x,
            this.y - this.engine.camera.y,
            5,
            0,
            2 * Math.PI
        );
    
        ctx.fill();
    }
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
            sprite.map.tsize
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
                if(sprite.mapid != this.data.mapid) sprite.worldMove(this.data.mapid)
                sprite.x =
                    sprite.map.getX(this.data.outx) +
                    sprite.map.tsize / 2;
                
                sprite.y =
                    sprite.map.getY(this.data.outy) +
                    sprite.map.tsize / 2;
                break;
            }
        }
    }

    onExit(sprite) {
    }

    onStay(sprite) {
        
    }
}