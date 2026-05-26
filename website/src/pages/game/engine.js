/**
 * author thebadlorax
 * created on 06-05-2026-10h-55m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Keyboard } from "./controller.js";
import { Loader, Camera, Window, Renderer, AnimationManager } from "./renderer.js";
import { Map } from "./map.js";
import { downloadBlob, pickFile } from "./browser.js";

import { clamp } from "../common.js";
import { Card, CardManager, CombatManager } from "./combat.js";

export class InventoryItem {
    constructor(data) {
        this.data = data.data;
        this.type = data.type;
    }
}

export class Inventory {
    constructor() {
        this.items = [];
    }

    giveItem(item) { this.items.push(item); }

    getAllCardIds() { 
        const cards = this.items.filter(i => i.type == "card");
        let card_ids = cards.map(c => c.data.id); 
        return card_ids;
    }

    getUniqueCardIds() { return [...new Set(this.getAllCardIds())]; }

    getCardCounts() {
        let c = [];
        const cards = this.getAllCardIds();
        this.getUniqueCardIds().forEach(id => c.push({
            "id": id,
            "count": cards.map(c => c == id).length
        }));
        return c;
    }

    getCardCount(card_id) { return this.getCardCounts().find(c => c.id == card_id); }

    getItems() { return this.items }
}

export class Engine {
    static rectanglesIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
        if (x1 + w1 <= x2 || x2 + w2 <= x1) return false;
        if (y1 + h1 <= y2 || y2 + h2 <= y1) return false;
        return true;
    }; static getRectangleOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
        const left   = Math.max(x1, x2);
        const top    = Math.max(y1, y2);
        const right  = Math.min(x1 + w1, x2 + w2);
        const bottom = Math.min(y1 + h1, y2 + h2);

        const width  = right - left;
        const height = bottom - top;

        if (width <= 0 || height <= 0) { return null; }
    
        return {
            x: left,
            y: top,
            w: width,
            h: height
        };
    } static catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
    
        return {
            x: 0.5 * (
                (2 * p1.x) +
                (-p0.x + p2.x) * t +
                (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 +
                (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3
            ),
            y: 0.5 * (
                (2 * p1.y) +
                (-p0.y + p2.y) * t +
                (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 +
                (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3
            )
        };
    }; static isPointInRadius(px, py, cx, cy, radius) {
        const dx = px - cx;
        const dy = py - cy;
        return (dx * dx + dy * dy) <= (radius * radius);
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
    };

    debug = {
        "show_grid": false,
        "level_editor": {
            "active": false,
            "multiselect": {
                "active": false,
                "start_tile": null,
                "end_tile": null,
                "selection_rect": null
            },
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
        this.cards = new CardManager();
        this.combat = new CombatManager(this.cards, this);
        this.state = "main";
        this.other_state = null;
        this.other_state_data = null;
        this.inventory = new Inventory();
        this.has_setup_handlers = false;
        this.settings = this.data.player_data.settings || {
            "performance_mode": false
        }
    };

    load() { return this.data.assets.filter(b => b[1].includes(".png") || b[1].includes(".jpg")).map(b => this.loader.loadImage(b[0], b[1])) };

    setupHTML() {
        document.getElementById("loading-text").style.display = "none";
    }

    run(context) {
        this.ctx = context;
        this._previousElapsed = 0;
    
        var p = this.load();
        Promise.all(p).then(() => {
            this.init();
            this.setupHTML();
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
        this.renderer.render();
    }

    setupLevelEditor() {
        this.debug.level_editor.selected_window          = new Window(this.ctx, 0, 0, 370, 370, "world");
        this.debug.level_editor.layer_subwindow          = new Window(this.ctx, 0, 0, 200, 370, "world");
        this.debug.level_editor.info_subwindow           = new Window(this.ctx, 0, 0, 370, 70,  "world");
        this.debug.level_editor.tile_settings_subwindow  = new Window(this.ctx, 0, 0, 200, 370, "world");
        this.renderer.windows.push(
            this.debug.level_editor.selected_window, 
            this.debug.level_editor.layer_subwindow, 
            this.debug.level_editor.info_subwindow, 
            this.debug.level_editor.tile_settings_subwindow
        );
        this.debug.level_editor.info_subwindow.onrender = () => {
            this.debug.level_editor.ui.player_pos_text.data.text = `player pos: (${Math.floor(this.hero.x)}, ${Math.floor(this.hero.y)}) (grid: (${this.hero.map.getCol(this.hero.x)}, ${this.hero.map.getRow(this.hero.y)}))`
            this.debug.level_editor.ui.player_worldpos_text.data.text = `mapID: ${this.hero.mapid}`;
        };
        let tilemap = this.renderer.tileAtlas;
        let tileCount = Math.floor(tilemap.width/64);
        let a = 0; let y_off = 10;
        const get_rect_as_list = () => {
            const rect = this.debug.level_editor.multiselect.selection_rect
            let pos = [];
            for(let y = rect.y; y <= rect.y + rect.h; y++) {
                for(let x = rect.x; x <= rect.x + rect.w; x++) {
                    pos.push({"x": x, "y": y})
                }
            }
            return pos;
        }
        let tile_buttons = []; let other_buttons = [];
        for(let x = 0; x <= tileCount; x++) {
            if(a >= 6) { a = 0; y_off += 60; }
            let ele = this.debug.level_editor.selected_window.createUIElement(
                10+(a*60), y_off, 50, 50, "image", {"atlas": true, "image": tilemap, "tileSize": 64, "atlasIndex": x}
            );
            ele.onclick = () => {
                const tiles = get_rect_as_list();
                tiles.forEach(t => {
                    this.hero.map.setTile(this.debug.level_editor.selected_layer, t.x, t.y, x)
                })
            };

            tile_buttons.push(ele);
            
            a+= 1;
        }; let layer_button = this.debug.level_editor.selected_window.createUIElement(
            10, 310, 50, 50, "textbutton", {"text": "layers", "fontSize": "40"}
        ); let map_button = this.debug.level_editor.selected_window.createUIElement(
            80, 310, 50, 50, "textbutton", {"text": "map", "fontSize": "40"}
        );
        
        let objects_button = this.debug.level_editor.selected_window.createUIElement(
            140, 310, 50, 50, "textbutton", {"text": "objects", "fontSize": "20"}
        ); let wall_tile_button = this.debug.level_editor.selected_window.createUIElement(
            10, 10, 50, 50, "textbutton", {"text": "wall", "fontSize": "20"}
        ); wall_tile_button.visible = false; wall_tile_button.onclick = () => {
            const tiles = get_rect_as_list();
            tiles.forEach(t => {
                this.hero.map.setTile(0, t.x, t.y, 1)
            })
            
        }; let clear_wall_tile_button = this.debug.level_editor.selected_window.createUIElement(
            70, 10, 50, 50, "textbutton", {"text": "nowall", "fontSize": "20"}
        ); clear_wall_tile_button.visible = false; clear_wall_tile_button.onclick = () => {
            const tiles = get_rect_as_list();
            tiles.forEach(t => {
                this.hero.map.setTile(0, t.x, t.y, 0)
            })
        }; let portal_button = this.debug.level_editor.selected_window.createUIElement(
            130, 10, 50, 50, "textbutton", {"text": "portal", "fontSize": "20"}
        ); portal_button.visible = false; portal_button.onclick = () => {
            let m = this.hero.map;
            let width = this.debug.level_editor.multiselect.selection_rect.w+1;
            let height = this.debug.level_editor.multiselect.selection_rect.h+1;
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
            m.createTrigger(this.debug.level_editor.multiselect.selection_rect.x, this.debug.level_editor.multiselect.selection_rect.y, width, height, "portal", {
                "mapid": mapid,
                "outx": outx,
                "outy": outy
            });
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
                objects_button.visible = false;
                this.debug.level_editor.layer_subwindow.visible = false;
                tile_buttons.forEach(t => t.visible = false)
                map_button.data.strokeColor = "cyan";
                createMap();
            } else {
                layer_button.visible = true;
                objects_button.visible = true;
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

            objects_button.data.strokeColor = "black";
            tile_buttons.forEach(t => t.visible = true)
            other_buttons.forEach(t => t.visible = false)
        }; objects_button.onclick = () => {
            if(layer_button.visible) {
                layer_button.visible = false;
                map_button.visible = false;
                objects_button.data.strokeColor = "cyan";
                this.debug.level_editor.layer_subwindow.visible = false;
                tile_buttons.forEach(t => t.visible = false)
                other_buttons.forEach(t => t.visible = true)
            } else {
                layer_button.visible = true;
                map_button.visible = true;
                objects_button.data.strokeColor = "black";
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
            this.hero.worldMove(this.hero.mapid);
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
        );
    }

    setKeybinds() {
        if(!this.has_setup_handlers) {
            window.addEventListener("resize", () => {
                this._resize();
            });
    
            window.addEventListener("mousedown", (e) => {
                if(this.other_state == "menu") {
                    this.renderer.active_menu.onclick();
                    return;
                }
                if(this.combat.in_combat) {
                    this.combat.onClick();
                    return;
                };

                switch(this.other_state) {
                    case "dialogue": {
                        this.other_state_data.getDialogue().progress(this, this.other_state_data);
                        return;
                    }
                }

                let mx = e.clientX; let my = e.clientY;
                let m = this.hero.map;
                let tsize = m.tsize;
                let tx = Math.floor((mx + this.camera.x) / tsize);
                let ty = Math.floor((my + this.camera.y) / tsize);
                if(tx >= m.cols || ty >= m.rows || tx < 0 || ty < 0) {
                    return;
                }

                if(this.debug.level_editor.active) {
                    this.debug.level_editor.multiselect.active = false;
                    this.debug.level_editor.multiselect.active = true;
                    this.debug.level_editor.multiselect.start_tile = [tx, ty];
                } else {
                    m.getObjects().filter(o => o instanceof NPC).forEach(o => {
                        if(o.x == tx && o.y == ty) {
                            const dx = this.hero.x - (o.x * tsize);
                            const dy = this.hero.y - (o.y * tsize);
                            let dist = Math.hypot(dx, dy);

                            if (dist < 200) {
                                o.onClick(this);
                            }
                        }
                    });
                }
            });
    
            window.addEventListener("mouseup", (e) => {
                if(this.combat.in_combat) {
                    this.combat.onRelease();
                    return;
                }
                let mx = e.clientX; let my = e.clientY;
                let m = this.hero.map;
                let tsize = m.tsize;
                let tx = Math.floor((mx + this.camera.x) / tsize);
                let ty = Math.floor((my + this.camera.y) / tsize);

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
                };
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
                };

                if(tx >= m.cols || ty >= m.rows || tx < 0 || ty < 0) {
                    return;
                }

                const sr = this.debug.level_editor.multiselect.selection_rect;
                if(sr != null) {
                    let inside_selection = Engine.rectanglesIntersect(tx, ty, 1, 1, sr.x, sr.y, sr.w+1, sr.h+1)
                    if(inside_selection) {
                        this.debug.level_editor.multiselect.selection_rect = null;
                        this.debug.level_editor.selected_window.visible = false;
                        this.debug.level_editor.layer_subwindow.visible = false;
                        this.debug.level_editor.info_subwindow.visible = false;
                        this.debug.level_editor.tile_settings_subwindow.visible = false;
                        return;
                    }
                }
                
                if(!this.debug.level_editor.active) {
                    this.debug.level_editor.multiselect.start_tile = null;
                    return;
                }

                if(this.debug.level_editor.multiselect.active) {
                    this.debug.level_editor.multiselect.end_tile = [tx, ty];

                    let win = this.debug.level_editor.selected_window;
                    let layer_win = this.debug.level_editor.layer_subwindow;
                    win.visible = true;

                    const x1 = this.debug.level_editor.multiselect.start_tile[0];
                    const y1 = this.debug.level_editor.multiselect.start_tile[1];
                    const x2 = tx;
                    const y2 = ty;

                    const selection_rect = {
                        x: Math.min(x1, x2),
                        y: Math.min(y1, y2),
                        w: Math.abs(x2 - x1),
                        h: Math.abs(y2 - y1),
                    };

                    this.debug.level_editor.multiselect.selection_rect = selection_rect;

                    const middle_tile = {
                        "x": selection_rect.x + Math.floor(selection_rect.w/2),
                        "y": selection_rect.y + Math.floor(selection_rect.h/2),
                    }

                    let wx = clamp(m.getX(middle_tile.x)+Math.floor(m.tsize/2), 210, (m.rows*m.tsize)-(win.width*1.2));
                    let wy = clamp((m.getY(middle_tile.y)+Math.floor(m.tsize/2)), 110, (m.cols*m.tsize)-(win.height*1.2));
                    win.x = wx;
                    win.y = wy;
                    this.debug.level_editor.info_subwindow.visible = true;
                    this.debug.level_editor.info_subwindow.x = wx;
                    this.debug.level_editor.info_subwindow.y = wy - 100;
                    layer_win.visible = false;
                    layer_win.x = clamp(wx-(m.tsize*3.35), 0, (m.rows*m.tsize)-(win.width*1.2))
                    layer_win.y = clamp(wy, 110, (m.cols*m.tsize)-(win.height*1.2))
                }
            });

            this.ctx.canvas.addEventListener("contextmenu", (e) => {
                e.preventDefault();
            });

            this.has_setup_handlers = true;
        }
       
        this.keyboard.setFunctionOnKeyPress(this.keyboard.KEYCODES.M_KEY, () => {
            if(this.combat.in_combat) return;
            if(this.debug.level_editor.first_open) {
                alert("triggers don't activate while in level editor mode");
                this.debug.level_editor.first_open = false;
            }
            this.debug.level_editor.active = !this.debug.level_editor.active;
            this.debug.level_editor.multiselect.selection_rect = null;
            this.debug.level_editor.selected_window.visible = false;
            this.debug.level_editor.layer_subwindow.visible = false;
            this.debug.level_editor.info_subwindow.visible = false;
            this.debug.level_editor.tile_settings_subwindow.visible = false;
        });  

        this.keyboard.setFunctionOnKeyPress(this.keyboard.KEYCODES.ESCAPE, () => {
            if(this.other_state == "menu") {
                this.renderer.closeMenu();
            } else {
                this.renderer.openMenu(this.renderer.menus.escape_menu);
            }
        })
    }

    init() {
        this.keyboard.listenForEvents(
            Object.values(this.keyboard.KEYCODES));

        const starting_area_data = this.map.getMapData(`home`);
    
        let wwidth = window.innerWidth; let wheight = window.innerHeight;
    
        let worldWidth  = starting_area_data.cols * starting_area_data.tsize;
        let worldHeight = starting_area_data.rows * starting_area_data.tsize;
    
        const canvas = this.ctx.canvas;
        canvas.width = wwidth;
        canvas.height = wheight;
        this.camera = new Camera(starting_area_data, canvas.width, canvas.height);
        this.renderer = new Renderer(this.ctx, this.camera, this);
        this._resize();

        this.setupLevelEditor();

        this.hero = new Sprite(
            this.map,
            "home",
            Math.floor(worldWidth / 2),
            Math.floor(worldHeight / 2),
            this.loader.getImage("player"),
            this,
            this.data.animations.player
        );
        this.hero.zindex = 1;
    
        this.hero.x = Math.min(worldWidth, Math.max(0, this.hero.x));
        this.hero.y = Math.min(worldHeight, Math.max(0, this.hero.y));
    
        this.camera.follow(this.hero);

        this.setKeybinds()

        this.data.cards.forEach(c => this.cards.cards.push(Card.fromJSON(c, this.loader)));

        this.data.player_data.inventory.items.forEach(i => {
            this.inventory.giveItem(i);
        });

        this.data.player_data.deck.forEach(c => {
            this.cards.addToDeck(c);
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
        if(this.other_state == "menu") {
            this.camera.update();
            this.renderer.sprites.forEach(s =>  s.anims.updateAnimations(delta));
            this.hero.map.getObjects().filter(o => o instanceof NPC).forEach(o => { if(o.anims != null) o.anims.updateAnimations(delta) });
            document.body.style.cursor = "default"; 
            if(!this.settings.performance_mode) {
                let mx = this.keyboard.mouseX; let my = this.keyboard.mouseY;
                const m = this.renderer.active_menu
                const rx = m.getRenderX(); const ry = m.getRenderY();
                m.UIElements.forEach(e => {
                    if(!e.visible || e.onclick == null) return;
                    if(Engine.rectanglesIntersect(mx, my, 10, 10, rx+e.x,ry+e.y, e.w, e.h)) {
                        document.body.style.cursor = "pointer"; 
                    }
                })
            }
            return;
        }
        if(this.combat.in_combat) {
            this.combat.combatUpdate(delta);
            return;
        };
        if(this.state == "cutscene") return;
        var dirx = 0;
        var diry = 0;
        if (this.keyboard.isDown(this.keyboard.KEYCODES.LEFT_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.A_KEY)) { dirx += -1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.RIGHT_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.D_KEY)) { dirx += 1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.UP_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.W_KEY)) { diry += -1; }
        if (this.keyboard.isDown(this.keyboard.KEYCODES.DOWN_ARROW) || this.keyboard.isDown(this.keyboard.KEYCODES.S_KEY)) { diry += 1; }

        const space_down = this.keyboard.isDown(this.keyboard.KEYCODES.SPACE)
        this.renderer.windows.forEach(w => {
            w.opacity = space_down ? 0.2 : 1
            w.pass_clicks_through = space_down
        })

        this.debug.show_grid = this.keyboard.isDown(this.keyboard.KEYCODES.G_KEY);

        const triggers = this.hero.map.triggers;
        if(!this.debug.level_editor.active) {
            triggers.forEach(t => {
                t.update(this.hero);
            });
        }

        this.renderer.sprites.forEach(s =>  s.anims.updateAnimations(delta))
        this.hero.map.getObjects().filter(o => o instanceof NPC).forEach(o => { if(o.anims != null) o.anims.updateAnimations(delta) })
       
    
        this.hero.move(delta, dirx, diry, this.keyboard.isDown(this.keyboard.KEYCODES.SHIFT) ? 500 : 250);
        this.camera.update();

        document.body.style.cursor = "default"; 
        if(!this.settings.performance_mode) {
            let mx = this.keyboard.mouseX; let my = this.keyboard.mouseY;
            let m = this.hero.map;
            let tsize = m.tsize;
            let tx = Math.floor((mx + this.camera.x) / tsize);
            let ty = Math.floor((my + this.camera.y) / tsize);
            if(tx >= m.cols || ty >= m.rows || tx < 0 || ty < 0) {
                return;
            }
    
            m.getObjects().filter(o => o instanceof NPC).forEach(o => {
                if(o.x == tx && o.y == ty) {
                    const dx = this.hero.x - (o.x * tsize);
                    const dy = this.hero.y - (o.y * tsize);
                    let dist = Math.hypot(dx, dy);
    
                    if (dist < 200) {
                        document.body.style.cursor = "pointer";
                    }
                }
            });
        }
        if(this.other_state == "dialogue") document.body.style.cursor = "pointer"; 
    };
}

export class Sprite {
    constructor(map, id, x, y, img, eng, animations=[]) {
        this.mapObj = map;
        this.mapid = id;
        this.map = this.mapObj.getMapData(this.mapid)
        this.x = x;
        this.y = y;
        this.width = this.map.tsize;
        this.height = this.map.tsize;
        this.engine = eng;

        this.block_movement = false;

        this.anims = new AnimationManager(img);
        animations.forEach(a => {
            this.anims.createAnimation(a);
        })

        this.data = {};

        this.image = img;

        this.onrender = () => {};
        this.engine.renderer.sprites.push(this);
    };

    worldMove(id) {
        this.mapid = id;
        this.map = this.mapObj.getMapData(this.mapid)
        this.engine.camera.map = this.map;

        this.engine.camera.worldWidth =
            this.map.cols * this.map.tsize;

        this.engine.camera.worldHeight =
            this.map.rows * this.map.tsize;
        this.engine.debug.level_editor.multiselect.selection_rect = null;
        this.engine.debug.level_editor.selected_window.visible = false;
        this.engine.debug.level_editor.layer_subwindow.visible = false;
        this.engine.debug.level_editor.info_subwindow.visible = false;

    };

    handlePortal(mapid, outx, outy) {
        this.engine.renderer.applyEffect("fadeOutIn", {"ms": 600, "blackTime": 100});
        setTimeout(() => {
            if(this.mapid != mapid) this.worldMove(mapid);
            this.x = this.map.getX(outx) + this.map.tsize / 2;
            this.y = this.map.getY(outy) + this.map.tsize / 2;
        }, 300)
    }

    move(delta, dirx, diry, speed=250) {
        if(this.block_movement) return;
        if (dirx !== 0 && diry !== 0) {
            const len = Math.sqrt(dirx * dirx + diry * diry);
            dirx /= len;
            diry /= len;
        }
        if(this.force != null) {
            speed += this.force*100;
            this.force = null;
        }
        this.x += dirx * speed * delta;
        this._collide(dirx, 0);
        this.y += diry * speed * delta;
        this._collide(0, diry);
        if (this.isInsideWall()) {
            this.unstuck();
        }
    
        /*var maxX = this.map.cols * this.map.tsize;
        var maxY = this.map.rows * this.map.tsize;
        this.x = Math.max(0, Math.min(this.x, maxX));
        this.y = Math.max(0, Math.min(this.y, maxY));*/
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

    render() {
        const img = this.anims.getAnimation("idle").getFrame();
        this.engine.ctx.drawImage(
            img,
            Math.round(this.screenX - this.width / 2),
            Math.round(this.screenY - this.height / 2)
        );
        
    }

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
    };

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
    };

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
    };

    onEnter(sprite) {
        switch (this.type) {
            case "portal": {
                sprite.handlePortal(this.data.mapid, this.data.outx, this.data.outy)
                break;
            }
        }
    };

    onExit(sprite) {
    };

    onStay(sprite) {
    };
}

