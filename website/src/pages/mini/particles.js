/**
 * author thebadlorax
 * created on 08-06-2026-11h-02m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Maths } from "./maths.js";

class UIElement {
    constructor(type, x, y, w, h, d, renderer) {
        this.type = type; this.x = x; this.y = y; this.w = w; this.h = h; this.data = d;
        this.renderer = renderer; this.onclick = () => {}; this.onchange = () => {};
        this.dragging = false;
    }

    getPos() {
        return {
            x: this.renderer.ctx.canvas.width  * this.x,
            y: this.renderer.ctx.canvas.height * this.y,
            w: this.renderer.ctx.canvas.width  * this.w,
            h: this.renderer.ctx.canvas.height * this.h
        };
    }

    setSliderFromMouse() {
        const mouseX = this.renderer.engine.mousePos[0];
        const mw = this.renderer.ctx.canvas.width;
    
        const x = (mw * this.x);
        const w = mw * this.w;
    
        let t = (mouseX - x) / w;
        t = Math.max(0, Math.min(1, t));
    
        let value =
            this.data.min +
            t * (this.data.max - this.data.min);
    
        value =
            Math.round(value / this.data.step) *
            this.data.step;

        if(this.data.progress != value) { 
            this.data.progress = value;
            if(this.onchange != null) this.onchange(this); 
        }
    }
}

class Renderer {
    constructor(ctx, engine) {
        this.ctx = ctx; this.engine = engine;

        this.UIElements = [];
    }

    clear() {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height); 
    }

    createUIElement(type, x, y, w, h, d) {
        let ele = new UIElement(type, x, y, w, h, d, this);
        this.UIElements.push(ele);
        return ele;
    }

    drawUI() {
        const ctx = this.ctx;
        this.UIElements.forEach(ele => {
            const pos = ele.getPos();
            switch(ele.type) {
                case "slider": {
                    const value = ele.data.progress;
                    const min = ele.data.min;
                    const max = ele.data.max;
                
                    const percent = (value - min) / (max - min);
                
                    // Track
                    ctx.fillStyle = "#888";
                    ctx.fillRect(
                        pos.x,
                        pos.y + pos.h/2 - 3,
                        pos.w,
                        6
                    );
                
                    // Thumb
                    const thumbX = pos.x + (percent * pos.w);
                
                    ctx.fillStyle = "#ddd";
                    ctx.beginPath();
                    ctx.arc(
                        thumbX,
                        pos.y + pos.h/2,
                        pos.h*0.15,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                
                    ctx.strokeStyle = "grey";
                    ctx.stroke();
    
                    ctx.font = `13px monospace`;
                    ctx.fillStyle = "black";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "grey"
                    if(ele.data.showVal) {
                        ctx.fillText(
                            ele.data.progress.toFixed(2),
                            pos.x + (pos.w*.9),
                            pos.y + (pos.h*.75)
                        );
                    }
                    if(ele.data.title != undefined) {
                        ctx.fillText(
                            ele.data.title,
                            pos.x + (pos.w*.5),
                            pos.y + (pos.h * 0.1)
                        );
                    }
                    break;
                }
            }
        })
    }

    drawParticles(particles, radius) {
        particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(
                p.x,
                p.y,
                radius,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        })
        
    }

    drawFPS(avg) {
        this.ctx.fillStyle = "grey";
        this.ctx.font = "20px monospace";
        this.ctx.fillText(`${avg.toFixed(0)} fps`, 55, 35)
    }
}

class Particle {
    constructor(x, y) {
        this.x = x; this.y = y;

        this.velx = 0; this.vely = 0;
        this.accx = 0; this.accy = 0;

        this.color = `rgba(${Math.floor(100+Math.random()*155)}, ${Math.floor(100+Math.random()*155)}, ${Math.floor(100+Math.random()*155)}, 0.5)`;
    }

    update(delta, bounds, radius) {
        const GRAVITATIONAL_CONSTANT = 500;
        const BOUNCINESS = .95;

        this.velx += this.accx * delta;
        this.vely += (this.accy + GRAVITATIONAL_CONSTANT) * delta;

        const damping = 0.98;
        const frameDamping = Math.pow(damping, delta * 60);

        this.velx *= frameDamping;
        this.vely *= frameDamping;

        if(this.velx < 0.000001 && this.velx > 0) this.velx = 0;
        if(this.vely < 0.000001 && this.vely > 0) this.vely = 0;

        this.x += this.velx * delta;
        this.y += this.vely * delta;

        if (this.x - radius < bounds.x) {
            this.x = bounds.x + radius;
            this.velx *= -BOUNCINESS;
        } if (this.x + radius > bounds.x + bounds.w) {
            this.x = bounds.x + bounds.w - radius;
            this.velx *= -BOUNCINESS;
        } if (this.y - radius < bounds.y) {
            this.y = bounds.y + radius;
            this.vely *= -BOUNCINESS;
        } if (this.y + radius > bounds.y + bounds.h) {
            this.y = bounds.y + bounds.h - radius;
            this.vely *= -BOUNCINESS;
        };

        this.accx = 0;
        this.accy = 0;
    }

    particleCollision(other, radius) {
        if (other === this) return;
    
        const dx = other.x - this.x;
        const dy = other.y - this.y;

        const minDist = radius + radius;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minDist * minDist) return;
        const dist = Math.sqrt(distSq);
    
        if (dist >= minDist || dist === 0) return;
    
        const nx = dx / dist;
        const ny = dy / dist;
    
        const overlap = minDist - dist;
    
        this.x -= nx * overlap * 0.5;
        this.y -= ny * overlap * 0.5;
    
        other.x += nx * overlap * 0.5;
        other.y += ny * overlap * 0.5;
    
        const rvx = other.velx - this.velx;
        const rvy = other.vely - this.vely;
    
        const velAlongNormal = rvx * nx + rvy * ny;
    
        if (velAlongNormal > 0) return;
    
        const restitution = 0.005; // bounciness
    
        const impulse = -(1 + restitution) * velAlongNormal / 2;
    
        const ix = impulse * nx;
        const iy = impulse * ny;
    
        this.velx -= ix;
        this.vely -= iy;
    
        other.velx += ix;
        other.vely += iy;
    }
}

class Engine {
    constructor(ctx) {
        this.particles = new Array();
        this.renderer = new Renderer(ctx, this);
        this._previousElapsed = null;

        this.fps_data = [];

        this.keys_down = [];

        this.mousePressed = false;
        this.rightMousePressed = false;
        this.mousePos = [0, 0];
        this.pullPos = [0, 0];

        this.SUBSTEPS = 6;
        this.ITERATIONS = 4;
        this.PARTICLERADIUS = 10;
        this.PULL_STRENGTH = 3000;
        this.SPAWN_RATE = 3;
        this.WINDOW_SHAKE_AMP = 3;
    }

    getBounds() {
        return {
            x: 10,
            y: 10,
            w: (this.renderer.ctx.canvas.width-15),
            h: (this.renderer.ctx.canvas.height-15)
        }
    }

    _resize() {
        const canvas = this.renderer.ctx.canvas;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    createParticle(x, y) {
        this.particles.push(new Particle(x, y));
    }

    drawParticles() {
        this.renderer.drawParticles(this.particles, this.PARTICLERADIUS)
    }

    drawBounds() {
        const ctx = this.renderer.ctx;
        const bounds = this.getBounds();
        ctx.strokeStyle = "lime";
        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }

    render() {
        this.renderer.clear();
        //this.drawBounds();
        this.drawParticles();
        let avg = 0;
        this.fps_data.forEach(f => {
            avg += f;
        });
        avg /= this.fps_data.length
        this.renderer.drawFPS(1/avg);

        const ctx = this.renderer.ctx;
        ctx.fillStyle = "grey"
        ctx.font = `15px monospace`;
        ctx.fillText(`${this.particles.length} particles`, 60, 70)

        this.renderer.drawUI();
    }

    physicsStep(delta) {
        const bounds = this.getBounds();
    
        for (const p of this.particles) {
            p.update(delta, bounds, this.PARTICLERADIUS);
        }
    
        this.buildGrid();
    
        for (let iteration = 0; iteration < this.ITERATIONS; iteration++) {
            this.solveCollisions();
        }
    }

    buildGrid() {
        const CELL_SIZE = this.PARTICLERADIUS*2;
    
        const canvas = this.renderer.ctx.canvas;
        this.GRID_W = Math.ceil(canvas.width / CELL_SIZE);
        this.GRID_H = Math.ceil(canvas.height / CELL_SIZE);
        const GRID_SIZE = this.GRID_W * this.GRID_H;
    
        this.grid = new Array(GRID_SIZE);
    
        for (let i = 0; i < GRID_SIZE; i++) {
            this.grid[i] = [];
        }
    
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
    
            const gx = (p.x / CELL_SIZE) | 0;
            const gy = (p.y / CELL_SIZE) | 0;
    
            if (gx < 0 || gy < 0 || gx >= this.GRID_W || gy >= this.GRID_H) continue;
    
            const idx = gx + gy * this.GRID_W;
    
            this.grid[idx].push(i);
        }
    }

    solveCollisions() {
        const CELL_SIZE = this.PARTICLERADIUS*2;
    
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
    
            const gx = (p.x / CELL_SIZE) | 0;
            const gy = (p.y / CELL_SIZE) | 0;
    
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
    
                    const x = gx + ox;
                    const y = gy + oy;
    
                    if (x < 0 || y < 0 || x >= this.GRID_W || y >= this.GRID_H) continue;
    
                    const idx = x + y * this.GRID_W;
                    const bucket = this.grid[idx];
    
                    for (let k = 0; k < bucket.length; k++) {
                        const j = bucket[k];
                        if (j <= i) continue;
    
                        p.particleCollision(this.particles[j], this.PARTICLERADIUS);
                    }
                }
            }
        }
    }

    updateParticles(delta) {
        const dt = delta / Math.max(1, this.SUBSTEPS);

        for(let x = 0; x < Math.max(1, this.SUBSTEPS); x++) {
            this.physicsStep(dt);
        }
    }

    update(delta) {
        if(this.mousePressed) {
            for(let x = 0; x < this.SPAWN_RATE; x++) {
                this.createParticle(this.mousePos[0]+(Math.random()*20), this.mousePos[1]+(Math.random()*20))
            }
        }
        if (this.rightMousePressed) {
            const pullRadius = 300;
            const pullStrength = this.keys_down.includes(" ") ? (this.PULL_STRENGTH*-1) : this.PULL_STRENGTH;
        
            for (const p of this.particles) {
                this.pullPos[0] += (this.mousePos[0] - this.pullPos[0]) * 0.2;
                this.pullPos[1] += (this.mousePos[1] - this.pullPos[1]) * 0.2;
                const dx = this.pullPos[0] - p.x;
                const dy = this.pullPos[1] - p.y;
        
                const distSq = dx * dx + dy * dy;
        
                if (distSq > pullRadius * pullRadius)
                    continue;
        
                const dist = Math.sqrt(distSq);
        
                if (dist === 0)
                    continue;
        
                const nx = dx / dist;
                const ny = dy / dist;
        
                const strength = (1 - dist / pullRadius) * pullStrength;
                //const strength = pullStrength / Math.max(distSq, 100);

                p.velx += nx * strength * delta;
                p.vely += ny * strength * delta;
                
                // tangential component
                //p.velx += -ny * strength * 0.3 * delta;
                //p.vely +=  nx * strength * 0.3 * delta;
            }
        }

        this.renderer.UIElements.filter(ele => ele.type == "slider" && ele.dragging).forEach(ele => {
            ele.setSliderFromMouse()
        })
        this.updateParticles(delta);
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

        if(this.fps_data.length > 5) {
            this.fps_data.pop();
        }
        this.fps_data.push(delta);
    
        this.update(delta);
        this.render();
    
        window.requestAnimationFrame(this.tick.bind(this));
    }

    init() {
        const cols = 10;
        const rows = 10;
        const spacing = 30;
        const noise = 10;
        const bounds = this.getBounds();
    
        const gridWidth = (cols - 1) * spacing;
        const gridHeight = (rows - 1) * spacing;
    
        const startX = bounds.x + (bounds.w - gridWidth) / 2;
        const startY = bounds.y + (bounds.h - gridHeight) / 2;
    
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                this.createParticle(
                    startX + x * spacing + Math.random()*noise,
                    startY + y * spacing + Math.random()*noise
                );
            }
        }

        this.renderer.ctx.canvas.addEventListener("mousedown", (e) => {
            let clicked = false;
            this.renderer.UIElements.forEach(ele => {
                const pos = ele.getPos();
                if(Maths.rectRect(this.mousePos[0]-5, this.mousePos[1]-5, 10, 10, pos.x, pos.y, pos.w, pos.h)) {
                    clicked = true;
                    if(ele.type == "slider") {
                        ele.dragging = true;
                        ele.setSliderFromMouse();
                    }
                }
            })
            if(!clicked) {
                if(e.button === 0) this.mousePressed = true;
                if(e.button === 2) this.rightMousePressed = true;
            }
        })
        window.addEventListener("mouseup", (e) => {
            this.renderer.UIElements.forEach(ele => { ele.dragging = false; });
            if(e.button === 0) this.mousePressed = false;
            if(e.button === 2) this.rightMousePressed = false;
        })
        window.addEventListener("mousemove", (e) => {
            this.mousePos = [e.clientX, e.clientY]
        })
        window.addEventListener("resize", () => {
            this._resize();
        })
        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        })
        window.addEventListener("keydown", (e) => {
            this.keys_down.push(e.key);
        })
        window.addEventListener("keyup", (e) => {
            this.keys_down.splice(this.keys_down.indexOf(e.key));
        })

        window.addEventListener('windowmove', (event) => {
            const amp = this.WINDOW_SHAKE_AMP;

            const fx = event.detail.deltaX * amp;
            const fy = event.detail.deltaY * amp;

            for (const p of this.particles) {
                p.velx += fx;
                p.vely += fy;
            }
        });

        window.addEventListener("blur", () => {
            this.mousePressed = false;
            this.rightMousePressed = false;
        }); window.addEventListener("visibilitychange", () => {
            this.mousePressed = false;
            this.rightMousePressed = false;
        });

        this.renderer.createUIElement("slider", 0.1, 0.03, 0.1, 0.1, {"step": 1, "max": 20, "min": 1, "progress": this.PARTICLERADIUS, "title": "particle size", "showVal": true}).onchange = (t) => { this.PARTICLERADIUS = t.data.progress; }
        this.renderer.createUIElement("slider", 0.1, 0.13, 0.1, 0.1, {"step": 1, "max": 20, "min": 0, "progress": this.SUBSTEPS, "title": "simulation substeps (expensive)", "showVal": true}).onchange = (t) => { this.SUBSTEPS = t.data.progress; }
        this.renderer.createUIElement("slider", 0.1, 0.23, 0.1, 0.1, {"step": 1, "max": 20, "min": 0, "progress": this.ITERATIONS, "title": "simulation iterations (expensive)", "showVal": true}).onchange = (t) => { this.ITERATIONS = t.data.progress; }
        this.renderer.createUIElement("slider", 0.25, 0.03, 0.1, 0.1, {"step": 1000, "max": 30000, "min": 1000, "progress": this.PULL_STRENGTH, "title": "right click strength", "showVal": true}).onchange = (t) => { this.PULL_STRENGTH = t.data.progress; }
        this.renderer.createUIElement("slider", 0.25, 0.13, 0.1, 0.1, {"step": 1, "max": 30, "min": 1, "progress": this.SPAWN_RATE, "title": "particle spawn rate", "showVal": true}).onchange = (t) => { this.SPAWN_RATE = t.data.progress; }
        this.renderer.createUIElement("slider", 0.25, 0.23, 0.1, 0.1, {"step": 1, "max": 10, "min": 0, "progress": this.WINDOW_SHAKE_AMP, "title": "window shake multiplier", "showVal": true}).onchange = (t) => { this.WINDOW_SHAKE_AMP = t.data.progress; }
    }
}

(function() {
    let lastX = window.screenX !== undefined ? window.screenX : window.screenLeft;
    let lastY = window.screenY !== undefined ? window.screenY : window.screenTop;

    function checkWindowPosition() {
        const currentX = window.screenX !== undefined ? window.screenX : window.screenLeft;
        const currentY = window.screenY !== undefined ? window.screenY : window.screenTop;

        if (currentX !== lastX || currentY !== lastY) {
            const moveEvent = new CustomEvent('windowmove', {
                detail: {
                    oldX: lastX,
                    oldY: lastY,
                    newX: currentX,
                    newY: currentY,
                    deltaX: currentX - lastX,
                    deltaY: currentY - lastY
                }
            });
            
            window.dispatchEvent(moveEvent);

            lastX = currentX;
            lastY = currentY;
        }

        requestAnimationFrame(checkWindowPosition);
    }

    requestAnimationFrame(checkWindowPosition);
})();

const c = document.getElementById("canvas");
c.width = window.innerWidth;
c.height = window.innerHeight;
const e = new Engine(c.getContext("2d"))
e.init();

if(window.localStorage.getItem("f") == undefined) {
    alert("left click to spawn, right click to grab (if you hold space it repulses instead), resize and drag the window around to manipulate them further")
    window.localStorage.setItem("f", true);
}

window.requestAnimationFrame(e.tick.bind(e));