/**
 * author thebadlorax
 * created on 06-05-2026-14h-39m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Trigger, Engine, NPC } from "./engine.js";

class MapData {
    data;
    constructor(data, engine) { 
        this.data = data;

        this.id = data.id;

        this.cols = data.cols;
        this.rows = data.rows;
        this.tsize = data.tsize;

        this.triggers = [];
        this.objects = [];
        (data.triggers || []).forEach(t => {
            this.triggers.push(new Trigger(
                t.x, t.y, t.w, t.h, t.type, t.data || {}, t.visual || null
            ));
        });

        (data.objects || []).forEach(o => {
            switch(o.type) {
                case "npc": {
                    this.objects.push(new NPC(o.data, engine, o.x, o.y, o.z || 1))
                }
            }
        });

        
    };

    createLayer(name, visible = true, fill = 0) {
        // generate next layer id
        const id = this.data.layers.length;

        // make tile array
        const size = this.cols * this.rows;
        const tiles = new Array(size).fill(fill);

        const layer = {
            id,
            visible,
            name,
            data: tiles
        };

        this.data.layers.push(layer);

        return layer;
    };

    getTile(layer, col, row) { 
        if (col < 0 || col >= this.data.cols || row < 0 || row >= this.data.rows) { return 0; } 
        return this.data.layers[layer]["data"][row * this.data.cols + col]; 
    };

    setTile(layer, col, row, val) {
        if (col < 0 || col >= this.data.cols || row < 0 || row >= this.data.rows) { return 0; } 
        this.data.layers[layer]["data"][row * this.data.cols + col] = val; 
    };

    getTriggersOnTile(row, col) {
        let l = [];
        this.triggers.forEach(t => { 
            let x = t.x; let y = t.y;
            if(t.visual != null) {
                if(t.visual.offset != null) {
                    x = t.x + t.visual.offset.x;
                    y = t.y + t.visual.offset.y;
                }
            }
            if(Engine.rectanglesIntersect(x, y, t.w, t.h, row, col, 1, 1)) l.push(t); 
        })
        return l;
    };

    getObjects() {
        return this.objects;
    }

    createTrigger(x, y, w, h, type, data = {}, visual = null) {
        const trigger = new Trigger(x, y, w, h, type, data, visual);
    
        this.triggers.push(trigger);
    
        if (!this.data.triggers) {
            this.data.triggers = [];
        }
    
        this.data.triggers.push({
            x, y, w, h, type, data, visual
        });
    };

    screenToGrid(x, y) {
        return [Math.floor(x / this.data.tsize), Math.floor(y / this.data.tsize)]
    };

    isSolidTileAtXY(x, y) {
        var col = Math.floor(x / this.data.tsize);
        var row = Math.floor(y / this.data.tsize);

        if(this.getTile(0, col, row) == 1) return true;
        else {
            if(this.getObjects().filter(o => o instanceof NPC).find(o => o.x == col && o.y == row) != undefined) return true;
            return false;
        }
    };

    getCol(x) {
        return Math.floor(x / this.data.tsize);
    };

    getRow(y) {
        return Math.floor(y / this.data.tsize);
    };

    getX(col) {
        return col * this.data.tsize;
    };

    getY(row) {
        return row * this.data.tsize;
    };
}

export class Map {
    data;
    maps = {};
    constructor(engine) {
        this.engine = engine;
    };

    constructMapData() {
        let d = {};
        let a = [];

        for(let x = 0; x < Object.keys(this.maps).length; x++) {
            let i = Object.keys(this.maps)[x];
            let m = this.maps[i];
            a.push(m.data);
        }

        d.maps = a;
        return d;
    }

    importMapData(data) {
        this.maps = {};
        this.data = data;

        data.maps.forEach(m => {
            this.maps[m.id] = new MapData(m, this.engine)
        })

        this.constructMapData();
    }

    getMapData(id) {
        if(this.maps[`${id}`] != undefined) return this.maps[`${id}`];
        else return null;
    }

    setMapData(id, val) {
        this.maps[`${id}`] = new MapData(val, this.meta);
    }

    createMapData(id, cols = 25, rows = 24, tsize = 64) {
        const size = cols * rows;

        const makeLayer = (layerId, name, visible = true, fill = 0) => ({
            id: layerId,
            visible,
            name,
            data: new Array(size).fill(fill)
        });

        const map = {
            id,
            cols,
            rows,
            tsize,

            layers: [
                makeLayer(0, "collisions", false, 0),
                makeLayer(1, "background", true, 1),
                makeLayer(2, "foreground", true, 0)
            ],

            triggers: [],
            objects: []
        };

        this.maps[id] = new MapData(map, this.engine);

        return this.maps[id];
    }
}