export class Dialogue {
    constructor(data, name) {
        this.data = data; this.lines = data.length;
        this.name = name;
        this.current_line = -1;
        this.block_progress = false;
    }

    progress(engine, owner) { 
        if(this.block_progress) return;
        if(this.current_line == this.lines) {
            this.current_line = 0;
            engine.other_state_data.closeDialogueWindow(engine);
            return;
        }
        this.current_line += 1; 
        const l = this.getLine();
        if(!l) return;
        if(!l.extra) return;
        const data = l.extra.data;
        switch(l.extra.type) {
            case "scenario": {
                engine.combat.enterCombat(engine.data.scenarios.find(s => s.id == data.id));
                this.block_progress = true;
                return;
            }
            case "anim": {
                owner.active_anim = data.name;
                return;
            }
            default: return;
        }
    }

    getLine() { return this.data[this.current_line]; }
}

export class NPC {
    constructor(data, x, y, z) {
        this.x = x; this.y = y; this.data = data;
        this.sprite = null;
        this.name = data.name; this.dialogues = data.dialogue;
        this.zindex = z; this.anims = null;
        this.tsize = null;

        this.active_anim = "idle"

        this.flags = {
            "speak_counter": 0
        }

        this.draw_dialogue = false;
        this.active_dialogue = `interact${this.flags.speak_counter}`;

        // format dialogues
        let temp = [];
        Object.keys(this.dialogues).forEach(d => temp.push(new Dialogue(this.dialogues[d], d)));
        this.dialogues = temp;
    }

