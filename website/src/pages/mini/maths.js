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
}


export class Vector {
    static two(x=null, y=null) { return new Vector2(x, y) }
    static three(x=null, y=null, z=null) { return new Vector3(x, y, z) }
    static four(x=null, y=null, z=null, w=null) { return new Vector4(x, y, z, w) }
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