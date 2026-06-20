/**
 * author thebadlorax
 * created on 13-06-2026-12h-26m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Maths, Vector2 } from "../maths.js";
import { clamp } from "../../common.js";
import { generateRandomString, getRandomName, Loader } from "../mini-common.js";

import { createNoise2D } from "../noise.js";

// INPUT
export class Keyboard {
    _keys = {};
    _key_functions = {};
    constructor() {
        window.addEventListener('keydown', this._onKeyDown.bind(this));
        window.addEventListener('keyup', this._onKeyUp.bind(this));

        window.addEventListener("blur", () => {
            for (const key in this._keys) {
                this._keys[key] = false;
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                for (const key in this._keys) {
                    this._keys[key] = false;
                }
            }
        });

        this.waiting = false;
    };

    listenForEvents(keys) {
        keys.forEach(function (key) {
            this._keys[key] = false;
        }.bind(this));
    };

    setFunctionOnKeyPress(key, fn) {
        this._key_functions[key] = fn;
    }

    _onKeyDown(event) {
        var keyCode = event.code;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = true;
            if(this._key_functions[keyCode] != undefined) this._key_functions[keyCode]();
        }
    };

    _onKeyUp(event) {
        var keyCode = event.code;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = false;
        }

        if (keyCode === "MetaLeft" || keyCode === "MetaRight") {
            for (const key in this._keys) {
                if (key !== "MetaLeft" && key !== "MetaRight") {
                    this._keys[key] = false;
                }
            }
        }
    };

    isDown(keyCode) {
        if (!(keyCode in this._keys)) {
            throw new Error('Keycode ' + keyCode + ' is not being listened to');
        }
        return this._keys[keyCode];
    }

    waitForKeyPress() {
        const toggle = () => {
            this.waiting = false;
        }
        this.waiting = true;
        return new Promise(resolve => {
            function handler(event) {
                window.removeEventListener("keydown", handler);
                toggle();
                resolve(event);
            }
    
            window.addEventListener("keydown", handler);
        });
    }
}

// UNITS
class UnitTypes {
    static TypeData = {
        "infantry": {
            "speed": 100,
            "damage": 10,
            "recovery": 3,
            "visual": {
                "color": "red",
                "size": 20
            }
        }
    }
}
class Unit {
    constructor(type, count, x, y, uc) {
        this.group = null;
        this.type = type;
        this.count = count;
        this.pos = new Vector2(x, y);
        this.targetPos = new Vector2(null, null);
        this.controller = uc; this.selected = false;
        this.exists = true;
        this.mergeTarget = null;
        this.lockedFromMerging = false;
        this.hasMoved = true;

        this.id = generateRandomString(5);
    }

    update(delta) {
        if(!this.exists) return;
        const speed = UnitTypes.TypeData[this.type].speed * delta;
        if(!this.targetPos.isNull()) {
            if(!this.hasMoved) this.hasMoved = true;
            let bounds = this.controller.engine.camera.bounds;
            let size = this.getSize();
            this.targetPos.x = clamp(
                this.targetPos.x,
                size,
                bounds.x - size
            );
        
            this.targetPos.y = clamp(
                this.targetPos.y,
                size,
                bounds.y - size
            );
            let dir = this.targetPos.sub(this.pos).normalize().sMul(speed);
            this.pos.addIp(dir);
            this.pos.x = clamp(this.pos.x, size, bounds.x); this.pos.y = clamp(this.pos.y, size, bounds.y);

            if(this.pos.dist(this.targetPos) < 1 || (bounds.x-this.pos.x < 2 && bounds.y-this.pos.y < 2)) {
                this.targetPos.setIp(new Vector2(null, null));
                this.onReachDestination();
            }
        }
    }

    getDamage() {
        return UnitTypes.TypeData[this.type].damage * this.count;
    }

    getSize() {
        const d = UnitTypes.TypeData[this.type].visual;
        let size = d.size+(this.count*0.1);
        return size * this.controller.engine.camera.scale;
    }

    getSizeUnscaled() {
        const d = UnitTypes.TypeData[this.type].visual;
        let size = d.size+(this.count*0.1);
        return size;
    }

    render(ctx) {
        const camera = this.controller.engine.camera;
        let size = this.getSize();
        const d = UnitTypes.TypeData[this.type].visual;
        let pos = camera.worldToScreen(this.pos);

        ctx.fillStyle = d.color;
        ctx.fillRect(pos.x-(size/2), pos.y-(size/2), size, size);
        if(this.selected) {
            ctx.strokeStyle = "cyan";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
                pos.x,
                pos.y,
                size*1.05,
                0,
                Math.PI * 2
            );
            ctx.stroke();
            ctx.fillStyle = "rgba(0,255,255,0.2)";
            ctx.beginPath();
            ctx.arc(
                pos.x,
                pos.y,
                size*1.05,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }

    renderPath(ctx) {
        const camera = this.controller.engine.camera;
        let size = this.getSize();
        let tpos = camera.worldToScreen(this.targetPos);
        let pos = camera.worldToScreen(this.pos);
        if(!this.targetPos.isNull()) {
            ctx.strokeStyle = "cyan";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
                tpos.x,
                tpos.y,
                size*0.2,
                0,
                Math.PI * 2
            );
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(tpos.x, tpos.y);
            ctx.stroke();
        }
    }

    onReachDestination() {
        let size = this.getSize();
        let eligible_mergers = this.controller.getUnitsWithinDist(this.pos, size).filter(u => u.type == this.type && u != this);
        if(eligible_mergers.length > 0) {
            eligible_mergers = eligible_mergers.filter(u => u.exists);
            if(eligible_mergers.length > 0) this.controller.mergeLater(this,  eligible_mergers[0]);
        }
    }
}
class UnitController {
    constructor(engine) {
        this.units = new Array();
        this.pendingMerges = new Array();
        this.engine = engine;
    }

    init() {
        for(let x = 0; x < 20; x++) {
            let pos = new Vector2(Math.floor(Math.random() * this.engine.camera.bounds.x), Math.floor(Math.random() * this.engine.camera.bounds.y));
            let count = Math.floor(Math.random()*200);
            this.createUnit("infantry", count, pos.x, pos.y);
        }
        this.createUnit("infantry", 1, 100, 100);
        this.createUnit("infantry", 100, 200, 200);
    }

    createUnit(type, count, x, y) {
        let n = new Unit(type, count, x, y, this);
        this.units.push(n);
        return n;
    }

    render(ctx) {
        this.units.forEach(u => u.render(ctx));
        this.units.forEach(u => u.renderPath(ctx));
    }

    getUnitsInRect(x, y, w, h) {
        let units = []
        this.units.forEach(u => {
            let size = u.getSize()
            if(Maths.rectRect(u.pos.x - size/2, u.pos.y - size/2, size, size, x, y, w, h)) {
                units.push(u)
            }
        });
        return units;
    }

    getUnitsWithinDist(pos, maxDist) {
        let units = [];
        this.units.forEach(u => {
            if(pos.dist(u.pos) <= maxDist) {
                units.push(u)
            }
        });
        return units;
    }

    destroyUnit(unit) {
        if(!this.units.includes(unit)) return;
        unit.exists = false;
        if(this.engine.selected_units.includes(unit)) this.engine.selected_units.splice(this.engine.selected_units.indexOf(unit), 1);
        this.units.splice(this.units.indexOf(unit), 1);
    }

    mergeLater(a, b) {
        if (a.mergeTarget || b.mergeTarget) return;

        a.mergeTarget = b;
        this.pendingMerges.push([a, b]);
    }

    update(delta) {
        for (const u of this.units) {
            u.update(delta);
        }
    
        let merged;
    
        do {
            merged = false;
    
            outer:
            for (let i = 0; i < this.units.length; i++) {
                const a = this.units[i];
    
                for (let j = i + 1; j < this.units.length; j++) {
                    const b = this.units[j];
    
                    if (
                        a.exists &&
                        b.exists &&
                        a.type === b.type &&
                        a.pos.dist(b.pos) <= Math.max(a.getSize(), b.getSize()) &&
                        a.targetPos.isNull() && b.targetPos.isNull() &&
                        !a.lockedFromMerging && !b.lockedFromMerging &&
                        a.hasMoved && b.hasMoved
                    ) {
                        this.merge(b, a);
                        merged = true;
                        break outer;
                    }
                }
            }
        } while (merged);
    }

    merge(unit1, unit2) {
        if (!unit1.exists || !unit2.exists) return;
        if (unit1 === unit2) return;
        unit1.count += unit2.count;
        unit1.hasMoved ||= unit2.hasMoved;
        this.destroyUnit(unit2);
        this.engine.selected_units = [...new Set(
            this.engine.selected_units.filter(u => u.exists)
        )];

    }
    split(unit, count) {
        const random_spread = 2;
        let new_units = []
        if(count > unit.count || count == 1) {
            return [];
        }
        const perGroup = Math.floor(unit.count/count)
        for(let x = 0; x < Math.max(0, count-1); x++) {
            new_units.push(this.createUnit(unit.type, perGroup, unit.pos.x + -(unit.getSize()*random_spread) + (Math.random()*(unit.getSize()*random_spread)), unit.pos.y + -(unit.getSize()*random_spread) + (Math.random()*(unit.getSize()*random_spread))))
        }
        let needs_extra = (perGroup * count != unit.count)
        unit.count = needs_extra ? perGroup + 1 : perGroup;
        new_units.forEach(u => u.hasMoved = false);
        return new_units;
    }

    createFormation(units, formation) {
        if (units.length === 0) return;
    
        // center formation on average position
        let center = new Vector2(0, 0);
    
        for (const u of units) {
            center.addIp(u.pos);
        }
    
        center.sDivIp(units.length);
    
        const positions = [];
    
        switch (formation) {
            case "horizontal line": {
                const spacing = 50;
    
                const startX =
                    center.x - ((units.length - 1) * spacing) / 2;
    
                for (let i = 0; i < units.length; i++) {
                    positions.push(
                        new Vector2(
                            startX + i * spacing,
                            center.y
                        )
                    );
                }
    
                break;
            }
    
            case "vertical line": {
                const spacing = 50;
    
                const startY =
                    center.y - ((units.length - 1) * spacing) / 2;
    
                for (let i = 0; i < units.length; i++) {
                    positions.push(
                        new Vector2(
                            center.x,
                            startY + i * spacing
                        )
                    );
                }
    
                break;
            }
    
            case "circle": {
                const radius = Math.max(
                    50,
                    units.length * 8
                );
    
                for (let i = 0; i < units.length; i++) {
                    const angle =
                        (i / units.length) * Math.PI * 2;
    
                    positions.push(
                        new Vector2(
                            center.x + Math.cos(angle) * radius,
                            center.y + Math.sin(angle) * radius
                        )
                    );
                }
    
                break;
            }
        }
    
        // assign closest unit to each position
        const remaining = [...units];
    
        for (const p of positions) {
            let best = 0;
            let bestDist = Infinity;
    
            for (let i = 0; i < remaining.length; i++) {
                const d = remaining[i].pos.dist(p);
    
                if (d < bestDist) {
                    bestDist = d;
                    best = i;
                }
            }
    
            const unit = remaining.splice(best, 1)[0];
    
            unit.targetPos.setIp(p);
        }
    }
}

// GRAPHICS
class Camera {
    constructor(engine) {
        this.pos = new Vector2(0, 0);
        this.engine = engine;
        this.scale = 1;
        this.speed = 1;

        this.uiOffset = new Vector2(0, 0);

        this.bounds = new Vector2(3000, 2000)

        this.tmp = new Vector2(0, 0);
    }

    worldToScreen(worldPos) {
        const cx = this.engine.ctx.canvas.width / 2;
        const topOffset = this.engine.getTopbarHeightPx();
        const cy = (this.engine.ctx.canvas.height - topOffset) / 2 + topOffset;
    
        return this.tmp
            .setIp(worldPos)
            .subIp(this.pos)
            .sMulIp(this.scale)
            .xyAddIp(cx, cy)
            .copy();
    }

    screenToWorld(screenPos) {
        const cx = this.engine.ctx.canvas.width / 2;
        const topOffset = this.engine.getTopbarHeightPx();
        const cy = (this.engine.ctx.canvas.height - topOffset) / 2 + topOffset;

        return this.tmp
            .setIp(screenPos)
            .sub(new Vector2(cx, cy))
            .sDiv(this.scale)
            .add(this.pos)
            .copy();
    }

    zoomAt(mx, my, zoom) {
        const mouse = new Vector2(mx, my);
    
        const before = this.screenToWorld(mouse);
    
        const minScaleX = this.engine.ctx.canvas.width / this.bounds.x;
        const minScaleY = this.engine.ctx.canvas.height / this.bounds.y;
    
        this.scale = clamp(
            this.scale * zoom,
            Math.max(minScaleX, minScaleY),
            5
        );
    
        const after = this.screenToWorld(mouse);
    
        this.tmp.setIp(before);
        this.tmp.subIp(after);
        this.pos.addIp(this.tmp);
    
        const halfW = (this.engine.ctx.canvas.width / 2) / this.scale;
        const halfH = (this.engine.ctx.canvas.height / 2) / this.scale;
    
        this.pos.x = clamp(
            this.pos.x,
            halfW,
            this.bounds.x - halfW
        );
    
        this.pos.y = clamp(
            this.pos.y,
            halfH,
            this.bounds.y - halfH
        );
    }

    move(dir) {
        const halfW = (this.engine.ctx.canvas.width / 2) / this.scale;
        const halfH = (this.engine.ctx.canvas.height / 2) / this.scale;
    
        let npos = this.pos.add(dir.sMul((this.speed / this.scale)));
    
        npos.x = clamp(npos.x, halfW, this.bounds.x - halfW);
        npos.y = clamp(npos.y, halfH, this.bounds.y - halfH);
    
        this.pos.setIp(npos);
    }
};
const Terrain = {
    WATER: 0,
    LAND: 1,
    FOREST: 2,
    MOUNTAIN: 3
};
const COLORS = [
    "#3a6fff", // water
    "#66bb55", // land
    "#2c7a2c", // forest
    "#777777"  // mountain
];
class map {
    constructor(w,h,tileSize,engine) {
        this.width = w;
        this.height = h;

        this.nations = new Array();

        this.tileSize = tileSize;

        this.chunkSize = 200;
        this.pendingRebakes = [];
        this.rebakesPerFrame = 7;

        this.chunks = {};
        this.terrain_grid = new Uint8Array(w * h);
        this.owner_grid = new Int16Array(w * h);

        for(let i = 0; i < this.terrain_grid.length; i++) {
            this.terrain_grid[i] = Terrain.WATER;
        }

        for(let i = 0; i < this.owner_grid.length; i++) {
            this.owner_grid[i] = -1;
        }

        this.debugChunks = true;
        this.engine = engine;

        this.noise = createNoise2D(() => Math.random());
    }

    getChunk(cx,cy) {
        let chunk = this.chunks[`${cx},${cy}`];
        if (!chunk) return null;
        return chunk;
    }

    getNationFromID(id) {
        return this.nations[id];
    }

    claimNation() {
        let n = this.nations.filter(n => !n.has_owner)[Math.floor(Math.random()*this.nations.length)];
        n.has_owner = true;
        n.owned_by_self = true;
        return n
    }

    update(delta) {
        for (let i = 0; i < this.rebakesPerFrame; i++) {
            const job = this.pendingRebakes.shift();
            if (job) {
                this.rebakeChunk(job[0], job[1]);
                this.getChunk(job[0], job[1]).dirty = false;
            }
            
        }
    }

    generate(type) {
        for(let i = 0; i < this.terrain_grid.length; i++) this.terrain_grid[i] = Terrain.WATER;
        for(let i = 0; i < this.owner_grid.length; i++) this.owner_grid[i] = -1;
        switch(type) {
            case "island": {
                let scale = 10          // larger = smoother continents
                let octaves = 12         // detail layers
                let persistence = 0.6   // amplitude drop per octave
                let lacunarity = 2.5    // frequency increase per octave
                let seaLevel = 0.35
                let mountainLevel = 0.45

            
                const width = this.width;
                const height = this.height;
        
                let falloff_mult = 0.35 + (Math.random()*0.1)
                let lac = -.8 + (Math.random())
                let f_height = 0.4 + (Math.random()*0.05)
            
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
            
                        // normalized coords (important)
                        const nx = x / width;
                        const ny = y / height;
            
                        // --- FBM SIMPLEX NOISE ---
                        let amplitude = 1;
                        let frequency = 1;
                        let value = 0;
                        let max = 0;
            
                        for (let i = 0; i < octaves; i++) {
                            const sampleX = nx * scale * frequency;
                            const sampleY = ny * scale * frequency;
            
                            value += this.noise(sampleX, sampleY) * amplitude;
            
                            max += amplitude;
                            amplitude *= persistence;
                            frequency *= (lacunarity+lac);
                        }
            
                        value /= max;
            
                        // normalize to [0,1]
                        value = (value + 1) * 0.5;
            
                        const dx = nx - 0.5;
                        const dy = ny - 0.5;
                        const dist = Math.sqrt(dx * dx + dy * dy);
            
                        const falloff = 1 - dist; // island/continent center bias
                        value = value * (0.18) + falloff * falloff_mult;
            
                        let tile;
            
                        if (value < seaLevel) {
                            tile = Terrain.WATER;
                        } else if (value > mountainLevel) {
                            tile = Terrain.MOUNTAIN;
                        } else if (value < f_height) {
                            tile = Terrain.LAND;
                        } else {
                            tile = Terrain.FOREST;
                        }
            
                        this.terrain_grid[x + y * this.width] = tile;
                    };
                }
                break;
            }
            case "continents": {
                let scale = 10          // larger = smoother continents
                let octaves = 12         // detail layers
                let persistence = 0.6   // amplitude drop per octave
                let lacunarity = 2.5    // frequency increase per octave
                let seaLevel = 0.35
                let mountainLevel = 0.47
            
                const width = this.width;
                const height = this.height;

                let num_continents = Math.max(1, Math.floor(Math.random()*3));
                for(let c = 0; c < num_continents; c++) {
                    let offsetX = (width*.5) + Math.floor(Math.random()*(width*.9));
                    let offsetY = (height*-.5) + Math.floor(Math.random()*(height*.9));

                    let falloff_mult = 0.35 + (Math.random()*0.1)
                    let lac = -.8 + (Math.random())
                    let f_height = 0.4 + (Math.random()*0.05)
                
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                
                            // normalized coords (important)
                            const nx = x / width;
                            const ny = y / height;
                
                            // --- FBM SIMPLEX NOISE ---
                            let amplitude = 1;
                            let frequency = 1;
                            let value = 0;
                            let max = 0;
                
                            for (let i = 0; i < octaves; i++) {
                                const sampleX = nx * scale * frequency;
                                const sampleY = ny * scale * frequency;
                
                                value += this.noise(sampleX, sampleY) * amplitude;
                
                                max += amplitude;
                                amplitude *= persistence;
                                frequency *= (lacunarity+lac);
                            }
                
                            value /= max;
                
                            // normalize to [0,1]
                            value = (value + 1) * 0.5;
                
                            const dx = nx - 0.5;
                            const dy = ny - 0.5;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                
                            const falloff = 1 - dist; // island/continent center bias
                            value = value * (0.18) + falloff * falloff_mult;
                
                            let tile;
                
                            if (value < seaLevel) {
                                continue;
                            } else if (value > mountainLevel) {
                                tile = Terrain.MOUNTAIN;
                            } else if (value < f_height) {
                                tile = Terrain.LAND;
                            } else {
                                tile = Terrain.FOREST;
                            }
                
                            this.terrain_grid[(offsetX+x) + (offsetY+y) * this.width] = tile;
                        }
                    }
                }
            }
        }

        this.generateNations();

        for (const key in this.chunks) {
            this.chunks[key].dirty = true;
        }
    }

    generateNations() {
        const num_nations = 25;

        const isValidTile = (x, y) => { let t = this.getTile(x, y); if(t == undefined || t == 0) return false; else return true; }
        const findStartingLocation = () => {
            const findRandom = () => { return new Vector2(Math.random() * this.width, Math.random() * this.height).floorIp() }
            let pos = findRandom();
            do { pos = findRandom(); } while(!isValidTile(pos.x, pos.y)) 
            return pos;
        }

        const queue = [];

        for (let n = 0; n < num_nations; n++) {
            let nation = this.createNation(n, getRandomName());
            let start = findStartingLocation();

            this.setOwner(start.x, start.y, n);

            queue.push({
                pos: start,
                nation: n
            });
        }

        while (queue.length > 0) {
            const { pos, nation } = queue.shift();

            const neighbors = [
                new Vector2(pos.x + 1, pos.y),
                new Vector2(pos.x - 1, pos.y),
                new Vector2(pos.x, pos.y + 1),
                new Vector2(pos.x, pos.y - 1)
            ];

            for (const p of neighbors) {
                if (!isValidTile(p.x, p.y))
                    continue;

                if (this.getOwner(p.x, p.y) !== -1)
                    continue;

                this.setOwner(p.x, p.y, nation);

                queue.push({
                    pos: p,
                    nation
                });
            }
        }
    }

    createNation(id, name) {
        let n = new Nation(id, name);
        this.nations.push(n);
        return n;
    }

    initChunks() {
        this.generate("island");
        const cs = this.chunkSize;
    
        const chunksX = Math.ceil(this.width / cs);
        const chunksY = Math.ceil(this.height / cs);
    
        for (let cy = 0; cy < chunksY; cy++) {
            for (let cx = 0; cx < chunksX; cx++) {
                this.createChunk(cx, cy);
            }
        }
    }

    rebakeAllChunks() {
        const cs = this.chunkSize;
    
        const chunksX = Math.ceil(this.width / cs);
        const chunksY = Math.ceil(this.height / cs);
    
        for (let cy = 0; cy < chunksY; cy++) {
            for (let cx = 0; cx < chunksX; cx++) {
                this.pendingRebakes.push([cx, cy]);
            }
        }
    }

    getChunkFromWorld(x, y) {
        const cx = Math.floor(x/this.chunkSize);
        const cy = Math.floor(y/this.chunkSize);
        return new Vector2(cx, cy);
    }

    rebakeChunk(cx,cy) {
        const chunk = this.getChunk(cx, cy);
    
        const ctx = chunk.ctx;

        ctx.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height);

        const startX = cx * this.chunkSize;

        const startY = cy * this.chunkSize;

        const endX = Math.min(startX + this.chunkSize, this.width);

        const endY = Math.min(startY + this.chunkSize, this.height);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
        
                const tile = this.getTile(x, y);
        
                ctx.fillStyle = COLORS[tile];
        
                ctx.fillRect(
                    (x - startX) * this.tileSize,
                    (y - startY) * this.tileSize,
                    this.tileSize,
                    this.tileSize
                );

                const check = (owner, x, y) => {
                    let o = this.getOwner(x, y);
                    let t = this.getTile(x, y);
                    if(o != owner) return o;
                    if(t == 0) return owner;
                    return false;
                }
        
                const owner = this.getOwner(x, y);
        
                if (owner !== -1 && owner != null) {
                    const nation = this.nations[owner];

                    const px = (x - startX) * this.tileSize;
                    const py = (y - startY) * this.tileSize;

                    //if(!nation.owned_by_self) {
                    ctx.fillStyle = `rgba(${nation.color[1]}, ${nation.color[1]}, ${nation.color[2]}, ${nation.clicked ? .15 : .25})`
    
                    ctx.fillRect(
                        px,
                        py,
                        this.tileSize,
                        this.tileSize
                    );
                    //}

                    let right = check(owner, x + 1, y);
                    let left  = check(owner, x - 1, y);
                    let down  = check(owner, x, y + 1);
                    let up    = check(owner, x, y - 1);

                    ctx.strokeStyle = nation.clicked ? "rgba(0,255,255,1)" : "rgba(0,0,0,1)";
                    ctx.lineWidth = nation.clicked ? 10 : 5;

                    if(nation.owned_by_self) {
                        ctx.strokeStyle = "rgba(255, 0, 0, 1)"
                        ctx.lineWidth = 20
                    }
                    const s = this.tileSize;

                    ctx.beginPath();

                    if (left != false) {
                        ctx.moveTo(px, py);
                        ctx.lineTo(px, py + s);
                    }

                    if (right != false) {
                        ctx.moveTo(px + s, py);
                        ctx.lineTo(px + s, py + s);
                    }

                    if (up != false) {
                        ctx.moveTo(px, py);
                        ctx.lineTo(px + s, py);
                    }

                    if (down != false) {
                        ctx.moveTo(px, py + s);
                        ctx.lineTo(px + s, py + s);
                    }

                    ctx.stroke();
                }
            }
        }

        chunk.dirty = false;
    }

    createChunk(cx,cy) {
        const c = document.createElement("canvas");
        const ctx = c.getContext("2d");

        c.width = this.chunkSize * this.tileSize;
        c.height = this.chunkSize * this.tileSize;

        const chunk = {
            canvas: c,
            ctx,
            dirty: true
        };
    
        this.chunks[`${cx},${cy}`] = chunk
    
        return chunk;
    }

    getTile(x, y) {
        if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) { return Terrain.WATER }
        return this.terrain_grid[
            x + y * this.width
        ];
    }

    getOwner(x, y) {
        if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) { return null }
        return this.owner_grid[
            x + y * this.width
        ];
    }

    screenToMap(pos) {
        let m = this.engine.camera.screenToWorld(pos).sDivIp(this.tileSize).floorIp();
        return m;
    }
    
    setTile(x, y, tile) {
        if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) return;
        this.terrain_grid[x + y * this.width] = tile;
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        this.getChunk(cx, cy).dirty = true;
    }

    setOwner(x, y, id) {
        if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) return;
        this.owner_grid[x + y * this.width] = id;
    }
};

// NETWORKING
class Server {
    constructor() {}
}
class Lobby {
    constructor() {}
    getPlayers() {}
}
class Player {
    constructor() {}
}

// UI
class UIElement {
    constructor(type, pos, w, h, data, menu) {
        this.type = type; this.pos = pos; this.w = w; this.h = h; this.data = data;
        this.menu = menu;
    }

    getRenderPos() {
        const cp = this.menu.getRenderPos();
        const cw = cp.w; const ch = cp.h;
        return {
            "x": cp.x+(this.pos.x*cw),
            "y": cp.y+(this.pos.y*ch),
            "w": this.w*cw,
            "h": this.h*ch
        } 
    }
    render(ctx) {
        const rp = this.getRenderPos()

        switch(this.type) {
            case "text": {
                ctx.font = `${this.data.fontSize ?? 13}px monospace`;
                ctx.fillStyle = this.data.color ?? "black";
                ctx.fillText(this.data.text ?? "", rp.x, rp.y);
            }
            case "custom": {
                this.data.renderFn(ctx, this, rp);
            }
        }
    }
}
class Menu {
    constructor(pos, w, h, color, engine) {
        this.pos = pos; this.w = w; this.h = h;
        this.UIElements = new Array(); this.color = color;
        this.engine = engine; this.visible = false;
        this.opacity = 1; this.scalePos = true;
    }

    createUIElement(type, pos, w, h, data) {
        let n = new UIElement(type, pos, w, h, data, this);
        this.UIElements.push(n);
        return n;
    }

    getRenderPos() {
        let p = this.engine.getPos(this.pos.x, this.pos.y, this.w, this.h);
        if(!this.scalePos) {
            p.x = this.pos.x; p.y = this.pos.y;
        }
        return p
    }

    render(ctx) {
        let rp = this.getRenderPos();
        
        ctx.globalAlpha = this.opacity;
        
        ctx.fillStyle = this.color;
        ctx.fillRect(rp.x, rp.y, rp.w, rp.h);
        ctx.strokeStyle = "rgba(128, 128, 128, 1)";
        ctx.strokeRect(rp.x, rp.y, rp.w, rp.h)

        this.UIElements.forEach(ele => ele.render(ctx));
        
        ctx.globalAlpha = 1;
    }
}

// GAMEPLAY
class Nation {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.color = [Math.floor(Math.random()*255), Math.floor(Math.random()*255), Math.floor(Math.random()*255)];
        this.has_owner = false;
        this.owned_by_self = false;
        this.clicked = false;
    }
}

class Engine {
    constructor(ctx) {
        this.ctx = ctx;
        this.fps_data = new Array();
        this._previousElapsed = null;
        this.loader = new Loader();

        this.mousePressed = [false, false]
        this.mousePos = new Vector2(0, 0);
        this.lastMousePos = new Vector2(0, 0);
        this.keyboard = new Keyboard();
        this.camera = new Camera(this);

        this.map = new map(500, 250, 32, this);
        this.map.initChunks();

        this.camera.bounds = new Vector2(
            this.map.width * this.map.tileSize,
            this.map.height * this.map.tileSize
        );

        this.state = "game";

        this.ui = {
            topbarHeight: 0.05
        };

        this.menus = {
            "unit_menu": new Menu(new Vector2(0.01, 0.07), 0.12, 0.07, "rgba(188, 188, 188, 1)", this),
            "hover_menu": new Menu(new Vector2(0, 0), 0.1, 0.1, "rgba(188, 188, 188, 1)", this)
        };

        this.selection = {
            "active": false,
            "start": new Vector2(0, 0),
            "end": new Vector2(0, 0)
        }

        this.data = {
            "mode": null,
            "last_mode": null,
            "mode_data": {
                "inputted_data": ""
            }
        }

        this.selected_units = new Array();

        this.units = new UnitController(this);
        this.units.init();

        this.tmp = new Vector2(0, 0);

        this.nationID = this.map.claimNation();
    }

    getPos(x, y, w, h) {
        const cw = this.ctx.canvas.width; const ch = this.ctx.canvas.height;
        return {
            "x": x*cw,
            "y": y*ch,
            "w": w*cw,
            "h": h*ch
        }
    }
    _resize() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;
    }
    onLClick() {
        if(this.state == "editor") {
            return;
        }
        if(this.state != "game") return;
        if (this.mousePos.y < this.getTopbarHeightPx()) {
            return;
        }
        if(this.data.mode == "move") {
            this.selected_units.forEach(u => {
                u.targetPos.setIp(this.camera.screenToWorld(this.mousePos));
            })
            this.data.mode = null;
            this.data.mode_data.inputted_data = ""
            return;
        }
        if (this.data.mode == "moveformation") {
            const target = this.camera.screenToWorld(this.mousePos);
            let avg_pos = new Vector2(0, 0);
            this.selected_units.forEach(u => avg_pos.addIp(u.pos));
            avg_pos.sDivIp(this.selected_units.length);
        
            const center = avg_pos;

            this.selected_units.forEach(u => {
                const offset = u.pos.sub(center);
                u.targetPos.setIp(target.add(offset));
            });
        
            this.data.mode = null;
            this.data.mode_data.inputted_data = "";
            return;
        }
        let clicked_unit = null;
        let clicked_nation = false;
        this.units.units.forEach(u => {
            let size = u.getSize()
            const pos = this.camera.worldToScreen(u.pos);

            if (Maths.rectRect(this.mousePos.x - 5, this.mousePos.y - 5, 10, 10, pos.x - size/2, pos.y - size/2, size, size)) { 
                clicked_unit = u; 
            }
        })
        let mouse_map_loc = this.map.screenToMap(this.mousePos);
        let tile_owner = this.map.getOwner(mouse_map_loc.x, mouse_map_loc.y);
        this.map.nations.forEach(n => n.clicked = false)
        if(tile_owner != null && tile_owner != -1) {
            this.map.getNationFromID(tile_owner).clicked = true;
            clicked_nation = true;
            this.map.rebakeAllChunks();
        }
        if(!this.keyboard.isDown("ShiftLeft")) {
            this.selected_units.forEach(u => { u.selected = false })
            this.selected_units = [];
        }
        this.data.mode = null;
        this.data.mode_data.inputted_data = ""
        if(this.keyboard.isDown("ShiftLeft")) {
            this.selection.active = true;
            this.selection.start.setIp(this.camera.screenToWorld(this.mousePos));
        } else if(clicked_unit != null) {
            if(!this.selected_units.includes(clicked_unit)) this.selected_units.push(clicked_unit);
            clicked_unit.selected = true;
        }
    }
    onRClick() {}
    onLRelease() {
        if(this.state != "game") return;
        if(this.selection.active) {
            const x = Math.min(this.selection.start.x, this.selection.end.x);
            const y = Math.min(this.selection.start.y, this.selection.end.y);
        
            const w = Math.abs(this.selection.end.x - this.selection.start.x);
            const h = Math.abs(this.selection.end.y - this.selection.start.y);
        
            if(!this.keyboard.isDown("ShiftLeft")) this.selected_units = this.units.getUnitsInRect(x, y, w, h);
            else this.selected_units = this.selected_units.concat(this.units.getUnitsInRect(x, y, w, h).filter(u => !this.selected_units.includes(u)));
        
            this.selected_units.forEach(u => {
                u.selected = true;
            });
        
            this.selection.active = false;
        }
    }
    onRRelease() {}
    setupMenus() {}
    getPossibleKeybinds() {
        let names = [];
        const m = this.data.mode;
        const l = this.selected_units.length;

        names.push(["a", "select all"])
        if(l == 0) {
            names.push(["m", "regenerate map"])
        }
        if(l > 0) {
            names.push(["q", `move unit${this.selected_units.length > 1 ? "s" : ""} relative`])
            names.push(["m", `converge unit${this.selected_units.length > 1 ? "s" : ""}`])
            if(m != "split") names.push(["s", `split unit${this.selected_units.length > 1 ? "s" : ""} into groups`])
            if(m != "nearby") names.push(["n", `select nearby unit${this.selected_units.length > 1 ? "s" : ""}`])
            names.push(["l", `lock selected unit${this.selected_units.length > 1 ? "s" : ""} from merging`])
            if(m != "formation" && this.selected_units.some(u => !u.targetPos.isNull())) names.push(["c", `cancel unit${this.selected_units.length > 1 ? "s" : ""} destination`])
        }
        if(l > 1) {
            if(m != "formation") names.push(["f", "assemble formation"])
        }
        if(m == "split") {
            names.push(["s", `split units`])
            names.push(["1-0", "select number of groups"])
            names.push(["backspace", "delete last input"])
        }
        if(m == "nearby") {
            names.push(["n", `select units within distance`])
            names.push(["1-0", "select distance"])
            names.push(["backspace", "delete last input"])
        }
        if(m == "formation") {
            names.push(["f", `move to formation`])
            names.push(["h", "horizontal line formation"])
            names.push(["v", "vertical line formation"])
            names.push(["c", "circle formation"])
        }

        return names;
    }
    async init() {
        this.keyboard.listenForEvents(
            ["KeyA", "KeyM", "KeyS", "Digit1", "Digit2", "Digit3", "Digit4", 
                "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", 
                "KeyF", "KeyH", "KeyV", "KeyC", "KeyN", "Backspace", "KeyL", "KeyQ",
                "KeyC", "KeyN", "ShiftLeft"]);
        this.keyboard.setFunctionOnKeyPress("KeyA", () => {
            if(this.state != "game") return;
            this.selection.active = false;
            if(this.units.units.length != this.selected_units.length) {
                this.data.mode_data.inputted_data = ""
                this.data.mode = null;
            }

            this.selected_units = [];
            this.units.units.forEach(u => { this.selected_units.push(u); u.selected = true; });
        });

        // selected unit modes
        const switchMode = (mode) => {
            this.data.last_mode = this.data.mode;
            this.data.mode = this.data.mode == mode ? null : mode;
            if(this.data.last_mode == mode) {
                activate(mode);
            }
            this.data.mode_data.inputted_data = "";
        }
        const activate = (mode) => {
            switch(mode) {
                case "split": {
                    const groups = parseInt(this.data.mode_data.inputted_data);
                    if(!groups) return;
                    let n = []
                    this.selected_units.forEach((u, index) => { n = n.concat(this.units.split(u, groups));})
                    n.forEach(u => {u.selected = true; });
                    this.selected_units = this.selected_units.concat(n);
                    console.log(this.selected_units)
                }
                case "formation": {
                    this.units.createFormation(this.selected_units, this.data.mode_data.inputted_data)
                }
                case "nearby": {
                    const max_dist = parseInt(this.data.mode_data.inputted_data);
                    if(!max_dist) return;
                    let avg_pos = new Vector2(0, 0);
                    this.selected_units.forEach(u => avg_pos.addIp(u.pos));
                    avg_pos.sDivIp(this.selected_units.length);
                    let founds = this.units.getUnitsWithinDist(avg_pos, max_dist).filter(u => u != this.selected_units[0]);
                    founds.forEach(u => {
                        u.selected = true;
                        this.selected_units.push(u);
                    })
                }
            }
        }
        this.keyboard.setFunctionOnKeyPress("KeyM", () => {
            if(this.selected_units.length > 0) {
                switchMode("move");
            } else {
                this.map.noise = createNoise2D(() => Math.random());
                this.map.generate("island");
            }
        }); this.keyboard.setFunctionOnKeyPress("KeyL", () => {
            if(this.selected_units.length > 0) {
                this.selected_units.forEach(u => u.lockedFromMerging = !u.lockedFromMerging)
            }
        }); this.keyboard.setFunctionOnKeyPress("Backspace", () => {
            if(["nearby", "split"].includes(this.data.mode)) {
                this.data.mode_data.inputted_data = this.data.mode_data.inputted_data.slice(0, -1) ?? ""
            }
        }); this.keyboard.setFunctionOnKeyPress("KeyN", () => {
            if(this.selected_units.length > 0) {
                switchMode("nearby");
            } else if(this.state == "editor") {
                this.editor_data.selectedNation = this.map.createNation();
            }
        }); this.keyboard.setFunctionOnKeyPress("KeyS", () => {
            if(this.selected_units.length > 0) {
                switchMode("split");
            }
        }); this.keyboard.setFunctionOnKeyPress("KeyF", () => {
            if(this.selected_units.length > 1) {
                switchMode("formation");
            }
        }); this.keyboard.setFunctionOnKeyPress("KeyH", () => {
            if(this.data.mode == "formation") {
                this.data.mode_data.inputted_data = "horizontal line"
            }
        }); this.keyboard.setFunctionOnKeyPress("KeyV", () => {
            if(this.data.mode == "formation") {
                this.data.mode_data.inputted_data = "vertical line"
            }
        }); this.keyboard.setFunctionOnKeyPress("KeyQ", () => {
            if(this.selected_units.length > 0) {
                switchMode("moveformation")
            }
        }); this.keyboard.setFunctionOnKeyPress("KeyC", () => {
            if(this.data.mode == "formation") {
                this.data.mode_data.inputted_data = "circle"
            } else if(this.selected_units.length > 0) {
                this.selected_units.forEach(u => u.targetPos.setIp(new Vector2(null, null)))
            }
        }); const getNumberFunction = (code) => {
            return () => {
                switch(this.data.mode) {
                    case "split": {
                        if(this.data.mode_data.inputted_data.length < 2) {
                            this.data.mode_data.inputted_data = this.data.mode_data.inputted_data.concat(code.split("Digit")[1]);
                        }
                        break;
                    }
                    case "nearby": {
                        if(this.data.mode_data.inputted_data.length < 4) {
                            this.data.mode_data.inputted_data = this.data.mode_data.inputted_data.concat(code.split("Digit")[1]);
                        }
                        break;
                    }
                }
            }
        }; for(let x = 0; x <= 9; x++) {
            this.keyboard.setFunctionOnKeyPress(`Digit${x}`, getNumberFunction(`Digit${x}`));
        }

        window.addEventListener("resize", () => { this._resize(); })
        window.addEventListener("mousedown", (e) => { 
            this.mousePressed = [e.button == 0 ? true : this.mousePressed[0], e.button == 2 ? true : this.mousePressed[1]]; 
            if(e.button == 0 ) { this.onLClick() } else if(e.button == 2) { this.onRClick() } 
            if(event.button === 1) { event.preventDefault() }
        })
        window.addEventListener("mouseup", (e) => { 
            this.mousePressed = [e.button == 0 ? false : this.mousePressed[0], e.button == 2 ? false : this.mousePressed[1]]; 
            if(e.button == 0 ){ this.onLRelease() } else if(e.button == 2) { this.onRRelease() }
        })
        window.addEventListener("contextmenu", (e) => { e.preventDefault() })
        window.addEventListener("mousemove", (e) => { this.lastMousePos.setIp(this.mousePos); this.mousePos.x = e.clientX; this.mousePos.y = e.clientY; });
        window.addEventListener("wheel", e => { this.camera.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9); });
        window.addEventListener("auxclick", (event) => { if (event.button === 1) { event.preventDefault() }});
          
        this.menus.unit_menu.opacity = 0.7
        this.menus.unit_menu.createUIElement("custom", new Vector2(0.5, 0.5), 0, 0, {"renderFn": (ctx, e, rp) => {
            ctx.fillStyle = "black";
            ctx.font = "12px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let c = 0;
            this.selected_units.map(u => u.count).forEach(u => c += u);
            ctx.fillText(`${c} units`, rp.x, rp.y);
        }})

        this.menus.hover_menu.visible = true;
        this.menus.hover_menu.scalePos = false;
        this.menus.hover_menu.createUIElement("custom", new Vector2(0.5, 0.5), 0, 0, {"renderFn": (ctx, e, rp) => {
            switch(e.data.mode) {
                case "unit": {
                    let unit = e.data.unit;
                    ctx.fillStyle = "black";
                    ctx.font = "12px monospace";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(`${unit.count} ${unit.type} unit${unit.count > 1 ? "s" : ""}`, rp.x, rp.y);
                    ctx.fillStyle = "red"
                    ctx.font = "13px monospace";
                    ctx.fillText(`${unit.lockedFromMerging ? "LOCKED" : ""}`, rp.x, rp.y+20);
                    break;
                }
                case "nation": {
                    let nation = e.data.nation;
                    ctx.fillStyle = "black";
                    ctx.font = "12px monospace";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(`${nation.name}`, rp.x, rp.y);
                    ctx.fillStyle = "red"
                    ctx.font = "13px monospace";
                    ctx.fillText(`${nation.has_owner ? "OWNED" : ""}`, rp.x, rp.y+20);
                }
            }
        }})
    }
    update(delta) {
        if(this.state != "game") return;
        this.map.update(delta);
        this.selected_units = this.selected_units.filter(u => u.exists);
        this.selected_units = [...new Map(
            this.selected_units.map(u => [u.id, u])
        ).values()];
        document.body.style.cursor = "default"
        switch(this.data.mode) {
            case "move": document.body.style.cursor = "alias"; break;
            case "moveformation": document.body.style.cursor = "alias"; break;
        }
        if(this.selection.active) {
            this.selection.end.setIp(this.camera.screenToWorld(this.mousePos));
            document.body.style.cursor = "crosshair"
        }
        this.menus.unit_menu.visible = this.selected_units.length > 0;
        this.tmp.setIp(this.mousePos).xyAddIp(10, 10)
        this.menus.hover_menu.pos.setIp(this.tmp);
        this.menus.hover_menu.visible = false;
        this.menus.hover_menu.UIElements[0].data.unit = null;
        let mouse_map_loc = this.map.screenToMap(this.mousePos);
        let tile_owner = this.map.getOwner(mouse_map_loc.x, mouse_map_loc.y);
        if(tile_owner != null && tile_owner != -1) {
            this.menus.hover_menu.visible = true;
            this.menus.hover_menu.UIElements[0].data.mode = "nation";
            this.menus.hover_menu.UIElements[0].data.nation = this.map.getNationFromID(tile_owner);
        }
        this.units.units.forEach(u => {
            let size = u.getSize();
            let pos = this.camera.worldToScreen(u.pos);
            if(Maths.rectRect(this.mousePos.x-5, this.mousePos.y-5, 10, 10, pos.x-size/2, pos.y-size/2, size, size)) {
                this.menus.hover_menu.visible = true;
                this.menus.hover_menu.UIElements[0].data.mode = "unit";
                this.menus.hover_menu.UIElements[0].data.unit = u;
                document.body.style.cursor = "pointer"
            }
        })

        if(this.mousePressed[1]) {
            document.body.style.cursor = "move"
            let d = this.mousePos.sub(this.lastMousePos).invert();
            this.camera.move(d);
            this.lastMousePos.setIp(this.mousePos);
        } else {
            this.camera.move(new Vector2(0, 0))
        }
        
        this.units.update(delta);
    }
    getTopbarHeightPx() {
        return this.ctx.canvas.height * this.ui.topbarHeight;
    }
    renderTerrain(ctx) {
        const tl = this.camera.screenToWorld(new Vector2(0, 0));

        this.tmp.xySetIp(ctx.canvas.width, ctx.canvas.height)
        const br = this.camera.screenToWorld(this.tmp);

        const ts = this.map.tileSize;
        const cs = this.chunkSize;
        const chunkPixelSize = this.map.chunkSize * this.map.tileSize;

        let startCX = Math.floor(tl.x / chunkPixelSize);
        let startCY = Math.floor(tl.y / chunkPixelSize);
        let endCX = Math.ceil(br.x / chunkPixelSize);
        let endCY = Math.ceil(br.y / chunkPixelSize);

        if (startCX > endCX) [startCX, endCX] = [endCX, startCX];
        if (startCY > endCY) [startCY, endCY] = [endCY, startCY];

        startCX -= 1;
        startCY -= 1;
        endCX += 1;
        endCY += 1;

        const maxCX = Math.ceil(this.map.width / cs);
        const maxCY = Math.ceil(this.map.height / cs);

        ctx.imageSmoothingEnabled = false;
        for (let cy = startCY; cy <= endCY; cy++) {
            if (cy < 0 || cy >= maxCY) continue;

            for (let cx = startCX; cx <= endCX; cx++) {
                if (cx < 0 || cx >= maxCX) continue;
                const chunk = this.map.getChunk(cx, cy);
                if (!chunk) continue;
        
                if(chunk.dirty) this.map.pendingRebakes.push([cx, cy]);
        
                const worldPos = new Vector2(
                    cx * chunkPixelSize,
                    cy * chunkPixelSize
                );
        
                const screenPos = this.camera.worldToScreen(worldPos);
        
                const w = Math.ceil(chunk.canvas.width * this.camera.scale);
                const h = Math.ceil(chunk.canvas.height * this.camera.scale);
        
                ctx.drawImage(
                    chunk.canvas,
                    screenPos.x,
                    screenPos.y,
                    w,
                    h
                );
            }
        }
        ctx.imageSmoothingEnabled = true;
    }
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if(this.state != "game") return;

        this.renderTerrain(ctx);
        // units
        this.units.render(ctx);

        switch(this.data.mode) {
            case "nearby": {
                let avg_pos = new Vector2(0, 0);
                this.selected_units.forEach(u => avg_pos.addIp(u.pos));
                avg_pos.sDivIp(this.selected_units.length);
                avg_pos = this.camera.worldToScreen(avg_pos);
                ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(
                    avg_pos.x,
                    avg_pos.y,
                    (parseInt(this.data.mode_data.inputted_data) ?? 0) * this.camera.scale,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();
            }
        }
        
        // selection box
        if(this.selection.active) {
            const p1 = this.camera.worldToScreen(this.selection.start);
            const p2 = this.camera.worldToScreen(this.selection.end);

            const x = Math.min(p1.x, p2.x);
            const y = Math.min(p1.y, p2.y);

            const w = Math.abs(p2.x - p1.x);
            const h = Math.abs(p2.y - p1.y);

            ctx.fillStyle = "rgba(0,255,255,0.4)";
            ctx.fillRect(x, y, w, h);

            ctx.strokeStyle = "cyan";
            ctx.strokeRect(x, y, w, h);
        }

        // menus
        Object.values(this.menus).filter(m => m.visible).forEach(m => m.render(ctx));

        // topbar
        const topbar_pos = this.getPos(0, 0, 1, 0.05);
        const draw_topbar_seperator = (x) => {
            let rx = topbar_pos.w*x;
            ctx.strokeStyle = "rgba(128, 128, 128, 1)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(rx, topbar_pos.y)
            ctx.lineTo(rx, topbar_pos.y+topbar_pos.h);
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(188, 188, 188, 1)";
        ctx.strokeStyle = "rgba(128, 128, 128, 1)";
        ctx.lineWidth = 3;
        ctx.fillRect(topbar_pos.x, topbar_pos.y, topbar_pos.w, topbar_pos.h)
        ctx.beginPath();
        ctx.moveTo(topbar_pos.x, topbar_pos.y+topbar_pos.h);
        ctx.lineTo(topbar_pos.x+topbar_pos.w, topbar_pos.y+topbar_pos.h)
        ctx.stroke();

        // fps
        ctx.fillStyle = "black";
        ctx.font = "15px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let pos = this.getPos(0.03, 0.025, 0.1, 0.1);
        let avg = 0; for(let x = 0; x < this.fps_data.length; x++) { avg += this.fps_data[x]; }; avg /= this.fps_data.length;
        ctx.fillText(`${(1/avg).toFixed(0)} fps`, pos.x, pos.y);
        draw_topbar_seperator(0.065)

        // mode data
        if(this.data.mode_data.inputted_data.length != 0) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.font = "50px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let dpos = this.getPos(0.5, 0.5, 0, 0);
            ctx.fillText(this.data.mode_data.inputted_data, dpos.x, dpos.y);
        }

        // draw keybinds
        const binds = this.getPossibleKeybinds();
        const drawText = (text, x, y) => {
            let s = Math.max(12, this.ctx.canvas.height * 0.015)
            ctx.font = `${s}px monospace`;
            let td = ctx.measureText(text);
            ctx.fillStyle = "black"
            ctx.fillRect(x, y, td.width, s*1.5)
            ctx.fillStyle = "white";
            ctx.fillText(text, x, y+10);
        }

        ctx.fillStyle = "rgba(128,128,128,1)"
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const startX = 0.01;
        const startY = 0.90;

        const rowHeight = 0.025;
        const colWidth  = 0.2;

        const maxRows = Math.floor((1 - startY) / rowHeight);

        binds.forEach((b, i) => {
            const row = i % maxRows;
            const col = Math.floor(i / maxRows);

            const p = this.getPos(
                startX + col * colWidth,
                startY + row * rowHeight,
                0,
                0
            );

            drawText(`[${b[0]}] ${b[1]}`, p.x, p.y)
        });
    }
    renderGrid(ctx) {
        const camera = this.camera;
    
        const gridSize = 100;
    
        const canvasW = ctx.canvas.width;
        const canvasH = ctx.canvas.height;
    
        const topLeft = camera.screenToWorld(new Vector2(0, 0));
        const bottomRight = camera.screenToWorld(
            new Vector2(canvasW, canvasH)
        );
    
        const startX =
            Math.floor(topLeft.x / gridSize) * gridSize;
    
        const endX =
            Math.ceil(bottomRight.x / gridSize) * gridSize;
    
        const startY =
            Math.floor(topLeft.y / gridSize) * gridSize;
    
        const endY =
            Math.ceil(bottomRight.y / gridSize) * gridSize;
    
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
    
        for (let x = startX; x <= endX; x += gridSize) {
            const major = (x / gridSize) % 5 === 0;

            ctx.strokeStyle = major
                ? "rgba(255,255,255,0.15)"
                : "rgba(255,255,255,0.1)";

            ctx.lineWidth = major ? 2 : 1;
            const p1 = camera.worldToScreen(
                new Vector2(x, startY)
            );
    
            const p2 = camera.worldToScreen(
                new Vector2(x, endY)
            );
    
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    
        for (let y = startY; y <= endY; y += gridSize) {
            const major = (y / gridSize) % 5 === 0;

            ctx.strokeStyle = major
                ? "rgba(255,255,255,0.15)"
                : "rgba(255,255,255,0.1)";

            ctx.lineWidth = major ? 2 : 1;
            const p1 = camera.worldToScreen(
                new Vector2(startX, y)
            );
    
            const p2 = camera.worldToScreen(
                new Vector2(endX, y)
            );
    
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        for (let x = startX; x <= endX; x += gridSize) {
            for (let y = startY; y <= endY; y += gridSize) {

                const p = camera.worldToScreen(
                    new Vector2(x + 4, y + 4)
                );

                ctx.fillText(
                    `${x/gridSize},${y/gridSize}`,
                    p.x,
                    p.y
                );
            }
        }
    }
    tick(elapsed) {
        if(this._previousElapsed === null) {
            this._previousElapsed = elapsed;
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        }
    
        const d = (elapsed - this._previousElapsed) / 1000;
        const delta = /*Math.min(
            d,
            0.12
        );*/ d;
    
        this._previousElapsed = elapsed;

        if(this.fps_data.length > 5) {
            this.fps_data.shift();
        }
        this.fps_data.push(delta);
    
        this.update(delta);
        this.render();
    
        window.requestAnimationFrame(this.tick.bind(this));
    }
}

const c = document.getElementById("canvas");
c.width = window.innerWidth;
c.height = window.innerHeight;
const e = new Engine(c.getContext("2d"))
await e.init();
window.requestAnimationFrame(e.tick.bind(e));