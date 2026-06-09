/**
 * author thebadlorax
 * created on 08-06-2026-11h-02m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height); 
    }

    drawParticles(particles) {
        particles.forEach(p => {
            this.ctx.fillStyle = `rgba(128, 128, 128, 1)`;
            this.ctx.beginPath();
            this.ctx.arc(
                p.x,
                p.y,
                p.r,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            /*
            this.ctx.strokeStyle = "white";
            this.ctx.lineWidth = .5;
            this.ctx.beginPath();
            this.ctx.arc(
                p.x,
                p.y,
                p.r,
                0,
                Math.PI * 2
            );
            this.ctx.stroke();*/
        })
        
    }

    drawFPS(avg) {
        this.ctx.fillStyle = "grey";
        this.ctx.font = "20px monospace";
        this.ctx.fillText(`${avg.toFixed(0)} fps`, 25, 35)
    }
}

class Maths {
    static rectRect(x1, y1, w1, h1, x2, y2, w2, h2) {
        if (x1 + w1 <= x2 || x2 + w2 <= x1) return false;
        if (y1 + h1 <= y2 || y2 + h2 <= y1) return false;
        return true;
    };
    
    static rectRectOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
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
    };

    static circleCircle(x1, y1, r1, x2, y2, r2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        const distance = Math.hypot(dx, dy);
        
        // true if circs overlap, touch, or one inside the other
        return distance <= r1 + r2;
    };

    static circleCircleIntersectionPoints(x1, y1, r1, x2, y2, r2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const d = Math.hypot(dx, dy);
    
        // too far apart, one inside the other, or identical
        if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) {
            return []; 
        }
    
        const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    
        // midpoint of the chord connecting the intersection points
        const mx = x1 + a * (dx / d);
        const my = y1 + a * (dy / d);

        return [
            { x: mx + h * (dy / d), y: my - h * (dx / d) },
            { x: mx - h * (dy / d), y: my + h * (dx / d) }
        ];
    };
    
    static circleRect(x1, y1, r, x2, y2, w, h) {
        const closestX = Math.max(x2, Math.min(x1, x2 + w));
        const closestY = Math.max(y2, Math.min(y1, y2 + h));
    
        const distanceX = x1 - closestX;
        const distanceY = y1 - closestY;
    
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        return distanceSquared <= (r * r);
    }
}

class Particle {
    constructor(x, y) {
        this.x = x; this.y = y;

        this.velx = 0; this.vely = 0;
        this.accx = 0; this.accy = 0;

        this.color = "red"; this.r = 10;
    }

    update(delta, bounds) {
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

        if (this.x - this.r < bounds.x) {
            this.x = bounds.x + this.r;
            this.velx *= -BOUNCINESS;
        } if (this.x + this.r > bounds.x + bounds.w) {
            this.x = bounds.x + bounds.w - this.r;
            this.velx *= -BOUNCINESS;
        } if (this.y - this.r < bounds.y) {
            this.y = bounds.y + this.r;
            this.vely *= -BOUNCINESS;
        } if (this.y + this.r > bounds.y + bounds.h) {
            this.y = bounds.y + bounds.h - this.r;
            this.vely *= -BOUNCINESS;
        };

        this.accx = 0;
        this.accy = 0;
    }

    particleCollision(other) {
        if (other === this) return;
    
        const dx = other.x - this.x;
        const dy = other.y - this.y;

        const minDist = this.r + other.r;
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
    
        const restitution = 0.1; // bounciness
    
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
        this.renderer = new Renderer(ctx);
        this._previousElapsed = null;

        this.fps_data = [];

        this.mousePressed = false;
        this.rightMousePressed = false;
        this.mousePos = [0, 0];

        this.bounds_offset = [0, 0];
        this.bounds_target = [0, 0];
        this.pullPos = [0, 0]
        this.bound_offset_decay = .95
    }

