const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

/**
 * author thebadlorax
 * created on 08-06-2026-21h-59m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

export class Shape2D {
    constructor(pos) {
        this.pos = pos;
    }

    collides(other) { throw new Error("faulty collision impl on a Shape2D object") } // handle collision with any other Shape2D
}

export class Rect2D extends Shape2D {
    constructor(pos, w, h) {
        super(pos); this.w = w; this.h = h;
    }

    collides(other) {
        if(other instanceof Rect2D) { return Maths.rectRect(this.pos.x, this.pos.y, this.w, this.h, other.pos.x, other.pos.y, other.w, other.h) }
        else if(other instanceof Circle2D) { return Maths.circleRect(other.pos.x, other.pos.y, other.r, this.pos.x, this.pos.y, this.w, this.h) }
        else { throw new Error("no impl found for a Rect2D -> Shape2D collision") }
    }
}

export class Circle2D extends Shape2D {
    constructor(pos, r) {
        super(pos); this.r = r;
    }

    collides(other) {
        if(other instanceof Rect2D) { return Maths.circleRect(this.pos.x, this.pos.y, this.r, other.pos.x, other.pos.y, other.w, other.h) }
        else if(other instanceof Circle2D) { return Maths.circleCircle(other.pos.x, other.pos.y, other.r, this.pos.x, this.pos.y, this.r) }
        else { throw new Error("no impl found for a Circle2D -> Shape2D collision") }
    }
}

export class Maths {
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

    static SAT(x1, y1, x2, y2, verts1, verts2) {
        const getAxes = (verts) => {
            const axes = new Array();
            for(let i = 0; i < verts.length; i++) {
                const p1 = verts[i];
                const p2 = verts[(i+1) % verts.length];
                const edge =   { x: p2.x - p1.x, y: p2.y - p1.y};
                const normal = { x: -edge.y, y: edge.x};
                const len = Math.hypot(normal.x, normal.y);
                axes.push({ x: normal.x / len, y: normal.y / len});
            }
            return axes;
        }
        const project = (verts, axis) => {
            let min = Infinity, max = -Infinity;
            verts.forEach(v => {
                const dot = v.x * axis.x + v.y * axis.y;
                if(dot < min) min = dot;
                if(dot > max) max = dot;
            });
            return { min, max };
        }

        const axes = [...getAxes(verts1), ...getAxes(verts2)];
        let minOverlap = Infinity;
        let collisionAxis = null;

        for(let axis of axes) {
            const proj1 = project(verts1, axis);
            const proj2 = project(verts2, axis);

            const overlap = Math.min(proj1.max, proj2.max) - Math.max(proj1.min, proj2.min);
            if(overlap <= 0) return null;

            if(overlap < minOverlap) { minOverlap = overlap; collisionAxis = axis; }
            
            const dir = { x: x2 - x1, y: y2 - y1};
            if(dir.x * collisionAxis.x + dir.y * collisionAxis.y < 0) {
                collisionAxis = {x: -collisionAxis.x, y: -collisionAxis.y};
            }

            let contactPoint = { x: 0, y: 0};
            let bestDist = Infinity;
            const allVerts = [...verts1, ...verts2];
            allVerts.forEach(v => {
                const d = Math.hypot(v.x - (x1 + x2)/2, v.y - (y1 + y2)/2);
                if(d < bestDist) {
                    bestDist = d;
                    contactPoint = v;
                }
            });

            return { axis: collisionAxis, overlap: minOverlap, point: contactPoint };
        }
    }
}

export class Vector {
    static two(x=null, y=null) { return new Vector2(x, y) }
    static three(x=null, y=null, z=null) { return new Vector3(x, y, z) }
    static four(x=null, y=null, z=null, w=null) { return new Vector4(x, y, z, w) }
    static dot(vector1, vector2) {
        if(vector1.constructor !== vector2.constructor) throw new Error("cannot compute dot product of 2 different types of vectors");
        if(vector1 instanceof Vector2) return vector1.x * vector2.x + vector1.y * vector2.y;
        if(vector1 instanceof Vector3) return vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z;
        if(vector1 instanceof Vector4) return vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z + vector1.w * vector2.w;
    }
    constructor() { throw new Error("what the fuck are you doing") }
}

export class Vector2 {
    constructor(x=null, y=null) { this.x = x; this.y = y; }

    addIp(vector)  { this.x += vector.x; this.y += vector.y; return this; }
    add(vector)    { return new Vector2(this.x + vector.x, this.y + vector.y) }
    sAddIp(scalar) { this.x += scalar; this.y += scalar; return this; }
    sAdd(scalar)   { return new Vector2(this.x + scalar, this.y + scalar) }
    xyAddIp(x, y)  { this.x += x; this.y += y; return this; }
    xyAdd(x, y)    { return new Vector2(this.x + x, this.y + y) }

    subIp(vector)  { this.x -= vector.x; this.y -= vector.y; return this; }
    sub(vector)    { return new Vector2(this.x - vector.x, this.y - vector.y) }
    sSubIp(scalar) { this.x -= scalar; this.y -= scalar; return this; }
    sSub(scalar)   { return new Vector2(this.x - scalar, this.y - scalar) }
    xySubIp(x, y)  { this.x -= x; this.y -= y; return this; }
    xySub(x, y)    { return new Vector2(this.x - x, this.y - y) }

    divIp(vector)  { this.x /= vector.x; this.y /= vector.y; return this; }
    div(vector)    { return new Vector2(this.x / vector.x, this.y / vector.y) }
    sDivIp(scalar) { this.x /= scalar; this.y /= scalar; return this; }
    sDiv(scalar)   { return new Vector2(this.x / scalar, this.y / scalar) }
    xyDivIp(x, y)  { this.x /= x; this.y /= y; return this; }
    xyDiv(x, y)    { return new Vector2(this.x / x, this.y / y) }

    mulIp(vector)  { this.x *= vector.x; this.y *= vector.y; return this; }
    mul(vector)    { return new Vector2(this.x * vector.x, this.y * vector.y) }
    sMulIp(scalar) { this.x *= scalar; this.y *= scalar; return this; }
    sMul(scalar)   { return new Vector2(this.x * scalar, this.y * scalar) }
    xyMulIp(x, y)  { this.x *= x; this.y *= y; return this; }
    xyMul(x, y)    { return new Vector2(this.x * x, this.y * y) }

    setIp(vector)  { this.x = vector.x; this.y = vector.y; return this; }
    set(vector)    { return new Vector2(vector.x, vector.y) }
    xySetIp(x, y)  { this.x = x; this.y = y; return this; }

    normalizeIp()  { this.sDivIp(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2))); return this; }
    normalize()    { return new Vector2(this.x, this.y).sDiv(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2))) }

    invertIp()     { this.x *= -1; this.y *= -1; return this; }
    invert()       { return new Vector2(this.x * -1, this.y * -1) }

    floorIp()      { this.x = Math.floor(this.x); this.y = Math.floor(this.y); return this; }
    floor()        { return new Vector2(Math.floor(this.x), Math.floor(this.y)) }

    isZero()       { return (this.x < 0.0001 && this.y < 0.0001) }
    isNull()       { return (this.x == null || this.y == null) }

    copy()         { return new Vector2(this.x, this.y); }

    dist(vector)   { return Math.sqrt(Math.pow(vector.x-this.x,2) + Math.pow(vector.y-this.y,2)) }

    toString()     { return `Vector2(${this.x}, ${this.y})` }
}
export class Vector3 {
    constructor(x=null, y=null, z=null) { this.x = x; this.y = y; this.z = z; }

    addIp(vector)      { this.x += vector.x; this.y += vector.y; this.z += vector.z; return this; }
    add(vector)        { return new Vector3(this.x + vector.x, this.y + vector.y, this.z + vector.z) }
    sAddIp(scalar)     { this.x += scalar; this.y += scalar;  this.z += scalar; return this; }
    sAdd(scalar)       { return new Vector3(this.x + scalar, this.y + scalar, this.z + scalar) }
    xyzAddIp(x, y, z)  { this.x += x; this.y += y; this.z += z; return this; }
    xyzAdd(x, y, z)    { return new Vector3(this.x + x, this.y + y, this.z + z) }

    subIp(vector)      { this.x -= vector.x; this.y -= vector.y; this.z -= vector.z; return this; }
    sub(vector)        { return new Vector3(this.x - vector.x, this.y - vector.y, this.z - vector.z) }
    sSubIp(scalar)     { this.x -= scalar; this.y -= scalar; this.z -= scalar; return this; }
    sSub(scalar)       { return new Vector3(this.x - scalar, this.y - scalar, this.z - scalar) }
    xyzSubIp(x, y, z)  { this.x -= x; this.y -= y; this.z -= z; return this; }
    xyzSub(x, y, z)    { return new Vector3(this.x - x, this.y - y, this.z - z) }

    divIp(vector)      { this.x /= vector.x; this.y /= vector.y; this.z /= vector.z; return this; }
    div(vector)        { return new Vector3(this.x / vector.x, this.y / vector.y, this.z / vector.z) }
    sDivIp(scalar)     { this.x /= scalar; this.y /= scalar; this.z /= scalar; return this; }
    sDiv(scalar)       { return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar) }
    xyzDivIp(x, y, z)  { this.x /= x; this.y /= y; this.z /= z; return this; }
    xyzDiv(x, y, z)    { return new Vector3(this.x / x, this.y / y, this.z / z) }

    mulIp(vector)      { this.x *= vector.x; this.y *= vector.y; this.z *= vector.z; return this; }
    mul(vector)        { return new Vector3(this.x * vector.x, this.y * vector.y, this.z * vector.z) }
    sMulIp(scalar)     { this.x *= scalar; this.y *= scalar; this.z *= scalar; return this; }
    sMul(scalar)       { return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar) }
    xyzMulIp(x, y, z)  { this.x *= x; this.y *= y; this.z *= z; return this; }
    xyzMul(x, y, z)    { return new Vector3(this.x * x, this.y * y, this.z * z) }

    setIp(vector)      { this.x = vector.x; this.y = vector.y; this.z = vector.z; return this; }
    set(vector)        { return new Vector3(vector.x, vector.y, vector.z) }
    xyzSetIp(x, y, z)  { this.x = x; this.y = y; this.z = z; return this; }

    normalizeIp()      { this.sDivIp(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2))); return this; }
    normalize()        { return new Vector3(this.x, this.y, this.z).sDiv(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2))) }

    invertIp()         { this.x *= -1; this.y *= -1; this.z *= -1; return this; }
    invert()           { return new Vector3(this.x * -1, this.y * -1, this.z * -1) }

    floorIp()          { this.x = Math.floor(this.x); this.y = Math.floor(this.y); this.z = Math.floor(this.z); return this; }
    floor()            { return new Vector3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)) }

    isZero()           { return (this.x < 0.0001 && this.y < 0.0001 && this.z < 0.0001) }
    isNull()           { return (this.x == null || this.y == null || this.z == null) }

    copy()             { return new Vector3(this.x, this.y, this.z); }

    dist(vector)       { return Math.sqrt(Math.pow(vector.x-this.x,2) + Math.pow(vector.y-this.y,2) + Math.pow(vector.z-this.z,2)) }

    toString()         { return `Vector3(${this.x}, ${this.y}, ${this.z})` }
}
export class Vector4 {
    constructor(x=null, y=null, z=null, w=null) { this.x = x; this.y = y; this.z = z; this.w = w; }

    addIp(vector)          { this.x += vector.x; this.y += vector.y; this.z += vector.z; this.w += vector.w; return this; }
    add(vector)            { return new Vector4(this.x + vector.x, this.y + vector.y, this.z + vector.z, this.w += vector.w) }
    sAddIp(scalar)         { this.x += scalar; this.y += scalar;  this.z += scalar; this.w += scalar; return this; }
    sAdd(scalar)           { return new Vector4(this.x + scalar, this.y + scalar, this.z + scalar, this.w + scalar) }
    xyzwAddIp(x, y, z, w)  { this.x += x; this.y += y; this.z += z; this.w += w; return this; }
    xyzwAdd(x, y, z, w)    { return new Vector4(this.x + x, this.y + y, this.z + z, this.w + w) }

    subIp(vector)          { this.x -= vector.x; this.y -= vector.y; this.z -= vector.z; this.w -= vector.w; return this; }
    sub(vector)            { return new Vector4(this.x - vector.x, this.y - vector.y, this.z - vector.z, this.w - vector.w) }
    sSubIp(scalar)         { this.x -= scalar; this.y -= scalar; this.z -= scalar; this.w -= scalar; return this; }
    sSub(scalar)           { return new Vector4(this.x - scalar, this.y - scalar, this.z - scalar, this.w - scalar) }
    xyzwSubIp(x, y, z, w)  { this.x -= x; this.y -= y; this.z -= z; this.w -= w; return this; }
    xyzwSub(x, y, z, w)    { return new Vector4(this.x - x, this.y - y, this.z - z, this.w - w) }

    divIp(vector)          { this.x /= vector.x; this.y /= vector.y; this.z /= vector.z; this.w /= vector.w; return this; }
    div(vector)            { return new Vector4(this.x / vector.x, this.y / vector.y, this.z / vector.z, this.w / vector.w) }
    sDivIp(scalar)         { this.x /= scalar; this.y /= scalar; this.z /= scalar; this.w /= scalar; return this; }
    sDiv(scalar)           { return new Vector4(this.x / scalar, this.y / scalar, this.z / scalar, this.w / scalar) }
    xyzwDivIp(x, y, z, w)  { this.x /= x; this.y /= y; this.z /= z; this.w /= w; return this; }
    xyzwDiv(x, y, z, w)    { return new Vector4(this.x / x, this.y / y, this.z / z, this.w / w) }

    mulIp(vector)          { this.x *= vector.x; this.y *= vector.y; this.z *= vector.z; this.w *= vector.w; return this; }
    mul(vector)            { return new Vector4(this.x * vector.x, this.y * vector.y, this.z * vector.z, this.w * vector.w) }
    sMulIp(scalar)         { this.x *= scalar; this.y *= scalar; this.z *= scalar; this.w *= scalar; return this; }
    sMul(scalar)           { return new Vector4(this.x * scalar, this.y * scalar, this.z * scalar, this.w * scalar) }
    xyzwMulIp(x, y, z, w)  { this.x *= x; this.y *= y; this.z *= z; this.w *= w; return this; }
    xyzwMul(x, y, z, w)    { return new Vector4(this.x * x, this.y * y, this.z * z, this.w * w) }

    setIp(vector)          { this.x = vector.x; this.y = vector.y; this.z = vector.z; this.w = vector.w; return this; }
    set(vector)            { return new Vector4(vector.x, vector.y, vector.z, vector.w) }
    xyzwSetIp(x, y, z, w)  { this.x = x; this.y = y; this.z = z; this.w = w; return this; }

    normalizeIp()          { this.sDivIp(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2) + Math.pow(this.w, 2))); return this; }
    normalize()            { return new Vector4(this.x, this.y, this.z).sDiv(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2) + Math.pow(this.w, 2))) }

    invertIp()             { this.x *= -1; this.y *= -1; this.z *= -1;  this.w *= -1; return this; }
    invert()               { return new Vector4(this.x * -1, this.y * -1, this.z * -1, this.w * -1) }

    floorIp()              { this.x = Math.floor(this.x); this.y = Math.floor(this.y); this.z = Math.floor(this.z); this.w = Math.floor(this.w); return this; }
    floor()                { return new Vector4(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z), Math.floor(this.w)) }

    isZero()               { return (this.x < 0.0001 && this.y < 0.0001 && this.z < 0.0001 && this.w < 0.0001) }
    isNull()               { return (this.x == null || this.y == null || this.z == null || this.w == null) }

    copy()                 { return new Vector4(this.x, this.y, this.z, this.w); }

    dist(vector)           { return Math.sqrt(Math.pow(vector.x-this.x,2) + Math.pow(vector.y-this.y,2) + Math.pow(vector.z-this.z,2) + Math.pow(vector.w-this.w,2)) }

    toString()             { return `Vector4(${this.x}, ${this.y}, ${this.z}, ${this.w})` }
}


export class PhysicsShape2D {
    constructor() {}

    getVertices() {}
    draw(ctx) {}
}
export class PhysicsSquare2D extends PhysicsShape2D {
    constructor(pos, size) {
        super();
        this.pos = pos;
        this.size = size;
        this.angle = 0;

        this.vel = Vector.two(0, 0);
        this.angularVel = 0;

        this.mass = this.size * this.size;
        this.invMass = 1 / this.mass;
        this.inertia = (this.mass * this.size * this.size) / 6;
        this.invInertia = 1/this.inertia;
    }

    getVertices() {
        const half = this.size / 2;
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        const localVertices = [
            Vector.two(-half, -half),
            Vector.two(half,  -half),
            Vector.two(half,  half),
            Vector.two(-half, half),
        ]
        return localVertices.map(v => Vector.two(
            this.pos.x + (v.x * cos - v.y * sin),
            this.pos.y + (v.x * sin + v.y * cos)
        ))
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = "red";
        const invHalf = -this.size / 2;
        ctx.fillRect(invHalf, invHalf, this.size, this.size);
        ctx.restore();
    }

    update(bounds, simVariables, delta) {
        if(!Number.isFinite(delta)) return;
        // bounds = vec4(x, y, w, h)
        //               x  y  z  w
        this.vel.y += simVariables.GRAVITY * delta;
        this.pos.addIp(this.vel.sMul(delta));
        this.angle += this.angularVel * delta;
        this.vel.sMulIp(1-simVariables.VEL_DAMPENING);
        this.angularVel *= 1-(simVariables.VEL_DAMPENING*2)

        const vertices = this.getVertices();
        vertices.forEach(v => {
            if(v.y >= bounds.w) {
                const overlap = v.y - bounds.w;
                this.pos.y -= overlap;

                const r = v.sub(this.pos);
                const vX = this.vel.x - this.angularVel * r.y;
                const vY = this.vel.y + this.angularVel * r.x;

                if(vY > bounds.y) {
                    const impulseY = -(1 + simVariables.RESTITUTION) * vY / (this.invMass + (r.x * r.x) * this.invInertia);
                    this.vel.y += impulseY * this.invMass;
                    this.angularVel += r.x * impulseY * this.invInertia;
                    this.vel.x *= (1 - simVariables.FRICTION);
                }
            }
            if(v.x <= bounds.x || v.x >= bounds.z) {
                const overlap = v.x <= bounds.x ? v.x : v.x - v.z;
                this.pos.x -= overlap;
                this.vel.x = -this.vel.x * simVariables.RESTITUTION;
                this.angularVel *= 0.9;
            }
        })
    }
}

export class PhysicsContext2D {
    constructor(bounds) {
        this.physicsObjects = new Array();
        this.bounds = bounds;

        this.simulationVariables = {
            GRAVITY: 1000,
            RESTITUTION: 0.5,
            FRICTION: 0.1,
            VEL_DAMPENING: 0.01
        }
    }

    addObject(object) { this.physicsObjects.push(object) }
    addObjects(...objects) { objects.forEach(o => this.addObject(o)) }

    resolveCollision(obj1, obj2, info) {
        const normal = info.axis;

        const percent = 0.4;
        const correction = Vector.two(normal.x * info.overlap * percent, normal.y * info.overlap * percent);
        obj1.pos.xySubIp(correction.x * 0.5, correction.y * 0.5);
        obj2.pos.xyAddIp(correction.x * 0.5, correction.y * 0.5);

        const r1 = Vector.two(info.point.x - obj1.pos.x, info.point.y - obj1.pos.y);
        const r2 = Vector.two(info.point.x - obj2.pos.x, info.point.y - obj2.pos.y);

        const v1 = Vector.two(obj1.vel.x - obj1.angularVel * r1.y, obj1.vel.y + obj1.angularVel * r1.x)
        const v2 = Vector.two(obj2.vel.x - obj2.angularVel * r2.y, obj2.vel.y + obj2.angularVel * r2.x)
        const relVel = Vector.two(v2.x - v1.x, v2.y - v1.y);

        const velAlongNormal = relVel.x * normal.x + relVel.y * normal.y;
        if(velAlongNormal > 0) return;

        const r1CrossN = r1.x * normal.y - r1.y * normal.x;
        const r2CrossN = r2.x * normal.y - r2.y * normal.x;

        const invMassSum = obj1.invMass + obj2.invMass + (r1CrossN * r1CrossN) * obj1.invInertia + (r2CrossN * r2CrossN) * obj2.invInertia;
        let j = -(1 + this.simulationVariables.RESTITUTION) * velAlongNormal / invMassSum;

        obj1.vel.xySubIp(j * normal.x * obj1.invMass, j * normal.y * obj1.invMass);
        obj1.angularVel -= r1CrossN * j * obj1.invInertia;

        obj2.vel.xyAddIp(j * normal.x * obj2.invMass, j * normal.y * obj2.invMass);
        obj2.angularVel += r2CrossN * j * obj2.invInertia;
    }

    step(delta) {
        this.physicsObjects.forEach(o => o.update(this.bounds, this.simulationVariables, delta));

        for(let i = 0; i < this.physicsObjects.length; i++) {
            for(let j = i + 1; j < this.physicsObjects.length; j++) {
                const a = this.physicsObjects[i]; const b = this.physicsObjects[j];
                const info = Maths.SAT(a.pos.x, a.pos.y, b.pos.x, b.pos.y, a.getVertices(), b.getVertices());
                if(info) this.resolveCollision(a, b, info);
            }
        }
    }
    draw(ctx) {
        this.physicsObjects.forEach(o => o.draw(ctx));
    }
}

const test1 = new PhysicsSquare2D(Vector.two(100, 200), 40);
const test2 = new PhysicsSquare2D(Vector.two(100, 0), 40);
const context = new PhysicsContext2D(Vector.four(0, 0, canvas.width, canvas.height));
context.addObjects(test1, test2);

//test1.vel.x = Math.floor(4-Math.random() * 10)


let _previousElapsed;
const loop = (elapsed) => {
    if(_previousElapsed === null) {
        _previousElapsed = elapsed;
        window.requestAnimationFrame(loop);
        return;
    }
    const delta = Math.min(
        (elapsed - _previousElapsed) / 1000,
        0.12
    );
    _previousElapsed = elapsed;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    context.step(delta);
    context.draw(ctx);
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);