/**
 * author thebadlorax
 * created on 09-05-2026-22h-32m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { clamp } from "../common.js";
import { Engine } from "./engine.js";

export class Card {
    static fromJSON(data, loader) {
        return new Card(
            data.name,
            data.description,
            data.id,
            data.type,
            data.rarity,
            loader.getImage(data.imageid),
            data.data
        )
    };

    constructor(
        name,
        description,
        id,
        type,
        rarity,
        image,
        data
    ) {
        this.name = name; this.description = description; this.type = type;
        this.rarity = rarity; this.image = image; this.data = data; this.id = id;
    };
};

export class VisualCard {
    constructor(card, x, y) { this.card = card; this.x = x; this.y = y; this.size = 128; this.p = null; };
}

export class CardManager {
    constructor() {
        this.cards = [];
        this.deck = [];
    };

    getCardFromID(id) { return this.cards.find(c => c.id == id); };

    getDeck() {
        let d = this.deck.map(dc => this.getCardFromID(dc));
        return d;
    }

    addToDeck(...ids) { ids.forEach(id => this.deck.push(id)) };

    getAllCardsOfType(type) { return this.cards.filter(c => c.type == type); };
}

export class ProjectileManager {
    constructor(combat) {
        this.projectiles = [];
        this.combat = combat;
    }

    destroyProjectile(p) {
        if(!this.projectiles.includes(p)) return null;
        this.projectiles.splice(this.projectiles.indexOf(p), 1);
        return true;
    }

    createProjectile(x, y, data) {
        let p = Projectile.fromJSON(data, this.combat, x, y);
        this.projectiles.push(p);
        return p;
    };

    updateProjectiles(delta) {
        this.projectiles.forEach(p => {
            p.update(delta);
        })
    }

    renderProjectiles() {
        const ctx = this.combat.engine.ctx;
        this.projectiles.forEach(p => {
            if(!p.visible) return;
            p.render(ctx);
        })
    }
}

export class CombatManager {
    constructor(cm, engine) {
        this.cardManager = cm;
        this.engine = engine;
        this.projectiles = new ProjectileManager(this);

        this.in_combat = false;
        this.turn = false; // false = dodging, true = placing
        this.card_rendering = {
            "dragged_card": null,
            "dragged_alr_card": null,
            "drag_point": null,
            "dragged_card_in_box": false,
            "cards": [],
            "temporary_projectiles": []
        }
    }

    renderCardsInHand() {
        const ctx = this.engine.renderer.ctx;
        const deck = this.cardManager.getDeck();
        const card_size = 128;

        let skipped = 0;

        for(let x = 0; x < deck.length; x++) {
            const c = deck[x];
            if(this.card_rendering.cards.map(a => a.card).find(b => b == c) != undefined) {
                skipped += 1;
                continue;
            };
            let cx, cy;
            cx = 10+(card_size*(x-skipped))+((x-skipped)*10);
            cy = 10;
            let is_dragged = deck[x] == this.card_rendering.dragged_card;
            if(is_dragged) {
                ctx.fillStyle = "rgba(0, 255, 255, 0.1)"
                ctx.fillRect(cx, cy, card_size, card_size);
                ctx.strokeStyle = "rgba(0, 255, 255, 0.1)"
                ctx.strokeRect(cx, cy, card_size, card_size);
                continue;
            }

            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(
                cx, 
                cy, 
                card_size, card_size);
            ctx.drawImage(
                    c.image, 
                    cx, 
                    cy
            );

            ctx.font = "13px monospace";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                c.name,
                cx+Math.floor(card_size/2),
                cy+card_size*1.1
            )
        }
    }

    renderDraggedCard() {
        if(this.card_rendering.dragged_card == null) return;
    
        const ctx = this.engine.renderer.ctx;
        const card_size = 128;
        const c = this.card_rendering.dragged_card;
        let dcx = Math.floor(this.engine.keyboard.mouseX - this.card_rendering.drag_point[0]);
        let dcy = Math.floor(this.engine.keyboard.mouseY - this.card_rendering.drag_point[1]);
        const cbx = (this.engine.camera.width - 500) / 2;
        const cby = (this.engine.camera.height - 500) / 2;
        const cbs = 500;

        ctx.save();
        ctx.beginPath();
        ctx.rect(
            0,
            0,
            this.engine.camera.width,
            this.engine.camera.height
        );
    
        // subtract combat box
        ctx.rect(
            cbx,
            cby,
            cbs,
            cbs
        );
    
        ctx.clip("evenodd");
        ctx.drawImage(
            c.image,
            dcx,
            dcy,
            card_size,
            card_size
        );
    
        ctx.restore();

        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(
            dcx,
            dcy,
            card_size,
            card_size
        );
        ctx.font = "13px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            c.name,
            dcx + Math.floor(card_size / 2),
            dcy + card_size * 1.1
        );

        let overlap = Engine.getRectangleOverlap(dcx, dcy, card_size, card_size, cbx, cby, cbs, cbs);

        if(!overlap) { this.card_rendering.dragged_card_in_box = false; return; };

        if(overlap.w == 128 && overlap.h == 128) { this.card_rendering.dragged_card_in_box = true; }
        else { this.card_rendering.dragged_card_in_box = false; }
    }

    drawPreviewOfTurn() {
        const ctx = this.engine.ctx;
        this.projectiles.renderProjectiles();
        this.card_rendering.cards.forEach(c => {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 2;
            const box = this.getCombatBox();
            ctx.strokeRect(
                box.x + c.x,
                box.y + c.y,
                c.size,
                c.size
            );

            ctx.font = "13px monospace";
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                c.card.name,
                (box.x + c.x)+Math.floor(c.size/2),
                (box.y + c.y)+c.size*1.1
            );
        });
    }

    renderCombatBox() {
        const ctx = this.engine.ctx;
        let cb = this.getCombatBox();
        ctx.strokeStyle = "white";
        ctx.lineWidth = "3";
        ctx.strokeRect(cb.x, cb.y, cb.w, cb.h);

        this.drawPreviewOfTurn();
    }

    onRelease() {
        if(this.card_rendering.dragged_card_in_box) {
            let x = Math.floor(this.engine.keyboard.mouseX - this.card_rendering.drag_point[0]);
            let y = Math.floor(this.engine.keyboard.mouseY - this.card_rendering.drag_point[1]);
            const box = this.getCombatBox();
            let c = new VisualCard(
                this.card_rendering.dragged_card,
                x - box.x,
                y - box.y
            );
            c.p = this.card_rendering.temporary_projectiles[0];
            this.card_rendering.cards.push(c);
        } else {
            this.card_rendering.temporary_projectiles.forEach(p => this.projectiles.destroyProjectile(p));
        }
        this.card_rendering.temporary_projectiles = [];
        
        this.card_rendering.dragged_card = null;
        this.card_rendering.dragged_alr_card = null;
        this.card_rendering.drag_point = null;
        this.card_rendering.dragged_card_in_box = false;
    }

    getCombatBox() {
        return {
            x: clamp((this.engine.camera.width - 500) / 2, 286, this.engine.camera.width),
            y: (this.engine.camera.height - 500) / 2,
            w: 500,
            h: 500
        };
    }

    onClick() {
        const x = this.engine.keyboard.mouseX;
        const y = this.engine.keyboard.mouseY;

        const deck = this.cardManager.getDeck();
        const card_size = 128;

        let skipped = 0;
        const box = this.getCombatBox();

        for(let x1 = 0; x1 < deck.length; x1++) {
            const c = deck[x1]
            if(this.card_rendering.cards.map(a => a.card).find(b => b == c) != undefined) {
                skipped += 1;
                continue;
            };
            let cx, cy;
            
            cx = 10+(card_size*(x1-skipped))+((x1-skipped)*10);
            cy = 10;
            if(Engine.rectanglesIntersect(x, y, 10, 10, cx, cy, card_size, card_size)) {
                this.card_rendering.dragged_card = c;
                this.card_rendering.drag_point = [x - cx, y - cy];
                let p = this.projectiles.createProjectile(
                    x - box.x,
                    y - box.y,
                    this.card_rendering.dragged_card.data
                );
                this.card_rendering.temporary_projectiles.push(p);
            }
        }

        
        this.card_rendering.cards.forEach(c => {
            if(Engine.rectanglesIntersect(
                x, y, 10, 10,
                box.x + c.x,
                box.y + c.y,
                c.size,
                c.size
            )) {
                this.card_rendering.drag_point = [
                    (x - box.x) - c.x,
                    (y - box.y) - c.y
                ];
                this.card_rendering.dragged_alr_card = c;
            }
        })
    }

    combatUpdate(delta) {
        const cb = this.getCombatBox();
        this.projectiles.updateProjectiles(delta);
        let mouseX = this.engine.keyboard.mouseX - cb.x;
        let mouseY = this.engine.keyboard.mouseY - cb.y;
        if(this.card_rendering.dragged_card != null) {
            let dcx = Math.floor(
                mouseX -
                this.card_rendering.drag_point[0]
            );
    
            let dcy = Math.floor(
                mouseY -
                this.card_rendering.drag_point[1]
            );

            let in_box = Engine.rectanglesIntersect(dcx+cb.x, dcy+cb.y, 128, 128, 
                cb.x,
                cb.y,
                cb.w,
                cb.h
            )
    
            this.card_rendering.temporary_projectiles.forEach(p => {
                if(in_box) p.visible = true;
                p.setPosition(dcx + 64, dcy + 64)
            });
        }

        if(this.card_rendering.dragged_alr_card != null) {
            const cb = this.getCombatBox();

            let dcx = Math.floor(this.engine.keyboard.mouseX - cb.x - this.card_rendering.drag_point[0]);
            let dcy = Math.floor(this.engine.keyboard.mouseY - cb.y - this.card_rendering.drag_point[1]);

            dcx = clamp(dcx, 0, cb.w - 128);
            dcy = clamp(dcy, 0, cb.h - (128)*1.2);

            this.card_rendering.dragged_alr_card.x = dcx;
            this.card_rendering.dragged_alr_card.y = dcy;

            this.card_rendering.dragged_alr_card.p.setPosition(
                dcx + 64,
                dcy + 64
            );
        }
    }

    enterCombat() {
        this.engine.state = "combat";
        this.in_combat = true;
    }

    exitCombat() {
        this.engine.state = "main";
        this.in_combat = false;
    }
}

export class ProjectilePath {
    constructor(
        projectile,
        center,
        type,
        settings
    ) {
        this.projectile = projectile; this.type = type;
        this.center = center;
        this.settings = settings; this.data = {};
    }

    init() {
        switch(this.type) {
            case "circle": {
                this.data.angle = 0;
            }
        }
    }

    getMovement(delta) {
        switch(this.type) {
            case "circle": {
                let x = this.center.x + Math.cos(this.data.angle) * this.settings.radius;
                let y = this.center.y + Math.sin(this.data.angle) * this.settings.radius;
                this.data.angle += this.settings.speed*delta;
                return { "x": x, "y": y };
            }
        }

        return null;
    }
}

export class Projectile {
    static fromJSON(data, combat, x, y) {
        let p = new Projectile(
            x,
            y,
            data.settings,
            combat
        );
        p.init(data.settings.path)
        return p;
    }

    constructor(
        x,
        y,
        settings,
        combat
    ) {
        this.x = x; this.y = y; this.settings = settings;
        this.combat = combat; this.visible = false;
    }
    init(path) {
        this.path = new ProjectilePath(
            this,
            { x: this.x, y: this.y },
            path.type,
            path.settings
        );
        this.path.init();
    }

    setPosition(x, y) {
        this.path.center.x = x;
        this.path.center.y = y;
    }

    update(delta) {
        let movement = this.path.getMovement(delta);
        if(!movement) {
            this.x = this.path.center.x;
            this.y = this.path.center.y;
            return;
        };
        this.x = movement.x;
        this.y = movement.y;
    };

    render(ctx) {
        const cb = this.combat.getCombatBox();
    
        ctx.beginPath();
        ctx.arc(
            cb.x + this.x,
            cb.y + this.y,
            this.settings.size,
            0,
            2 * Math.PI
        );
        ctx.fillStyle = this.settings.color;
        ctx.fill();
    }
}