    getBounds() {
        return {
            x: 10+this.bounds_offset[0],
            y: 10+this.bounds_offset[1],
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
        this.renderer.drawParticles(this.particles)
    }

    drawBounds() {
        const ctx = this.renderer.ctx;
        const bounds = this.getBounds();
        ctx.strokeStyle = "lime";
        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }

    render() {
        this.renderer.clear();
        this.drawBounds();
        this.drawParticles();
        let avg = 0;
        this.fps_data.forEach(f => {
            avg += f;
        });
        avg /= this.fps_data.length
        this.renderer.drawFPS(1/avg);
    }

    physicsStep(delta) {
        const bounds = this.getBounds();

        this.particles.forEach(p => {
            p.update(delta, bounds);
        });
    
        const grid = this.buildGrid();
    
        for (let iteration = 0; iteration < 4; iteration++) {
            this.solveCollisions(grid);
        }
    }

    buildGrid() {
        const CELL_SIZE = 20; // r * 2
        const grid = new Map();
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
        
            const gx = Math.floor(p.x / CELL_SIZE);
            const gy = Math.floor(p.y / CELL_SIZE);
        
            const key = `${gx},${gy}`;
        
            if (!grid.has(key))
                grid.set(key, []);
        
            grid.get(key).push(i);
        }

        return grid;
    }

    solveCollisions(grid) {
        const CELL_SIZE = 20; // r * 2
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
        
            const gx = Math.floor(p.x / CELL_SIZE);
            const gy = Math.floor(p.y / CELL_SIZE);
        
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
        
                    const bucket = grid.get(
                        `${gx + ox},${gy + oy}`
                    );
        
                    if (!bucket) continue;
        
                    for (const j of bucket) {
                        if (j <= i) continue;
        
                        p.particleCollision(this.particles[j]);
                    }
                }
            }
        }
    }

    updateParticles(delta) {
        const SUBSTEPS = 6;
        const dt = delta / SUBSTEPS;

        for(let x = 0; x < SUBSTEPS; x++) {
            this.physicsStep(dt);
        }
    }

    update(delta) {
        const smoothness = 12; 
        this.bounds_offset[0] +=
            (this.bounds_target[0] - this.bounds_offset[0]) *
            smoothness * delta;

        this.bounds_offset[1] +=
            (this.bounds_target[1] - this.bounds_offset[1]) *
            smoothness * delta;

        this.bounds_target[0] *= 0.95;
        this.bounds_target[1] *= 0.95;
        if(this.mousePressed) {
            for(let x = 0; x < 3; x++) {
                this.createParticle(this.mousePos[0]+(Math.random()*20), this.mousePos[1]+(Math.random()*20))
            }
        }
        if (this.rightMousePressed) {
            const pullRadius = 300;
            const pullStrength = 3000;
        
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
        this.updateParticles(delta);
    }

    tick(elapsed) {
        if(this._previousElapsed === null) {
            this._previousElapsed = elapsed;
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        }
    
        const delta = Math.min(
            (elapsed - this._previousElapsed) / 1000,
            0.12
        );
    
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
            if(e.button === 0) this.mousePressed = true;
            if(e.button === 2) this.rightMousePressed = true;
        })
        this.renderer.ctx.canvas.addEventListener("mouseup", (e) => {
            if(e.button === 0) this.mousePressed = false;
            if(e.button === 2) this.rightMousePressed = false;
        })
        this.renderer.ctx.canvas.addEventListener("mousemove", (e) => {
            this.mousePos = [e.clientX, e.clientY]
        })
        window.addEventListener("resize", () => {
            this._resize();
        })
        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        })

        window.addEventListener('windowmove', (event) => {
            const amp = 1;
            this.bounds_target[0] = event.detail.deltaX * amp;
            this.bounds_target[1] = event.detail.deltaY * amp;
        });
    }
}

(function() {
    // Store initial browser coordinates
    let lastX = window.screenX !== undefined ? window.screenX : window.screenLeft;
    let lastY = window.screenY !== undefined ? window.screenY : window.screenTop;

    function checkWindowPosition() {
        // Fetch current positions across multiple browsers
        const currentX = window.screenX !== undefined ? window.screenX : window.screenLeft;
        const currentY = window.screenY !== undefined ? window.screenY : window.screenTop;

        // Fire custom event if coordinates changed
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

            // Update tracked state
            lastX = currentX;
            lastY = currentY;
        }

        // Re-poll on the next repaint cycle
        requestAnimationFrame(checkWindowPosition);
    }

    // Initialize tracking loop
    requestAnimationFrame(checkWindowPosition);
})();

const c = document.getElementById("canvas");
c.width = window.innerWidth;
c.height = window.innerHeight;
const e = new Engine(c.getContext("2d"))
e.init();

window.requestAnimationFrame(e.tick.bind(e));