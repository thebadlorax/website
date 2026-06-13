/**
 * author thebadlorax
 * created on 08-06-2026-21h-59m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

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

export class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }

    addIp(vector) { this.x += vector.x; this.y += vector.y }
    add(vector) { return new Vector2(this.x + vector.x, this.y + vector.y) }
    sAddIp(scalar) { this.x += scalar; this.y += scalar }
    sAdd(scalar) { return new Vector2(this.x + scalar, this.y + scalar) }

    subIp(vector) { this.x -= vector.x; this.y -= vector.y }
    sub(vector) { return new Vector2(this.x - vector.x, this.y - vector.y) }
    sSubIp(scalar) { this.x -= scalar; this.y -= scalar }
    sSub(scalar) { return new Vector2(this.x - scalar, this.y - scalar) }

    divIp(vector) { this.x /= vector.x; this.y /= vector.y }
    div(vector) { return new Vector2(this.x / vector.x, this.y / vector.y) }
    sDivIp(scalar) { this.x /= scalar; this.y /= scalar }
    sDiv(scalar) { return new Vector2(this.x / scalar, this.y / scalar) }

    mulIp(vector) { this.x *= vector.x; this.y *= vector.y }
    mul(vector) { return new Vector2(this.x * vector.x, this.y * vector.y) }
    sMulIp(scalar) { this.x *= scalar; this.y *= scalar }
    sMul(scalar) { return new Vector2(this.x * scalar, this.y * scalar) }

    setIp(vector) { this.x = vector.x; this.y = vector.y }
    set(vector) { return new Vector2(vector.x, vector.y) }

    normalizeIp() { this.sDivIp(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2))) }
    normalize() { return new Vector2(this.x, this.y).sDiv(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2))) }

    dist(vector) { return Math.sqrt(Math.pow(vector.x-this.x,2) + Math.pow(vector.y-this.y,2)) }

    isZero() { return (this.x < 0.0001 && this.y < 0.0001) }

    isNull() { return (this.x == null || this.y == null) }
}