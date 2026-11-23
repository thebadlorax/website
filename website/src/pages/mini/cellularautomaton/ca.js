/**
 * author thebadlorax
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

// ripped the sand simulation and converted it into a grid based automato

// todo:
// * add custom rule manager? (like automaton rules, maybe through user json?)

import { Vector } from "../maths.js";
import { formatSeconds } from "../../common.js";

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

    drawText(text, x, y) {
        const ctx = this.ctx;

        ctx.font = `${GridRenderer.TEXT_SIZE}px jersey20`;
        let td = ctx.measureText(text);
        const text_pos = this.scaledToPixels(x, y, 0.1, 0.1);
        ctx.fillStyle = "black"
        ctx.fillRect(text_pos.x, text_pos.y, td.width+10, GridRenderer.TEXT_SIZE+10)
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

        if (cell >= 3) {
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

        this.drawText(`cam: (${eng.cameraPos.x.toFixed(0)}, ${eng.cameraPos.y.toFixed(0)})`, 0, 0)
        this.drawText(`mouse: (${eng.mousePos.x}, ${eng.mousePos.y})`, 0, this.pixelsToScaled(0, GridRenderer.TEXT_SIZE).y)
        this.drawText(`step interval: ${formatSeconds(eng.stepInterval)}`, 0, this.pixelsToScaled(0, GridRenderer.TEXT_SIZE*2).y)
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

        this.set(20, 20, 1);
        this.set(21, 20, 1);
        this.set(22, 20, 1);

        this._resize();
    }

    get(x, y) {
        return this.grid.has(`${x},${y}`) ? 1 : 0;
    }
    
    set(x, y, value) {
        const key = `${x},${y}`;
    
        if (value === 1) this.grid.add(key);
        else this.grid.delete(key);
    }

    async init() {
        const canvas = this.ctx.canvas;

        const jersey20 = new FontFace('Jersey20', `url("/res/Jersey20-Regular.ttf")`);
        try {
            const loadedFont = await jersey20.load();
            document.fonts.add(loadedFont);
            console.log('loaded jersey 20 into browser fonts');
        } catch (error) { console.error(`jersey 20 load failed: \n${error}`) }

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
            if (e.button == 0) this.mousePressed = false;
            if (e.button == 1 || e.button == 2) this.panDragging = false;
        });

        window.addEventListener("keydown", e => {
            switch(e.key) {
                case " ": {
                    this.paused = !this.paused; break;
                }
                case "ArrowUp": {
                    this.stepInterval += 10; break
                }
                case "ArrowDown": {
                    if(this.stepInterval > 10) this.stepInterval -= 10; 
                    break;
                }
                default: {
                    console.log(e.key)
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
    
        window.requestAnimationFrame(this.tick.bind(this));
    }

    mousePlace() {
        const rect = this.ctx.canvas.getBoundingClientRect();
    
        const gx = Math.floor(this.cameraPos.x + (this.mousePos.x - rect.left) / (this.CELLSIZE * this.zoom));
        const gy = Math.floor(this.cameraPos.y + (this.mousePos.y - rect.top) / (this.CELLSIZE * this.zoom));
    
        this.set(gx, gy, 1);
    }

    stepAutomaton() {
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
    
            if (count === 3 || (alive && count === 2)) next.add(key);
        }
    
        this.grid = next;
    }

    update() { this.stepAutomaton() }

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
            this.accumulator = 0; //-= this.stepInterval;
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