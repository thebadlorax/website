/**
 * author thebadlorax
 * created on 06-05-2026-14h-39m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

class MapData {
    data;
    meta;
    constructor(data, meta) { this.data = data; this.meta = meta; };

    getTile(layer, col, row) {
        if (col < 0 || col >= this.data.cols || row < 0 || row >= this.data.rows) {
            return 0; // treat as empty
        }
        return this.data.layers[layer][row * this.data.cols + col];
    };

    isSolidTileAtXY(x, y) {
        var col = Math.floor(x / this.data.tsize);
        var row = Math.floor(y / this.data.tsize);

        // tiles 3 and 5 are solid -- the rest are walkable
        // loop through all layers and return TRUE if any tile is solid
        return this.data.layers.reduce(function (res, layer, index) {
            var tile = this.getTile(index, col, row);
            var isSolid = this.meta.blocking_tiles.includes(tile);
            return res || isSolid;
        }.bind(this), false);
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

        Object.keys(data)
            .filter(k => k !== "meta")
            .forEach(t => {
                this.maps[t] = new MapData(data[t], this.meta);
            });
    }

    getMapData(x, y) {
        if(this.maps[`${x}${y}`] != undefined) return this.maps[`${x}${y}`];
        else return null;
    }
}