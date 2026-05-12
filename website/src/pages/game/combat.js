/**
 * author thebadlorax
 * created on 09-05-2026-22h-32m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { clamp } from "../common.js";
import { Engine } from "./engine.js";

let timescale = 1;

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
        if(this.type == "pactive") {
            this.ability = new CardAbility(this, this.data.settings, this.data.type)
        };
        this.uid = crypto.randomUUID()
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
    constructor(card, x, y) { this.card = card; this.x = x; this.y = y; this.size = 128; this.p = null; this.uid = crypto.randomUUID()};
}

export class CardAbility {
    constructor(card, settings, type) {
        this.card = card;
        this.type = type;
        this.settings = settings;
        this.cooldown = settings.cooldown;
        this.last_press = Date.now()+(this.cooldown*1000);
        this.max_uses = settings.uses;
        this.uses = this.max_uses
    }

    activate(sprite) {
        if(Date.now() - this.last_press < this.cooldown*1000) return;
        this.last_press = Date.now();
        if(this.uses <= 0) { return; }
        switch(this.type) {
            case "move": {
                sprite.addForce(this.settings.force*100);
            }
            case "changeTime": {

            }
        }
        this.uses -= 1;
    }
}

export class CardManager {
    static getRandomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    constructor() {
        this.cards = [];
        this.full_deck = [];
        this.deck = [];
        this.hand = [];
        this.shuffle();
    };

    getCardFromID(id) { return this.cards.find(c => c.id == id); };

    createNewCardObject(id) {
        const c = this.getCardFromID(id);
        let card = new Card(
            c.name,
            c.description,
            c.id,
            c.type,
            c.rarity,
            c.image,
            c.data
        );
        return card;
    }

    getDiscards() {
        return this.full_deck.filter(c => !this.deck.includes(c));
    }

    shuffle() {
        this.deck = [];
        this.full_deck.forEach(id => {
            this.deck.push(this.createNewCardObject(id));
        })
    }

    getDeck() {
        return this.deck;
    }

    getHand() {
        return this.hand;
    }

    discard(card) {
        this.hand.splice(this.hand.indexOf(card), 1);
    }

    drawCard(amt=1) {
        let drawn = [];
        for(let x = 0; x < amt; x++) {
            if(this.deck.length == 0) {
                this.shuffle();
            };
            let c = CardManager.getRandomItem(this.deck);
            drawn.push(c);
            this.deck.splice(this.deck.indexOf(c), 1)
        }
        this.hand.push(...drawn);
    }

    addToDeck(...ids) { ids.forEach(id => this.full_deck.push(id)) };

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
        this.player = new CombatPlayer(null, null, this);
        this.turn_counter = 0;
        this.card_rendering = {
            "dragged_card": null,
            "dragged_alr_card": null,
            "drag_point": null,
            "dragged_card_in_box": false,
            "cards": [],
            "temporary_projectiles": [],
            "actives": [
                null,
                null,
                null
            ]
        }

        const handle_ability_press = (index) => {
            let a = this.card_rendering.actives[index];
            if(!a) return;
            if(!a.ability) return;
            a.ability.activate(this.player);
        }

        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.SHIFT, () => { handle_ability_press(0); })
        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.TAB, () => { handle_ability_press(1); })
        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.SPACE, () => { handle_ability_press(2); })
    }

    renderCardsInHand() {
        const ctx = this.engine.renderer.ctx;
        const deck = this.cardManager.getHand();
        const card_size = 128;

        let skipped = 0;

        let hide = this.combat_active;
        if(hide) ctx.globalAlpha = 0.2;
        else ctx.globalAlpha = 1;

        for(let x = 0; x < deck.length; x++) {
            const c = deck[x];
            if(this.card_rendering.cards.map(a => a.card).concat(this.card_rendering.actives.filter(a => a != null)).find(b => b === c) != undefined) {
                skipped += 1;
                continue;
            };
            let cx, cy;
            let y_off = Math.floor((x-skipped)/2);
            cx = 10+(card_size*(x-(y_off*2)-skipped))+((x-(y_off*2)-skipped)*10);
            cy = 10+(y_off*158);
            let is_dragged = false;
            if(this.card_rendering.dragged_card != null) {
                is_dragged = c.uid === this.card_rendering.dragged_card.uid;
            }
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

        if(this.turn == 1) {
            // subtract combat box
            ctx.rect(
                cbx,
                cby,
                cbs,
                cbs
            );

            ctx.clip("evenodd");
        }
    
        
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

        let x = cb.x + Math.floor(cb.w/2);
        let y = 65;

        ctx.font = "40px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            `${this.round_timer}s ${this.projectiles.getHighestLifespan() != null && this.combat_active == false ? `(next round: ${this.projectiles.getHighestLifespan()}s)` : ""}`,
            x,
            y
        );
    }

    render() {
        this.renderCardsInHand();
        if(this.turn == 0) this.drawActiveSlots();
        this.player.render(this.engine.ctx);
        this.renderCombatBox();
        this.renderDraggedCard();
        this.drawUIText();
    }

    getActiveSlots() {
        const pos = [];
        const cb = this.getCombatBox();

        const w = 128;

        for(let a = 0; a < 3; a++) {
            let x = (138*a) + (cb.x + cb.w/4.5) - w/2;
            let y = (cb.y+cb.h/2) - w/2;
            pos[a] = {"x": x, "y": y, "w": w, "h": w, "i": a}
        }
        return pos;
    }

    drawActiveSlots() {
        const ctx = this.engine.ctx;

        const texts = ["shift", "tab", "space"]
        const boxes = this.getActiveSlots();

        for(let a = 0; a < 3; a++) {
            let is_in_use = this.card_rendering.actives[a] != null;
            if(this.combat_active && !is_in_use) continue;
            if(this.card_rendering.actives[a] == null) {
                if(this.card_rendering.dragged_card == null) {
                    continue
                }
            }
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.combat_active ? "0.05" : "0.3"})`;
            ctx.lineWidth = 2;
            let x = boxes[a].x;
            let y = boxes[a].y;
            let w = boxes[a].w;
            let h = boxes[a].h;
    
            ctx.strokeRect(x, y, w, h);

            if(is_in_use) {
                if(this.combat_active) ctx.globalAlpha = 0.2;
                if(this.card_rendering.actives[a].ability.uses == 0) ctx.globalAlpha = 0.1;
                ctx.drawImage(this.card_rendering.actives[a].image, x+2, y+2, w-4, h-4);
                ctx.globalAlpha = 1;
            }
    
            ctx.font = "13px monospace";
            ctx.fillStyle = `rgba(255, 255, 255, ${this.combat_active ? "0.2" : "0.4"})`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            ctx.fillText(
                `${texts[a]}`,
                x + w/2,
                y - (h*0.1)
            );
            if(is_in_use) {
                ctx.fillText(
                    `${this.card_rendering.actives[a].name} (${this.card_rendering.actives[a].ability.uses} left)`,
                    x + w/2,
                    y + (h*1.1)
                );
            }
            ctx.globalAlpha = 1;
        }
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

        if(!this.combat_active) {
            this.drawPreviewOfTurn();
        }
        else this.renderCombat();
        
    }

    onRelease() {
        const box = this.getCombatBox();
        if(this.turn == 1) {
            if(this.card_rendering.dragged_card_in_box) {
                let x = Math.floor(this.engine.keyboard.mouseX - this.card_rendering.drag_point[0]);
                let y = Math.floor(this.engine.keyboard.mouseY - this.card_rendering.drag_point[1]);
                
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
            this.card_rendering.dragged_alr_card = null;
        } else {
            if(this.card_rendering.dragged_card_in_box) {
                let x = Math.floor(this.engine.keyboard.mouseX - this.card_rendering.drag_point[0]);
                let y = Math.floor(this.engine.keyboard.mouseY - this.card_rendering.drag_point[1]);

                let overlaps = [];
                const boxes = this.getActiveSlots();
                for(let x1 = 0; x1 < boxes.length; x1++) {
                    const b = boxes[x1];
                    let o = Engine.getRectangleOverlap(b.x, b.y, b.w, b.h, x, y, 128, 128);
                    overlaps.push({"b": b, "i": x1, "o": o})
                }

                const valid_overlaps = overlaps.filter(o => o.o != null);
                let cx = null, cy = null;
                if(valid_overlaps.length == 1) {
                    cx = valid_overlaps[0].b.x;
                    cy = valid_overlaps[0].b.y;
                }
                if(cx != null & cy != null) {
                    this.card_rendering.actives[valid_overlaps[0].i] = this.card_rendering.dragged_card;
                }
            }
        }
        
        
        this.card_rendering.dragged_card = null;
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

        const hand = this.cardManager.getHand();
        const card_size = 128;

        let skipped = 0;
        const box = this.getCombatBox();

        if(!this.combat_active) {
            for(let x1 = 0; x1 < hand.length; x1++) {
                const c = hand[x1]
                if(this.card_rendering.cards.map(a => a.card).concat(this.card_rendering.actives.filter(a => a != null)).find(b => b === c) != undefined) {
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
                        if(this.turn == 1) {
                            let p = this.projectiles.createProjectile(
                                x - box.x,
                                y - box.y,
                                this.card_rendering.dragged_card.data
                            );
                            this.card_rendering.temporary_projectiles.push(p);
                        }
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

        this.card_rendering.cards.forEach(c => {
            this.cardManager.discard(c);
        });

        this.round_timer = (this.projectiles.getHighestLifespan()-1) || 10;

        this.combat_active = true;
    }

    onRoundEnd() {
        this.combat_active = false;
        this.card_rendering.cards = [];
        this.projectiles.projectiles.forEach(p => this.projectiles.destroyProjectile(p));
        for(let x = 0; x < this.card_rendering.actives.length; x++) {
            const a = this.card_rendering.actives[x];
            if(a == null) continue;
            if(a.ability.uses <= 0) {
                this.cardManager.discard(a);
                this.card_rendering.actives[x] = null;
            }
        }
        this.turn = this.turn == 0 ? 1 : 0;
        this.round_timer = 10;
        let cb = this.getCombatBox();
        this.player.x = Math.floor(cb.w / 2)
        this.player.y = Math.floor(cb.h / 2)
        this.turn_counter += 1;
        if(this.turn_counter == 2) {
            this.turn_counter = 0;
            this.onTurnCompletion();
        }
        
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
        delta *= timescale
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

    onTurnCompletion() {
        this.cardManager.drawCard(10-this.cardManager.hand.length);
    }

    enterCombat() {
        this.engine.state = "combat";
        this.in_combat = true;
        let cb = this.getCombatBox();
        this.player.x = Math.floor(cb.w / 2)
        this.player.y = Math.floor(cb.h / 2)
        this.onTurnCompletion();
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
        if(!this.combat.combat_active) return;
        context.fillStyle = "blue";
        context.fillRect(this.x + cb.x, this.y + cb.y, this.size.w, this.size.h);
    }

    getCenter() {
        return {"x": this.x+this.size.w, "y": this.y+this.size.h}
    }

    addForce(force) {
        this.force = force;
    };

    move(delta, dirx, diry, speed=250) {
        const cb = this.combat.getCombatBox();
        if (dirx !== 0 && diry !== 0) {
            const len = Math.sqrt(dirx * dirx + diry * diry);
            dirx /= len;
            diry /= len;
        }
        let sp = speed;
        if(this.force != null) {
            sp += this.force;
            this.force = null;
        }
        this.x += dirx * sp * delta;
        this.y += diry * sp * delta;
    
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
    
                d = {x, y}; break;
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
                        }; break;
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