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

    isTurn(turn) {
        // 0 = dodging, 1 = placing
        switch(this.type) {
            case "pattern": {
                if(turn == 1) return true
                else return false
            }
            case "pactive": {
                if(turn == 0) return true
                else return false
            }
        }
    }
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

    getHighestLifespan() {
        return this.projectiles.map(p => p.settings.lifespan).sort().at(-1);
    }
}

export class Scenario {
    constructor() {}
}

export class CombatManager {
    constructor(cm, engine) {
        this.cardManager = cm;
        this.engine = engine;
        this.projectiles = new ProjectileManager(this);

        this.in_combat = false;
        this.turn = 1; // 0 = dodging, 1 = placing
        this.round_timer = 5;
        this.second_timer = 0;
        this.combat_active = false;
        this.timescale = 1;
        this.player = new CombatPlayer(null, null, this);
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

        let hide = this.combat_active;
        if(hide) ctx.globalAlpha = 0.2;
        else ctx.globalAlpha = 1;

        for(let x = 0; x < deck.length; x++) {
            const c = deck[x];
            if(this.card_rendering.cards.map(a => a.card).find(b => b == c) != undefined) {
                skipped += 1;
                continue;
            };
            let cx, cy;
            let y_off = Math.floor((x-skipped)/2)
            cx = 10+(card_size*(x-(y_off*2)-skipped))+((x-(y_off*2)-skipped)*10);
            cy = 10+(y_off*158);
            let is_dragged = deck[x] == this.card_rendering.dragged_card;
            if(is_dragged) {
                ctx.fillStyle = "rgba(0, 255, 255, 0.1)"
                ctx.fillRect(cx, cy, card_size, card_size);
                ctx.strokeStyle = "rgba(0, 255, 255, 0.1)"
                ctx.strokeRect(cx, cy, card_size, card_size);
                continue;
            }

            let is_usable = c.isTurn(this.turn);

            if(!is_usable) ctx.globalAlpha = 0.2;
            ctx.strokeStyle = is_usable ? "cyan" : "grey";
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
            ctx.fillStyle = is_usable ? "cyan" : "grey";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                c.name,
                cx+Math.floor(card_size/2),
                cy+card_size*1.1
            )

            if(!hide) ctx.globalAlpha = 1;
        }

        ctx.globalAlpha = 1;
    }

    renderDraggedCard() {
        if(this.card_rendering.dragged_card == null) return;
    
        const ctx = this.engine.renderer.ctx;
        const card_size = 128;
        const c = this.card_rendering.dragged_card;
        let dcx = Math.floor(this.engine.keyboard.mouseX - this.card_rendering.drag_point[0]);
        let dcy = Math.floor(this.engine.keyboard.mouseY - this.card_rendering.drag_point[1]);
        const cb = this.getCombatBox();
        const cbx = cb.x
        const cby = cb.y
        const cbs = cb.w

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

    drawUIText() {
        const ctx = this.engine.ctx;
        const cb = this.getCombatBox();

        ctx.font = "40px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            `${this.round_timer}s`,
            cb.x + Math.floor(cb.w/2),
            65
        );
    }

    render() {
        this.renderCardsInHand();
        this.player.render(this.engine.ctx);
        this.renderCombatBox();
        this.renderDraggedCard();
        this.drawUIText();
    }

    renderCombat() {
        this.projectiles.renderProjectiles();
    }

    renderCombatBox() {
        const ctx = this.engine.ctx;
        let cb = this.getCombatBox();
        ctx.strokeStyle = "white";
        ctx.lineWidth = "3";
        ctx.strokeRect(cb.x, cb.y, cb.w, cb.h);

        if(!this.combat_active) this.drawPreviewOfTurn();
        else this.renderCombat();
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

        if(!this.combat_active) {
            for(let x1 = 0; x1 < deck.length; x1++) {
                const c = deck[x1]
                if(this.card_rendering.cards.map(a => a.card).find(b => b == c) != undefined) {
                    skipped += 1;
                    continue;
                };
                let cx, cy;
                
                let y_off = Math.floor((x1-skipped)/2)
                cx = 10+(card_size*(x1-(y_off*2)-skipped))+((x1-(y_off*2)-skipped)*10);
                cy = 10+(y_off*158);
                if(Engine.rectanglesIntersect(x, y, 10, 10, cx, cy, card_size, card_size)) {
                    let is_usable = c.isTurn(this.turn);
                    if(is_usable) {
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
    }

    onRoundStart() {
        this.card_rendering.temporary_projectiles = [];
        this.card_rendering.dragged_card = null;
        this.card_rendering.dragged_alr_card = null;
        this.card_rendering.drag_point = null;
        this.card_rendering.dragged_card_in_box = false;

        this.round_timer = this.projectiles.getHighestLifespan()-1;

        this.combat_active = true;
    }

    onRoundEnd() {
        this.combat_active = false;
        this.card_rendering.cards = [];
        this.projectiles.projectiles.forEach(p => this.projectiles.destroyProjectile(p));
        this.turn = this.turn == 0 ? 1 : 0;
        this.round_timer = 20;
        let cb = this.getCombatBox();
        this.player.x = Math.floor(cb.w / 2)
        this.player.y = Math.floor(cb.h / 2)
    }

    onSecond() {
        if(this.round_timer > 0) {
            this.round_timer -= 1;
        } else {
            if(!this.combat_active) {
                this.onRoundStart();
            } else {
                this.onRoundEnd();
            }
        }
    }

    combatUpdate(delta) {
        delta *= this.timescale
        this.second_timer += delta;
        if(this.second_timer > 1) {
            this.second_timer -= 1;
            this.onSecond();
        }
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

        let dirx = 0, diry = 0;
        if (this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.LEFT_ARROW) || this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.A_KEY)) { dirx += -1; }
        if (this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.RIGHT_ARROW) || this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.D_KEY)) { dirx += 1; }
        if (this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.UP_ARROW) || this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.W_KEY)) { diry += -1; }
        if (this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.DOWN_ARROW) || this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.S_KEY)) { diry += 1; }

        if(this.combat_active) this.player.move(delta, dirx, diry);
    }

    enterCombat() {
        this.engine.state = "combat";
        this.in_combat = true;
        let cb = this.getCombatBox();
        this.player.x = Math.floor(cb.w / 2)
        this.player.y = Math.floor(cb.h / 2)
    }

    exitCombat() {
        this.engine.state = "main";
        this.in_combat = false;
    }
}

