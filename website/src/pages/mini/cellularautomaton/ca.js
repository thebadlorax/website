/**
 * author thebadlorax
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

// ripped the sand simulation and converted it into a grid based automato

// todo:
// * add custom rule manager? (like automaton rules, maybe through user json?)

import { Vector } from "../maths.js";
import { countLetterInString } from "../mini-common.js";
import { formatSeconds } from "../../common.js";

const RULESTRINGS = {
    "AntiLife": "B0123478/S01234678",
    "InverseLife": "B0123478/S34678",
    "B01245/S01245": "B01245/S01245",
    "Wickstretcher And The Parasites": "B01356/S012345",
    "Oils": "B014/S2",
    "B017/S01": "B017/S01",
    "B026/S1": "B026/S1",
    "Invertamaze": "B028/S0124",
    "Neon Blobs": "B08/S4",
    "H-trees": "B1/S012345678",
    "Fuzz": "B1/S014567",
    "Gnarl": "B1/S1",
    "Snakeskin": "B1/S134567",
    "Solid islands grow amongst static": "B12678/S15678",
    "Replicator": "B1357/S1357",
    "Fredkin": "B1357/S02468",
    "Feux": "B1358/S0247",
    "Forrest of Ls": "B168/S236",
    "Seeds": "B2/S",
    "Live Free or Die": "B2/S0",
    "B2/S13": "B2/S13",
    "B2/S2345": "B2/S2345",
    "B2/S23456": "B2/S23456",
    "B2/S2345678": "B2/S2345678",
    "Serviettes": "B234/S",
    "B25/S4": "B25/S4",
    "Iceballs": "B25678/S5678",
    "Life without death": "B3/S012345678",
    "DotLife": "B3/S023",
    "Star Trek": "B3/S0248",
    "Flock": "B3/S12",
    "Mazectric": "B3/S1234",
    "Maze": "B3/S12345",
    "Magnezones": "B3/S123678",
    "SnowLife": "B3/S1237",
    "Corrosion of Conformity": "B3/S124",
    "EightFlock": "B3/S128",
    "LowLife": "B3/S13",
    "B3/S135": "B3/S135",
    "B3/S2": "B3/S2",
    "Conway's Life": "B3/S23",
    "B3/S2378": "B3/S2378",
    "EightLife": "B3/S238",
    "Shoots and Roots": "B3/S245678",
    "Lifeguard 2": "B3/S4567",
    "Coral": "B3/S45678",
    "3-4 Life": "B34/S34",
    "Dance": "B34/S35",
    "Bacteria": "B34/S456",
    "Never happy": "B345/S0456",
    "Blinkers": "B345/S2",
    "Assimilation": "B345/S4567",
    "Long Life": "B345/S5",
    "Spiral and polygonal growth": "B34568/S15678",
    "Gems": "B3457/S4568",
    "Gems Minor": "B34578/S456",
    "Grounded Life": "B35/S23",
    "Land Rush": "B35/S234578",
    "Eppstein": "B35/S236",
    "B356/S23": "B356/S23",
    "Bugs": "B3567/S15678",
    "Cheerios": "B35678/S34567",
    "Holstein": "B35678/S4678",
    "Diamoeba": "B35678/S5678",
    "Amoeba": "B357/S1358",
    "Pseudo Life": "B357/S238",
    "Geology": "B3578/S24678",
    "HighFlock": "B36/S12",
    "2x2": "B36/S125",
    "IronFlock": "B36/S128",
    "HighLife": "B36/S23",
    "Land Rush 2": "B36/S234578",
    "Virus": "B36/S235",
    "IronLife": "B36/S238",
    "sqrt replicator rule": "B36/S245",
    "Slow Blob": "B367/S125678",
    "DrighLife": "B367/S23",
    "2x2 2": "B3678/S1258",
    "Castles": "B3678/S135678",
    "B3678/S23": "B3678/S23",
    "Stains": "B3678/S235678",
    "Day & Night": "B3678/S34678",
    "LowDeath without Death": "B368/S012345678",
    "B368/S12578": "B368/S12578",
    "LowFlockDeath": "B368/S128",
    "Life SkyHigh": "B368/S236",
    "LowDeath": "B368/S238",
    "Morley": "B368/S245",
    "DryLife without Death": "B37/S012345678",
    "DryFlock": "B37/S12",
    "Mazectric with Mice": "B37/S1234",
    "Maze with Mice": "B37/S12345",
    "DryLife": "B37/S23",
    "Plow World": "B378/S012345678",
    "Coagulations": "B378/S235678",
    "Pedestrian Life without Death": "B38/S012345678",
    "Pedestrian Flock": "B38/S12",
    "HoneyFlock": "B38/S128",
    "Pedestrian Life": "B38/S23",
    "HoneyLife": "B38/S238",
    "Electrified Maze": "B45/S12345",
    "Oscillators Rule": "B45/S1235",
    "Walled Cities": "B45678/S2345",
    "Majority": "B45678/S5678",
    "Vote 4/5": "B4678/S35678",
    "Lifeguard 1": "B48/S234",
    "Rings n Slugs": "B56/S14568",
    "Vote": "B5678/S45678",
}; const PARSE_RULESTRING = (rulestring) => {
    rulestring = rulestring.toUpperCase();
    const sIndex = rulestring.indexOf("S");
    
    if(
        countLetterInString(rulestring, "B") != 1 ||
        countLetterInString(rulestring, "S") != 1 ||
        countLetterInString(rulestring, "/") != 1 ||
        rulestring[0] != "B" ||
        sIndex == null ||
        rulestring[sIndex-1] != "/" 
    ) {
        console.error(`invalid rulestring: syntax`)
        return null;
    }

    const born = rulestring.slice(1, sIndex-1);
    const survive = rulestring.slice(sIndex+1, rulestring.length);

    if(new Set(born).size !== born.length) {
        console.error(`invalid rulestring: duplicates`)
        return null;
    };
    if(new Set(survive).size !== survive.length) {
        console.error(`invalid rulestring: duplicates`)
        return null;
    }

    const formattedBorn = [...born].map(s => parseInt(s));
    const formattedSurvive = [...survive].map(s => parseInt(s));

    return [formattedBorn, formattedSurvive];
}; const SERIALIZE_RULESTRING = (born, survive) => {
    let bString = "";
    born.forEach(n => bString += n);

    let sString = "";
    survive.forEach(n => sString += n);

    return `B${bString}/S${sString}`;
}

class GridRenderer {
    static TEXT_SIZE = 30;
    constructor(ctx, engine) {
        this.ctx = ctx;
        this.eng = engine;
    }

    scaledToPixels(x, y, w, h) {
        const width = this.ctx.canvas.width;
        const height = this.ctx.canvas.height;

        return {
            "x": x*width,
            "y": y*height,
            "w": w*width,
            "h": h*height,
        }
    }

    pixelsToScaled(x, y) {
        const width = this.ctx.canvas.width;
        const height = this.ctx.canvas.height;

        return {
            "x": x / width,
            "y": y / height
        }
    }

    drawText(text, x, y, align="left") {
        const ctx = this.ctx;

        ctx.font = `${GridRenderer.TEXT_SIZE}px jersey20`;
        ctx.textAlign = align;
        ctx.textBaseline = "middle";
        let td = ctx.measureText(text);
        const text_pos = this.scaledToPixels(x, y, 0.1, 0.1);
        if(align == "center") {
            ctx.fillStyle = "black"
            ctx.fillRect(text_pos.x-(td.width/2), text_pos.y+(GridRenderer.TEXT_SIZE*0.3), td.width+10, GridRenderer.TEXT_SIZE+10)
        } else {
            ctx.fillStyle = "black"
            ctx.fillRect(text_pos.x, text_pos.y+(GridRenderer.TEXT_SIZE*0.3), td.width+10, GridRenderer.TEXT_SIZE+10)
        }
        
        ctx.fillStyle = "white";
        ctx.fillText(text, text_pos.x+7, text_pos.y+GridRenderer.TEXT_SIZE);
    }

    render() {
        const ctx = this.ctx;
        const eng = this.eng;

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        const cell = eng.CELLSIZE * eng.zoom;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);

        const startX = Math.floor(eng.cameraPos.x);
        const startY = Math.floor(eng.cameraPos.y);

        const endX = Math.ceil(eng.cameraPos.x + width / cell);
        const endY = Math.ceil(eng.cameraPos.y + height / cell);

        ctx.fillStyle = "#fff";

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (!eng.get(x, y)) continue;

                ctx.fillRect((x - eng.cameraPos.x) * cell, (y - eng.cameraPos.y) * cell, cell, cell);
            }
        }

        if (cell >= 10) {
            ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.15, 0.15 * eng.zoom)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (let x = startX; x <= endX; x++) {
                const px = (x - eng.cameraPos.x) * cell;
                ctx.moveTo(px, 0);
                ctx.lineTo(px, height);
            }

            for (let y = startY; y <= endY; y++) {
                const py = (y - eng.cameraPos.y) * cell;
                ctx.moveTo(0, py);
                ctx.lineTo(width, py);
            }

            ctx.stroke();
        }

        const mouseGridPos = eng.mouseToWorld();
        this.drawText(`cam: (${eng.cameraPos.x.toFixed(0)}, ${eng.cameraPos.y.toFixed(0)})`, 0, 0)
        this.drawText(`mouse: (${mouseGridPos.x}, ${mouseGridPos.y})`, 0, this.pixelsToScaled(0, GridRenderer.TEXT_SIZE+10).y)
        this.drawText(`step interval: ${formatSeconds(eng.stepInterval)}`, 0, this.pixelsToScaled(0, (GridRenderer.TEXT_SIZE+10)*2).y)

        this.drawText(`${eng.currentRulestring[0]}`, 0.5-this.pixelsToScaled(GridRenderer.TEXT_SIZE/2, 0).x, 0, "center")
        this.drawText(`${eng.currentRulestring[3] ?? "Custom"}`, 0.5-this.pixelsToScaled(GridRenderer.TEXT_SIZE/2, 0).x, this.pixelsToScaled(0, GridRenderer.TEXT_SIZE+10).y, "center")
        
    }
}

class Automaton {
    constructor(ctx) {
        this.ctx = ctx;
        this.renderer = new GridRenderer(ctx, this);

        this._previousElapsed = null;

        this.CELLSIZE = 20;
        this.gridWidth = 100;
        this.gridHeight = 100;

        this.paused = false;

        this.grid = new Set();

        this.cameraPos = Vector.two(0, 0);
        this.zoom = 1;
        this.minZoom = 0.25;
        this.maxZoom = 8;

        this.panDragging = false;
        this.panMouse = Vector.two(0, 0);

        this.mousePressed = false;
        this.mousePos = Vector.two(0, 0);

        this.accumulator = 0;
        this.stepInterval = 150;

        this.setRulestring(RULESTRINGS["Conway's Life"]);

        this._resize();
    }

    setRulestring(rulestring) {
        this.currentRulestring = [
            rulestring, ...PARSE_RULESTRING(rulestring), null
        ];

        Object.entries(RULESTRINGS).forEach((rs) => {
            if(rs[1] == rulestring) this.currentRulestring[3] = rs[0];
        })
    }

    get(x, y) {
        return this.grid.has(`${x},${y}`) ? 1 : 0;
    }
    
    set(x, y, value) {
        const key = `${x},${y}`;
    
        if (value === 1) this.grid.add(key);
        else this.grid.delete(key);
    }

    eventInit() {
        const canvas = this.ctx.canvas;

        window.addEventListener("resize", () => { this._resize() });
    
        canvas.addEventListener("contextmenu", e => { e.preventDefault() });
    
        canvas.addEventListener("mousedown", e => {
            e.preventDefault();
            if (e.button == 0) {
                this.mousePressed = true;
                this.mousePos.xySetIp(e.clientX, e.clientY);
                this.mousePlace();
            }
    
            if (e.button == 1 || e.button == 2) {
                this.panDragging = true;
                this.panMouse.xySetIp(e.clientX, e.clientY);
            }
        });
    
        window.addEventListener("mouseup", e => {
            if (e.button == 0) {
                this.mousePressed = false;
                this.lastPlacedPos = null;
            }
            if (e.button == 1 || e.button == 2) this.panDragging = false;
        });

        window.addEventListener("keydown", e => {
            switch(e.key) {
                case " ": {
                    this.paused = !this.paused; 
                    this.accumulator = 0;
                    break;
                }
                case "ArrowUp": 
                case "ArrowRight": {
                    this.stepInterval += 10; break
                }
                case "ArrowDown": 
                case "ArrowLeft": {
                    if(this.stepInterval > 10) this.stepInterval -= 10; 
                    break;
                }
                case "c": {
                    this.clear();
                    break;
                }
                case "s": {
                    if(this.paused) this.update();
                    break;
                }
                case "u": {
                    const rs = prompt("new rulestring");
                    const p = PARSE_RULESTRING(rs)

                    if(p == null) alert("invalid rulestring")
                    else this.setRulestring(rs);
                    break;
                }
                default: {
                    //console.log(e.key)
                }
            }
        });
    
        window.addEventListener("mousemove", e => {
            this.mousePos.xySetIp(e.clientX, e.clientY);

            if (this.mousePressed && !this.panDragging) this.mousePlace();
    
            if (this.panDragging) {
                const dx = e.clientX - this.panMouse.x;
                const dy = e.clientY - this.panMouse.y;
    
                this.cameraPos.xySubIp(dx / (this.CELLSIZE * this.zoom), dy / (this.CELLSIZE * this.zoom));
    
                this.panMouse.xySetIp(e.clientX, e.clientY);
            }
        });
    
        canvas.addEventListener("wheel", e => {
            e.preventDefault();
    
            const rect = canvas.getBoundingClientRect();
    
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
    
            const oldZoom = this.zoom;
    
            const worldX = this.cameraPos.x + mx / (this.CELLSIZE * oldZoom);
            const worldY = this.cameraPos.y + my / (this.CELLSIZE * oldZoom);
    
            const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    
            this.zoom = Math.max(
                this.minZoom,
                Math.min(this.maxZoom, this.zoom * factor)
            );
    
            this.cameraPos.xySetIp(worldX - mx / (this.CELLSIZE * this.zoom), worldY - my / (this.CELLSIZE * this.zoom));
        }, { passive: false });
    }
    initStartingCells() {
        // blinker
        this.set(20, 20, 1);
        this.set(21, 20, 1);
        this.set(22, 20, 1);

        // glider
        this.set(30, 20, 1);
        this.set(31, 19, 1);
        this.set(29, 18, 1);
        this.set(30, 18, 1);
        this.set(31, 18, 1);
    }
    async loadFont() {
        const jersey20 = new FontFace('Jersey20', `url("/res/Jersey20-Regular.ttf")`);
        try {
            const loadedFont = await jersey20.load();
            document.fonts.add(loadedFont);
            console.log('loaded jersey 20 into browser fonts');
        } catch (error) { console.error(`jersey 20 load failed: \n${error}`) }
    }
    async init() {
        await this.loadFont();

        this.eventInit();
        this.initStartingCells();
    
        window.requestAnimationFrame(this.tick.bind(this));
    }

    mouseToWorld() {
        const rect = this.ctx.canvas.getBoundingClientRect();
    
        const gx = Math.floor(this.cameraPos.x + (this.mousePos.x - rect.left) / (this.CELLSIZE * this.zoom));
        const gy = Math.floor(this.cameraPos.y + (this.mousePos.y - rect.top) / (this.CELLSIZE * this.zoom));

        return Vector.two(gx, gy)
    }
    mousePlace() {
        const pos = this.mouseToWorld();
    
        if (!this.lastPlacedPos) {
            this.set(Math.floor(pos.x), Math.floor(pos.y), 1);
            this.lastPlacedPos = pos;
            return;
        }
    
        const dx = pos.x - this.lastPlacedPos.x;
        const dy = pos.y - this.lastPlacedPos.y;
    
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const steps = Math.ceil(distance);
    
        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
    
            const x = Math.floor(this.lastPlacedPos.x + dx * t);
            const y = Math.floor(this.lastPlacedPos.y + dy * t);
    
            this.set(x, y, 1);
        }
    
        this.lastPlacedPos = pos;
    }

    clear() {
        this.grid.clear();
    }

    step() {
        const counts = new Map();
    
        for (const key of this.grid) {
            const [x, y] = key.split(",").map(Number);
    
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
    
                    const neighborKey = `${x + dx},${y + dy}`;
                    counts.set(neighborKey,(counts.get(neighborKey) || 0) + 1);
                }
            }
        }
    
        const next = new Set();
    
        for (const [key, count] of counts) {
            const alive = this.grid.has(key);
    
            if (this.currentRulestring[1].includes(count) || (alive && this.currentRulestring[2].includes(count))) next.add(key);
        }
    
        this.grid = next;
    }

    update() { this.step() }

    tick(elapsed) {
        if (this._previousElapsed === null) {
            this._previousElapsed = elapsed;
            this.renderer.render();
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        }
    
        const delta = Math.min(
            (elapsed - this._previousElapsed) / 1000,
            0.12
        );
    
        this._previousElapsed = elapsed;
        if(!this.paused) this.accumulator += delta * 1000;
    
        if (this.accumulator >= this.stepInterval) {
            this.update();
            this.accumulator -= this.stepInterval;
        }
    
        this.renderer.render();
        window.requestAnimationFrame(this.tick.bind(this));
    }

    _resize() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;
    }
}

const c = document.getElementById("canvas");
c.width = window.innerWidth;
c.height = window.innerHeight;
const engine = new Automaton(c.getContext("2d"));
await engine.init();