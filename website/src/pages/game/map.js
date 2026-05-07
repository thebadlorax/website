/**
 * author thebadlorax
 * created on 06-05-2026-14h-39m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Trigger } from "./engine.js";

class MapData {
    data;
    meta;
    constructor(data, meta) { 
        this.data = data; this.meta = meta;
        this.triggers = [];
        (data.triggers || []).forEach(t => {
            this.triggers.push(new Trigger(
                t.x, t.y, t.w, t.h, t.type, t.data || {}, t.visual || null
            ));
        })
        this.objects = data.objects || [];
    };

    getTile(layer, col, row) { 
        if (col < 0 || col >= this.data.cols || row < 0 || row >= this.data.rows) { return 0; } 
        return this.data.layers[layer][row * this.data.cols + col]; 
    };

    setTile(layer, col, row, val) {
        if (col < 0 || col >= this.data.cols || row < 0 || row >= this.data.rows) { return 0; } 
        this.data.layers[layer][row * this.data.cols + col] = val; 
    }

    screenToGrid(x, y) {
        return [Math.floor(x / this.data.tsize), Math.floor(y / this.data.tsize)]
    }

    isSolidTileAtXY(x, y) {
        var col = Math.floor(x / this.data.tsize);
        var row = Math.floor(y / this.data.tsize);/*

        return this.data.layers.reduce(function (res, layer, index) {
            var tile = this.getTile(index, col, row);
            var isSolid = this.meta.blocking_tiles.includes(tile);
            return res || isSolid;
        }.bind(this), false);*/
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

    importMapData(data) {
        this.meta = data.meta;
        this.maps = {};
        this.data = data;

        Object.keys(data)
            .filter(k => k !== "meta")
            .forEach(t => {
                this.maps[t] = new MapData(data[t], this.meta);
            });
    }

    getMapData(x, y) {
        if(this.maps[`${x};${y}`] != undefined) return this.maps[`${x};${y}`];
        else return null;
    }

    setMapData(x, y, val) {
        this.maps[`${x};${y}`] = new MapData(val, this.meta);
    }
}