    getWorldPos(engine) {
        return {
            "x": (this.x*engine.hero.map.tsize) - engine.camera.x,
            "y": (this.y*engine.hero.map.tsize) - engine.camera.y,
            "tsize": engine.hero.map.tsize
        }
    }

    render(engine) {
        if(this.sprite == null) {
            this.sprite = engine.loader.getImage(this.data.sprite);
            this.anims = new AnimationManager(this.sprite);
            this.data.animations.forEach(a => this.anims.createAnimation(a));
        }
        const wp = this.getWorldPos(engine);
        const f = this.anims.getAnimation(this.active_anim);
        engine.ctx.drawImage(
            f.getFrame(),
            wp.x,
            wp.y
        )
    }

    openDialogueWindow(engine) {
        engine.other_state = "dialogue";
        engine.other_state_data = this;
        this.draw_dialogue = true;
        engine.hero.block_movement = true;
    }

    dialogueExists(name) {
        return this.dialogues.find(d => d.name == name) != undefined;
    }

    closeDialogueWindow(engine) {
        engine.other_state = null;
        engine.other_state_data = null;
        this.draw_dialogue = false;
        if(engine.renderer.effects.length != 0) {
            setTimeout(() => {engine.hero.block_movement = false}, 1000)
        } else {
            engine.hero.block_movement = false
        }
        this.flags.speak_counter += 1;
        let nname = `interact${this.flags.speak_counter}`;
        if(this.dialogueExists(nname)) this.active_dialogue = nname;
    }

    onClick(engine) {
        this.getDialogue().progress(engine, this);
        this.openDialogueWindow(engine);
    }

    getDialogueWindowPos(engine) {
        const wp = this.getWorldPos(engine);
        return {
            "x": wp.x-150,
            "y": wp.y-wp.tsize*2,
            "w": 400,
            "h": 100
        }
    }

    getDialogue() { return this.dialogues.find(d => d.name == this.active_dialogue); }

    drawDialogueWindow(engine) {
        const ctx = engine.ctx;
        const dialogue = this.getDialogue();
        if(!dialogue) return;

        const pos = this.getDialogueWindowPos(engine);

        const line = dialogue.getLine();
        if(!line) {
            dialogue.current_line = 0;
            this.closeDialogueWindow(engine);
            return;
        }
        
        ctx.fillStyle = "white";
        ctx.fillRect(pos.x, pos.y, pos.w, pos.h)
        ctx.lineWidth = 2;
        ctx.strokeStyle = "black";
        ctx.strokeRect(pos.x, pos.y, pos.w, pos.h)

        ctx.fillStyle = "black";
        ctx.font = "21px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            line.text || "",
            pos.x-(25/2)+pos.w/2,
            pos.y+pos.h/2
        );
    }
}