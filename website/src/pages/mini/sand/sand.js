/**
 * author thebadlorax
 * created on 12-06-2026-20h-10m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

class Engine {
    constructor(ctx) {
        this.ctx = ctx;
        this._previousElapsed = null;
        this.CELLSIZE = 4;

        this.gridWidth = Math.floor(window.innerWidth / this.CELLSIZE);
        this.gridHeight = Math.floor(window.innerHeight / this.CELLSIZE);

        const size = this.gridWidth*this.gridHeight;

        this.grid = new Uint8Array(size);
        this.velocity = new Float32Array(size);
        this.progress = new Float32Array(size);

        this.mousePressed = false;
        this.mousePos = [0, 0];

        this.flip = false;
    }

    index(x, y) {
        return y * this.gridWidth + x;
    }

    get(x, y) {
        if (
            x < 0 || x >= this.gridWidth ||
            y < 0 || y >= this.gridHeight
        ) return 1; // treat outside as solid

        return this.grid[this.index(x, y)];
    }

    set(x, y, value) {
        if (
            x < 0 || x >= this.gridWidth ||
            y < 0 || y >= this.gridHeight
        ) return;
    
        this.grid[this.index(x, y)] = value;
    }

    init() {
        window.addEventListener("resize", () => {
            this._resize();
        });

        window.addEventListener("mousedown", e => {
            this.mousePressed = true;
        });
        
        window.addEventListener("mouseup", e => {
            this.mousePressed = false;
        });

        window.addEventListener("mousemove", e => {
            this.mousePos = [e.clientX, e.clientY];
        })
    }

    updateCell(x, y, delta) {
        if (this.get(x, y) !== 1) return;
    
        const i = this.index(x, y);
    
        // gravity
        this.velocity[i] += 80 * delta;
    
        // accumulate fractional falling
        this.progress[i] += this.velocity[i] * delta;
    
        let cellsToMove = Math.floor(this.progress[i]);
    
        if (cellsToMove > 8) cellsToMove = 8;
    
        let moved = 0;
    
        for (let d = 1; d <= cellsToMove; d++) {
            if (this.get(x, y + d) !== 0) break;
            moved = d;
        }
    
        if (moved > 0) {
            const v = this.velocity[i];
            const p = this.progress[i] - moved;
    
            this.set(x, y, 0);
            this.set(x, y + moved, 1);
    
            const ni = this.index(x, y + moved);
    
            this.velocity[ni] = v;
            this.progress[ni] = p;
    
            this.velocity[i] = 0;
            this.progress[i] = 0;
    
            return;
        }
    
        const leftOpen = this.get(x - 1, y + 1) === 0;
        const rightOpen = this.get(x + 1, y + 1) === 0;
    
        if (leftOpen || rightOpen) {
            const dir =
                leftOpen && rightOpen
                    ? (Math.random() < 0.5 ? -1 : 1)
                    : leftOpen ? -1 : 1;
    
            const v = this.velocity[i];
            const p = this.progress[i];
    
            this.set(x, y, 0);
            this.set(x + dir, y + 1, 1);
    
            const ni = this.index(x + dir, y + 1);
    
            this.velocity[ni] = v * 0.98;
            this.progress[ni] = p;
    
            this.velocity[i] = 0;
            this.progress[i] = 0;
    
            return;
        }
    
        // resting
        this.velocity[i] = 0;
        this.progress[i] = 0;
    }

    update(delta) {
        if(this.mousePressed) {
            const gx = Math.floor(this.mousePos[0] / this.CELLSIZE);
            const gy = Math.floor(this.mousePos[1] / this.CELLSIZE);
        
            for (let y = -4; y <= 4; y++) {
                for (let x = -4; x <= 4; x++) {
                    if(Math.random() > 0.8) this.set(gx + x, gy + y, 1);
                }
            }
        };

        this.flip = !this.flip;
    
        for (let y = this.gridHeight - 2; y >= 0; y--) {
            for (let x = 0; x < this.gridWidth; x++) {
                this.updateCell(x, y, delta);
            }
        }
    }
    render() {
        const ctx = this.ctx;
    
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const c = this.get(x, y)
    
                if (this.get(x, y) == 0) continue;

                

                switch(c) {
                    case 1: {
                        ctx.fillStyle = "rgba(194, 178, 128, 1)"
                    }
                }
    
                ctx.fillRect(
                    x * this.CELLSIZE,
                    y * this.CELLSIZE,
                    this.CELLSIZE,
                    this.CELLSIZE
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
    
        const delta = /*Math.min(*/
            (elapsed - this._previousElapsed) / 1000//,
            /*0.12
        );*/
    
        this._previousElapsed = elapsed;
    
        this.update(delta);
        this.render();
    
        window.requestAnimationFrame(this.tick.bind(this));
    }

    _resize() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;
    
        this.gridWidth = Math.floor(window.innerWidth / this.CELLSIZE);
        this.gridHeight = Math.floor(window.innerHeight / this.CELLSIZE);
    
        this.grid = new Uint8Array(this.gridWidth * this.gridHeight);
        this.velocity = new Float32Array(this.gridWidth * this.gridHeight);
    }
}


const c = document.getElementById("canvas");
c.width = window.innerWidth;
c.height = window.innerHeight;
const engine = new Engine(c.getContext("2d"));
engine.init();
window.requestAnimationFrame(engine.tick.bind(engine));