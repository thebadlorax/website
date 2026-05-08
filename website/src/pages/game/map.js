/**
 * author thebadlorax
 * created on 06-05-2026-14h-39m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Trigger } from "./engine.js";

class MapData {
    data;
    constructor(data) { 
        this.data = data;

        this.cols = data.cols;
        this.rows = data.rows;
        this.tsize = data.tsize;

        this.triggers = [];
        (data.triggers || []).forEach(t => {
            this.triggers.push(new Trigger(
                t.x, t.y, t.w, t.h, t.type, t.data || {}, t.visual || null
            ));
        });

        this.objects = data.objects || [];
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
    }

    getTile(layer, col, row) { 
        if (col < 0 || col >= this.data.cols || row < 0 || row >= this.data.rows) { return 0; } 
        return this.data.layers[layer]["data"][row * this.data.cols + col]; 
    };

    setTile(layer, col, row, val) {
        if (col < 0 || col >= this.data.cols || row < 0 || row >= this.data.rows) { return 0; } 
        this.data.layers[layer]["data"][row * this.data.cols + col] = val; 
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
    }

    screenToGrid(x, y) {
        return [Math.floor(x / this.data.tsize), Math.floor(y / this.data.tsize)]
    }

    isSolidTileAtXY(x, y) {
        var col = Math.floor(x / this.data.tsize);
        var row = Math.floor(y / this.data.tsize);

        if(this.getTile(0, col, row) == 1) return true;
        else return false;
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
    meta;
    constructor() {};

    constructMapData() {
        let d = {};
        d.meta = this.meta;

        for(let x = 0; x < Object.keys(this.maps).length; x++) {
            let i = Object.keys(this.maps)[x];
            let m = this.maps[i]
            d[i] = {
                ...m.data,
                triggers: m.triggers.map(t => ({
                    x: t.x,
                    y: t.y,
                    w: t.w,
                    h: t.h,
                    type: t.type,
                    data: t.data,
                    visual: t.visual
                }))
            };
        }
        return d;
    }

    importMapData(data) {
        this.meta = data.meta;
        this.maps = {};
        this.data = data;

        Object.keys(data)
            .filter(k => k !== "meta")
            .forEach(t => {
                this.maps[t] = new MapData(data[t]);
            });

        this.constructMapData();
    }

    getMapData(x, y) {
        if(this.maps[`${x};${y}`] != undefined) return this.maps[`${x};${y}`];
        else return null;
    }

    setMapData(x, y, val) {
        this.maps[`${x};${y}`] = new MapData(val, this.meta);
    }
}