export class CombatPlayer {
    constructor(x, y, combat) {
        this.x = x; this.y = y; this.visible = false;
        this.combat = combat; this.size = {"w": 20, "h": 20}
    }

    render(context) {
        const cb = this.combat.getCombatBox();
        context.fillStyle = "blue";
        context.fillRect(this.x + cb.x, this.y + cb.y, this.size.w, this.size.h);
    }

    getCenter() {
        return {"x": this.x+this.size.w, "y": this.y+this.size.h}
    }

    move(delta, dirx, diry, speed=250) {
        const cb = this.combat.getCombatBox();
        if (dirx !== 0 && diry !== 0) {
            const len = Math.sqrt(dirx * dirx + diry * diry);
            dirx /= len;
            diry /= len;
        }
        this.x += dirx * speed * delta;
        this.y += diry * speed * delta;
    
        var maxX = cb.w - this.size.w;
        var maxY = cb.h - this.size.h;

        this.x = Math.max(0, Math.min(this.x, maxX));
        this.y = Math.max(0, Math.min(this.y, maxY));
    };
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
        this.activeInPreview = this.settings.activeInPreview || false;
    }

    init() {
        switch(this.type) {
            case "circle": {
                this.data.angle = 0;
                this.activeInPreview = true;
            }
            case "follow": {
                this.data.angleOffset = (Math.random() * 2 - 1) * this.settings.accuracy;
            }
        }
    }

    getMovement(delta) {
        if(!this.activeInPreview && !this.projectile.combat.combat_active) return;

        let d = null;
    
        switch(this.type) {
    
            case "circle": {
                let x = this.center.x + Math.cos(this.data.angle) * this.settings.radius;
                let y = this.center.y + Math.sin(this.data.angle) * this.settings.radius;
    
                this.data.angle += this.settings.speed * delta;
    
                d = {x, y}
            }
    
            case "follow": {
                switch(this.settings.target) {
                    case "player": {
                        const target = this.projectile.combat.player.getCenter();
                    
                        let px = this.projectile.x;
                        let py = this.projectile.y;
                        if(!this.data.velocity) {
                            this.data.velocity = {
                                x: 0,
                                y: 0
                            };
                        }
                    
                        // Direction to player
                        let dx = target.x - px;
                        let dy = target.y - py;
                    
                        let distance = Math.hypot(dx, dy);
                    
                        if(distance > 0.001) {
                            dx /= distance;
                            dy /= distance;
                        }
                    
                        let angle = Math.atan2(dy, dx);
                        angle += this.data.angleOffset;
                    
                        let targetVX = Math.cos(angle) * (this.settings.speed*100);
                        let targetVY = Math.sin(angle) * (this.settings.speed*100);
                        let turnSpeed = this.settings.turnSpeed ?? 0.05;
                    
                        this.data.velocity.x += (targetVX - this.data.velocity.x) * turnSpeed;
                        this.data.velocity.y += (targetVY - this.data.velocity.y) * turnSpeed;
                    
                        d = {
                            x: px + this.data.velocity.x * delta,
                            y: py + this.data.velocity.y * delta
                        };
                    }
                }
            }
        }
    
        if(d != null && this.projectile.combat.combat_active) {
            const cb = this.projectile.combat.getCombatBox();
            var maxX = cb.w - this.projectile.settings.size;
            var maxY = cb.h - this.projectile.settings.size;

            d.x = Math.max(0, Math.min(d.x, maxX));
            d.y = Math.max(0, Math.min(d.y, maxY));
        };
        return d;
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
        this.combat = combat; this.visible = false; this.spent_life = 0;
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
        if(this.combat.combat_active) {
            this.spent_life += delta;
            if(this.spent_life > (this.settings.lifespan-0.1)) {
                this.combat.projectiles.destroyProjectile(this);
                return;
            }
        }
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
        let o = (1-this.spent_life/this.settings.lifespan) + 0.3;

        ctx.globalAlpha = clamp(o, .5, 1);
    
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
        ctx.globalAlpha = 1;
    }
}