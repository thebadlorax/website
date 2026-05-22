/**
 * author thebadlorax
 * created on 09-05-2026-22h-32m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { clamp } from "../common.js";
import { Engine } from "./engine.js";

export class Card {
    static getSize() {
        return {
            "w": 144,
            "h": 216
        }
    }
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
                sprite.iframes += 0.3;
                sprite.addForce({x: sprite.lastDirX*(this.settings.force*10), y: sprite.lastDirY*(this.settings.force*10)});
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

    resetHand() {
        this.hand = [];
        this.shuffle();
    }

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
        const index = this.hand.findIndex(c => c.uid === card.uid);
        if(index === -1) return;
    
        this.hand.splice(index, 1);
    }

    drawCard(amt=1) {
        let drawn = [];
        for(let x = 0; x < amt; x++) {
            /*if(this.deck.length == 0) {
                this.shuffle();
            };*/
            let c = CardManager.getRandomItem(this.deck);
            if(c == undefined) continue;
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
    };

    clearProjectiles() {
        this.projectiles = [];
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

export class Hologram {
    constructor(x=250, y=250, lifespan=5, color="white", fade=true, size=15, text) {
        this.x = x; this.y = y; this.lifespan = lifespan; this.text = text;
        this.fade = fade; this.color = color; this.timealive = 0; this.size = size;
        this.visible = true; this.on_update = (delta) => {};
    }

    render(ctx, cb) {
        if(!this.visible) return;
        ctx.fillStyle = this.color;
        ctx.font = `${this.size}px monospace`;
        if(this.fade) ctx.globalAlpha = 1-(this.timealive/this.lifespan)
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            this.text,
            this.x + cb.x,
            this.y + cb.y
        )
        ctx.globalAlpha = 1
    }

    destroy() {
        this.visible = false;
    }

    update(delta) {
        this.timealive += delta;
        this.on_update(delta);
        if(this.timealive > this.lifespan) {
            this.destroy();
        }
    }
}

export class CombatScenario {
    static weightedRandomIndex(weights) {
        let sum = 0;
        for (let w of weights) sum += w;
    
        if (sum <= 0) return Math.floor(Math.random() * weights.length);
    
        let r = Math.random() * sum;
    
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) return i;
        }
    
        return weights.length - 1;
    }

    constructor(
        data,
        combat
    ) {
        this.combat = combat;
        this.opponent = data.opponent;
        this.health = this.opponent.maxhealth;
        this.freq_grids = data.opponent.weights;
        this.path = data.opponent.path;
        this.speed = data.opponent.speed*10;
        this.cardManager = new CardManager();
        this.combat.engine.data.cards.forEach(c => this.cardManager.cards.push(Card.fromJSON(c, this.combat.engine.loader)));
        data.opponent.deck.forEach(c => this.cardManager.addToDeck(c));
        this.cardManager.shuffle();
        this.cardDraw = data.opponent.cardDraw;

        this.rewards = data.rewards;

        this.t = 0;
        this.segmentLength = 0.1;

        this.x = 0;
        this.y = 0;
        this.iframes = 0;
        this.size = {"w": 20, "h": 20};
    }

    getPoint(t) {
        const pts = this.path;
        const n = pts.length;
    
        const i = Math.floor(t);
        const localT = t - i;
    
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i % n];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
    
        return Engine.catmullRom(p0, p1, p2, p3, localT);
    }
    
    dodgingUpdate(delta) {
        const pts = this.path;
    
        if (!pts || pts.length < 1) return;
    
        this.t += this.speed * delta * 0.01;
    
        const p = this.getPoint(this.t);
    
        this.x = p.x;
        this.y = p.y;

        if(this.iframes > 0) {
            this.iframes -= delta;
        }
        if(this.iframes < 0) this.iframes = 0;
    }

    getCardPlacements(max_cards=1) {
        const placements = [];
        const combatBox = this.combat.getCombatBox();
        const freqGrids = this.freq_grids;
        let hand = this.cardManager.getHand();
        hand = hand.slice(0, Math.floor(hand.length*max_cards));
        const gridSize = this.combat.debug.grid_size;
    
        const cols = Math.floor(combatBox.w / gridSize);
        const rows = Math.floor(combatBox.h / gridSize);
    
        for (const card of hand) {
            const grid = freqGrids.find(g => g.id === card.id);
            if (!grid) continue;
    
            const weights = grid.data;
    
            const index = CombatScenario.weightedRandomIndex(weights);
    
            const y = Math.floor(index / cols);
            const x = index % cols;
    
            const px = x * gridSize;
            const py = y * gridSize;
    
            const jitter = gridSize * 0.25;
            const jx = (Math.random() - 0.5) * jitter;
            const jy = (Math.random() - 0.5) * jitter;
    
            placements.push({
                card,
                x: clamp(px + jx, 0, combatBox.w - 128),
                y: clamp(py + jy, 0, combatBox.h - 128)
            });
        }

        return placements;
    }

    runPlacingTurn() {
        const placements = this.getCardPlacements();

        for(let x = 0; x < placements.length; x++) {
            const placement = placements[x]
            let p = this.combat.projectiles.createProjectile(
                placement.x,
                placement.y,
                placement.card.data
            );
            p.visible = true;
        }
    }

    onDeath() {
        this.combat.onWin();
    }

    render() {
        if(!this.combat.combat_active || this.combat.turn == 0) return;
        const cb = this.combat.getCombatBox();
        const context = this.combat.engine.ctx;
        context.fillStyle = `rgba(255, 0, 0, ${this.iframes == 0 ? "1" : "0.4"})`;
        const center = this.getCenter();
        context.fillRect(center.x + cb.x, center.y + cb.y, this.size.w, this.size.h);
    }

    damage() {
        this.health -= 1;
        if(this.health <= 0) {
            this.onDeath();
            return;
        }
        this.iframes = 1;
        let h = new Hologram(
            this.x, this.y, 1.5, "red", true, 15, `-1`
        );
        h.on_update = () => {
            h.y -= 1;
        }
        this.combat.holograms.push(h);
    }

    getCenter() {
        return {"x": this.x-this.size.w, "y": this.y-this.size.h}
    }

    onProjectileCollision(proj) {
        if(this.iframes == 0) {
            this.damage();
        }
    }
}

export class CombatManager {
    constructor(cm, engine) {
        this.setupVariables();
        this.cardManager = cm;
        this.engine = engine;
        
        setTimeout(() => { this.debug.buttons[0].onClick(); }, 500);
        const handle_ability_press = (index) => {
            let a = this.card_rendering.actives[index];
            if(!a) return;
            if(!a.ability) return;
            if(!this.combat_active) return;
            if(this.turn == 1) return;
            a.ability.activate(this.player);
        }

        this.engine.keyboard.setFunctionOnKeyPress(this.combatSettings.active_keybinds[0].code, () => { if(this.in_combat) handle_ability_press(0); })
        this.engine.keyboard.setFunctionOnKeyPress(this.combatSettings.active_keybinds[1].code, () => { if(this.in_combat) handle_ability_press(1); })
        this.engine.keyboard.setFunctionOnKeyPress(this.combatSettings.active_keybinds[2].code, () => { if(this.in_combat) handle_ability_press(2); })
        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.M_KEY, () => { if(this.in_combat) this.toggleEditor(); })

        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.G_KEY, () => {
            this.debug.debug_kb_pressed = true;
        });

        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.T_KEY, () => {
            if(!this.debug.debug_kb_pressed) return;
            this.turn = this.turn == 1 ? 0 : 1
            this.debug.debug_kb_pressed = false;
        })

        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.P_KEY, () => {
            this.engine.settings.performance_mode = !this.engine.settings.performance_mode;
            document.body.style.cursor = "default";
            this.combatVariables.timescale = this.combatVariables.timescale == 0 ? 1 : 0
            this.debug.debug_kb_pressed = false;
        })

        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.O_KEY, () => {
            if(!this.debug.debug_kb_pressed) return;
            this.onWin();
            this.debug.debug_kb_pressed = false;
        })

        this.engine.keyboard.setFunctionOnKeyPress(this.engine.keyboard.KEYCODES.V_KEY, () => {
            if(!this.debug.debug_kb_pressed) return;
            this.reset(this.debug.scen_data);
            this.debug.debug_kb_pressed = false;
        })
    }

    setupVariables() {
        this.projectiles = new ProjectileManager(this);
        this.in_combat = false;
        this.turn = 0; // 0 = dodging, 1 = placing
        this.round_timer = 15;
        this.combat_active = false;
        this.player = new CombatPlayer(null, null, this);
        this.turn_counter = 0;
        this.holograms = [];
        this.debug = {
            "editor": false,
            "buttons": [
                {
                    "name": "+grid",
                    "onClick": () => { 
                        const cb = this.getCombatBox();
                        const cols = Math.floor(cb.w / this.debug.grid_size);
                        const rows = Math.floor(cb.w / this.debug.grid_size);
                        this.debug.freq_grids.push({
                            "id": parseInt(this.debug.editor ? prompt("card id") : 0),
                            "data": new Array(cols * rows).fill(0)
                        });
                    }
                },
                {
                    "name": "?grid",
                    "onClick": () => {
                        this.debug.selected_id = parseInt(prompt("grid id:"))
                    }
                },
                {
                    "name": "?weight",
                    "onClick": () => {
                        this.debug.selected_num = clamp(parseInt(prompt("weight num:")), 0, 10);
                    }
                },
                {
                    "name": "?size",
                    "onClick": () => {
                        this.debug.brush_size = parseInt(prompt("brush size:"))
                    }
                },
                {
                    "name": "!export",
                    "onClick": async () => {
                        if(this.debug.path_active) {
                            await navigator.clipboard.writeText(JSON.stringify(this.debug.drawn_path));
                        } else {
                            await navigator.clipboard.writeText(JSON.stringify(this.debug.freq_grids));
                        }
                        alert("copied");
                    }
                }, 
                {
                    "name": "?import",
                    "onClick": async () => {
                        let d = await navigator.clipboard.readText();
                        if(this.debug.path_active) {
                            this.debug.drawn_path = JSON.parse(d);
                        } else {
                            this.debug.freq_grids = JSON.parse(d);
                        }
                        alert("imported");
                    }
                },
                {
                    "name": "?mode",
                    "onClick": async () => {
                        this.debug.path_active = !this.debug.path_active
                    }
                }
            ],
            "freq_grids": [],
            "grid_size": 10,
            "selected_id": 0,
            "is_drawing": false,
            "selected_num": 0,
            "brush_size": 1,
            "drawn_path": [],
            "path_active": false,
            "debug_kb_pressed": false
        }
        this.combatSettings = {
            "future_opacity": 0.4,
            "bg_text_opacity_prepare": 0.1,
            "bg_text_opacity_play": 0.06,
            "hand_active_size": 1,
            "hand_nonactive_size": 0.2,
            "paused": false,
            "active_keybinds": [
                {
                    "code": "ShiftLeft",
                    "name": "shift"
                },
                {
                    "code": "Tab",
                    "name": "tab"
                },
                {
                    "code": "Space",
                    "name": "space"
                },
            ],
            "drop_shadows": true,
            "show_bg_text": true,
            "performance": false
        }
        this.combatVariables = {
            "timescale": 1,
            "bg_text_current": "prepare",
            "bg_text_next": null,
            "bg_text_transition": 0,
            "bg_text_transition_speed": 3,
            "bg_text_opacity": this.combatSettings.bg_text_opacity_prepare,
            "bg_text_target_opacity": this.combatSettings.bg_text_opacity_prepare,
            "bg_text_opacity_speed": 2,
            "bg_text_angle": 45,
            "bg_text_color": "white",
            "bg_text_offset": 0,
            "bg_text_timescale": 3,
            "hand_hover": 0,
            "hand_hover_speed": 8,
            "placing_time": 20,
            "fade_out_opacity": 0,
            "fade_out_opacity_speed": 3,
            "has_won": false,
            "reward_cards": [],
            "pellets": [],
            "victory_status": false
        }
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
        this.in_transition = false;
    }

    toggleEditor() {
        this.debug.editor = !this.debug.editor;
        if(this.debug.editor) {
            this.combatVariables.timescale = 0;
        } else {
            this.combatVariables.timescale = 1;
        }
    }

    getHandCardPosition(index, count) {
        const card_size = Card.getSize();
        const cb = this.getCombatBox();
    
        const y_off = -60;
    
        const center = (count - 1) / 2;
    
        const hover = this.combatVariables.hand_hover;

        const spread =
            (card_size.w * 0.65) +
            ((card_size.w * 1.3) - (card_size.w * 0.65)) * hover;

        const curve = 10 - (6 * hover);
        const angleSpread = 0.12 - (0.07 * hover);
        const lift = -30 * hover;
        const offset = index - center;
        const loweredY = 85 * (1 - hover);
    
        return {
            x:
                cb.x +
                (cb.w / 2) +
                (offset * spread),
    
            y:
                (cb.y + cb.h + y_off - lift + loweredY) +
                (Math.pow(offset, 2) * curve),
    
            rotation: offset * angleSpread
        };
    }

    renderCardsInHand(box_clip=false) {
        const ctx = this.engine.renderer.ctx;
        const cb = this.getCombatBox();

        let deck = this.cardManager.getHand();
        const card_size = Card.getSize();
        if(Engine.rectanglesIntersect(
            this.engine.keyboard.mouseX, this.engine.keyboard.mouseY, 10, 10,
        ));

        deck = deck.filter(c =>
            !this.card_rendering.cards
                .map(a => a.card)
                .concat(this.card_rendering.actives.filter(a => a != null))
                .find(b => b.uid === c.uid)
        );

        let skipped = 0;

        for(let i = 0; i < deck.length; i++) {
            const c = deck[i];
            if(this.card_rendering.cards.map(a => a.card).concat(this.card_rendering.actives.filter(a => a != null)).find(b => b.uid === c.uid) != undefined) {
                skipped += 1;
                continue;
            };

            let is_dragged = this.card_rendering.dragged_card == c;

            const is_usable = c.isTurn(this.turn);

            ctx.lineWidth = 5;

            const pos = this.getHandCardPosition(i-skipped, deck.length-skipped);


            ctx.save();

            if(box_clip) {
                ctx.beginPath();
                ctx.rect(
                    0,
                    0,
                    this.engine.camera.width,
                    this.engine.camera.height
                );
                ctx.rect(
                    cb.x-10,
                    cb.y-10,
                    cb.w+20,
                    cb.h+20
                );

                ctx.clip("evenodd");
            }

            ctx.translate(pos.x, pos.y);
            ctx.rotate(pos.rotation);

            const hover = this.combatVariables.hand_hover;

            const scale = 0.7 + (0.3 * hover);

            ctx.globalAlpha = 1 - this.combatVariables.fade_out_opacity

            ctx.scale(scale, scale);

            ctx.strokeStyle = is_dragged ? "rgba(0, 255, 255, 0.3)" : (is_usable ? "white" : "rgba(255, 255, 255, 0.3)");

            this.drawDropShadow(30, 0.3, -card_size.w / 2, -card_size.h / 2, card_size.w*.9, card_size.h*.9, card_size.w*.2, card_size.h*.2)

            ctx.strokeRect(
                -card_size.w / 2,
                -card_size.h / 2,
                card_size.w,
                card_size.h
            )

            if(!is_dragged) {
                ctx.drawImage(
                    c.image,
                    -card_size.w / 2,
                    -card_size.h / 2,
                    card_size.w,
                    card_size.h
                );

                if(!is_usable) {
                    ctx.fillStyle = `rgba(0, 0, 0, ${this.combatVariables.fade_out_opacity != 0 ? 1 - this.combatVariables.fade_out_opacity : 0.7})`
                    ctx.fillRect(
                        -card_size.w / 2,
                        -card_size.h / 2,
                        card_size.w,
                        card_size.h
                    );
                }

                ctx.font = "13px monospace";
                ctx.fillStyle = is_usable ? "white" : `rgba(255, 255, 255, ${this.combatVariables.fade_out_opacity != 0 ? 1 - this.combatVariables.fade_out_opacity : 0.7})`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    c.name,
                    (-card_size.w / 2) + Math.floor(card_size.w / 2),
                    (-card_size.h / 2) + card_size.h * 1.1
                );
            } else {
                ctx.fillStyle = "rgba(0, 255, 255, 0.1)"
                ctx.fillRect(
                    -card_size.w / 2,
                    -card_size.h / 2,
                    card_size.w,
                    card_size.h
                )
            }
            
            ctx.restore();

            ctx.globalAlpha = 1;
        }
    }

    renderDraggedCard() {
        if(this.card_rendering.dragged_card == null) return;
    
        const ctx = this.engine.renderer.ctx;
        const card_size = Card.getSize();
        const c = this.card_rendering.dragged_card;
        let dcx = Math.floor(this.engine.keyboard.mouseX - this.card_rendering.drag_point[0]);
        let dcy = Math.floor(this.engine.keyboard.mouseY - this.card_rendering.drag_point[1]);
        const cb = this.getCombatBox();
        const cbx = cb.x
        const cby = cb.y
        const cbs = cb.w

        if(this.combatSettings.performance) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(
                dcx,
                dcy,
                card_size.w,
                card_size.h
            );
            ctx.font = "13px monospace";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                c.name,
                dcx + Math.floor(card_size.w / 2),
                dcy + card_size.h * 1.1
            );

            let overlap = Engine.getRectangleOverlap(dcx, dcy, card_size.w, card_size.h, cbx, cby, cbs, cbs);

            if(!overlap) { this.card_rendering.dragged_card_in_box = false; return; };

            this.card_rendering.dragged_card_in_box = true;

            return;
        }

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
            card_size.w,
            card_size.h
        );

        this.drawDropShadow(30, 0.3, dcx, dcy, card_size.w*.9, card_size.h*.9, card_size.w*.2, card_size.h*.2)
    
        ctx.restore();

        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(
            dcx,
            dcy,
            card_size.w,
            card_size.h
        );
        ctx.font = "13px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            c.name,
            dcx + Math.floor(card_size.w / 2),
            dcy + card_size.h * 1.1
        );

        let overlap = Engine.getRectangleOverlap(dcx, dcy, card_size.w, card_size.h, cbx, cby, cbs, cbs);

        if(!overlap) { this.card_rendering.dragged_card_in_box = false; return; };

        this.card_rendering.dragged_card_in_box = true;
    }

    drawPreviewOfTurn() {
        const ctx = this.engine.ctx;
        this.projectiles.renderProjectiles();
        const card_size = Card.getSize();
        this.card_rendering.cards.forEach(c => {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 2;
            const box = this.getCombatBox();
            ctx.strokeRect(
                box.x + c.x,
                box.y + c.y,
                card_size.w,
                card_size.h
            );

            ctx.font = "13px monospace";
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                c.card.name,
                (box.x + c.x)+Math.floor(card_size.w/2),
                (box.y + c.y)+card_size.h*1.1
            );
        });
    }

    drawUIText() {
        const ctx = this.engine.ctx;
        const cb = this.getCombatBox();

        let x = cb.x + Math.floor(cb.w/2);
        let y = 65;

        ctx.globalAlpha = 1 - this.combatVariables.fade_out_opacity

        ctx.font = "40px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if(!this.debug.editor) {
            ctx.fillText(
                `${this.round_timer.toFixed(0)}s ${this.projectiles.getHighestLifespan() != null && this.combat_active == false ? `(next round: ${this.projectiles.getHighestLifespan()}s)` : ""}`,
                x,
                y
            );
        } else {
            ctx.fillText(
                `EDITOR MODE (time is paused)`,
                x,
                y
            );
        }

        ctx.globalAlpha = 1;
        
    }

    drawHealthbar() {
        const cb = this.getCombatBox();
        const ctx = this.engine.ctx;

        const h = 20;
        const padding = 10;
        const w = (cb.w/2)-padding
        const w2 = (cb.w/2)
        const x2 = cb.x + w+padding;

        const hp_percent = this.player.health / this.player.maxhealth;
        const opp_hp_percent = this.scenario.health / this.scenario.opponent.maxhealth;

        ctx.globalAlpha = 1 - this.combatVariables.fade_out_opacity;

        ctx.lineWidth = 3;

        //let r = 255 * (1 - hp_percent);
        //let g = 200 * hp_percent;
        //ctx.fillStyle = `rgba(${r}, ${g}, 0, 1)`;
        ctx.fillStyle = `rgba(0, 190, 0, 1)`;
        ctx.fillRect(cb.x, ((cb.y-h)-padding), w * hp_percent, h)

        /*r = 255 * (1 - opp_hp_percent);
        g = 200 * opp_hp_percent;
        ctx.fillStyle = `rgba(${r}, ${g}, 0, 1)`;*/
        ctx.fillStyle = `rgba(255, 0, 0, 1)`;
        ctx.fillRect(x2, ((cb.y-h)-padding), w2 * opp_hp_percent, h)


        ctx.strokeStyle = "rgba(255, 255, 255, 1)";
        ctx.strokeRect(cb.x, ((cb.y-h)-padding), w, h);
        ctx.strokeRect(x2, ((cb.y-h)-padding), w2, h);

        ctx.font = "13px monospace";
        ctx.strokeStyle = "white";
        ctx.textAlign = "center";
        ctx.lineWidth = 1;
        ctx.textBaseline = "middle";
        ctx.strokeText(
            `${this.player.health}/${this.player.maxhealth}`,
            cb.x+(w/2),
            cb.y-(h)
        );

        ctx.strokeText(
            `${this.scenario.health}/${this.scenario.opponent.maxhealth}`,
            x2+(w2/2),
            cb.y-(h)
        );

        ctx.globalAlpha = 1;
    }

    drawEditorButtons() {
        const ctx = this.engine.ctx;

        const cols = 4;
        const padding = 10;
        const size = 64;

        const count = this.debug.buttons.length;
        
        for(let x = 0; x < count; x++) {
            const b = this.debug.buttons[x];
            const y1 = padding+((size+padding)*Math.floor(x/cols));
            const x1 = padding+((size+padding)*x)-(((size+padding)*cols)*Math.floor(x/cols));

            ctx.strokeStyle = "white";
            ctx.strokeRect(x1, y1, size, size);

            ctx.font = "13px monospace";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                `${b.name}`,
                x1+(size/2),
                y1+(size/2)
            );
        }
    }

    drawFrequencyGrid() {
        if(this.debug.path_active) return;
        const cb = this.getCombatBox();
        const ctx = this.engine.ctx;
        const size = this.debug.grid_size;
    
        const grid = this.debug.freq_grids.find(
            g => g.id == this.debug.selected_id
        );
    
        if (!grid) return;
    
        const cols = Math.floor(cb.w / size);
        const rows = Math.floor(cb.h / size);
    
        ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
    
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
    
                const index = y * cols + x;
                const cell = grid.data[index];
    
                const px = cb.x + x * size;
                const py = cb.y + y * size;
    
                if (cell) {
                    ctx.fillStyle = `rgba(${cell*25.5}, ${cell*25.5}, ${cell*25.5}, 1)`;
                    ctx.fillRect(px, py, size, size);
                }
    
                ctx.strokeRect(px, py, size, size);
            }
        }
    }

    drawEditorPath(dots, color, path_override=null) {
        if (!this.debug.path_active && path_override == null) return;
    
        const ctx = this.engine.ctx;
        const cb = this.getCombatBox();
    
        let path = this.debug.drawn_path;
        if(path_override != null) path = path_override;
    
        if (!path || path.length < 2) return;
    
        ctx.strokeStyle = color;
        ctx.globalAlpha = this.combatSettings.future_opacity;
        ctx.lineWidth = 2;
        ctx.beginPath();
    
        let first = true;
    
        for (let i = 0; i < path.length; i++) {
            const n = path.length;

            const p0 = path[(i - 1 + n) % n];
            const p1 = path[i];
            const p2 = path[(i + 1) % n];
            const p3 = path[(i + 2) % n];
    
            for (let t = 0; t <= 1; t += 0.02) {
    
                const p = Engine.catmullRom(p0, p1, p2, p3, t);
    
                const x = cb.x + p.x;
                const y = cb.y + p.y;
    
                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
    
        ctx.stroke();
        ctx.globalAlpha = 1;
    
        if(dots) {
            for (const p of path) {
                ctx.fillStyle = "white";
                ctx.beginPath();
                ctx.arc(cb.x + p.x, cb.y + p.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
    }

    handleEditorClick() {
        const x = this.engine.keyboard.mouseX;
        const y = this.engine.keyboard.mouseY;

        const cols = 4;
        const padding = 10;
        const size = 64;

        const count = this.debug.buttons.length;

        for(let a = 0; a < count; a++) {
            const b = this.debug.buttons[a];
            const y1 = padding+((size+padding)*Math.floor(a/cols));
            const x1 = padding+((size+padding)*a)-(((size+padding)*cols)*Math.floor(a/cols));

            if(Engine.rectanglesIntersect(x, y, 10, 10, x1, y1, size, size)) {
                b.onClick();
            }
        }
        

        if (this.debug.path_active) {
            const cb = this.getCombatBox();

            if(Engine.rectanglesIntersect(this.engine.keyboard.mouseX, this.engine.keyboard.mouseY, 10, 10, cb.x, cb.y, cb.w, cb.h)) {
                const x = this.engine.keyboard.mouseX - cb.x;
                const y = this.engine.keyboard.mouseY - cb.y;
            
                this.debug.drawn_path.push({ x, y });
                return;
            }
        }
        this.debug.is_drawing = true;
    }

    handleEditorRelease() {
        this.debug.is_drawing = false;
    }

    spawnRewards() {
        const cb = this.getCombatBox();
    
        const rewards = this.scenario.rewards || [];
    
        rewards.forEach((reward, i) => {

            if(reward.type == "card") {
                if(!this.combatVariables.victory_status) return;
                const angle = (Math.PI * 2) * (i / rewards.length);

                this.engine.inventory.giveItem(reward);
        
                this.combatVariables.reward_cards.push({
                    reward,
        
                    x: cb.w / 2,
                    y: cb.h / 2,
        
                    angle,
                    radius: 0,
        
                    angularVelocity: 8,
                    radialVelocity: 220,
        
                    rotation: 0,
                    life: 0,
                    final_radius: Math.random()*200,

                    state: "active",
                    alpha: 1,
                    fadeSpeed: 2.5
                });
            } else if(reward.type == "money") {
                if(!this.combatVariables.victory_status) reward.data.amount /= 2;
                this.spawnRewardPellets(
                    cb.w / 2,
                    cb.h / 2,
                    Math.floor(reward.data.amount/10)
                );

                this.engine.inventory.giveItem(reward);
            }
    
            
        });
    }

    updateRewards(delta) {
        this.combatVariables.reward_cards.forEach(card => {

            if (card.state === "fade") {
                card.alpha -= card.fadeSpeed * delta;
        
                if (card.alpha <= 0) {
                    card.alpha = 0;
                    card.state = "dead";
                }
        
                return;
            }
        
            if (card.state !== "active") return;
        
            card.life += delta;
            card.radius += card.radialVelocity * delta;
            card.angle += card.angularVelocity * delta;
        
            if (card.radius > card.final_radius) {
                card.angularVelocity *= 0.9;
                card.radialVelocity *= 0.9;
            }
        
            if (Math.abs(card.angularVelocity) < 0.05) {
                card.angularVelocity = 0;
            }
        
            card.rotation += card.angularVelocity * delta;
        
            card.renderX = Math.cos(card.angle) * card.radius;
            card.renderY = Math.sin(card.angle) * card.radius;
        });

        this.combatVariables.reward_cards = this.combatVariables.reward_cards.filter(c => c.state !== "dead");

        this.updatePellets(delta);
    }

    drawRewards() {
        const ctx = this.engine.ctx;
        const cb = this.getCombatBox();
        const card_size = Card.getSize();

        this.drawPellets();
    
        for (const r of this.combatVariables.reward_cards) {
    
            const cx = cb.x + cb.w / 2 + r.renderX;
            const cy = cb.y + cb.h / 2 + r.renderY;
    
            const card = this.cardManager.getCardFromID(r.reward.data.id);
    
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(r.rotation);
            const scale = r.alpha;
            ctx.scale(scale, scale);
    
            ctx.globalAlpha = r.alpha * Math.min(1, r.life * 3);
    
            ctx.drawImage(
                card.image,
                -card_size.w / 2,
                -card_size.h / 2,
                card_size.w,
                card_size.h
            );

            ctx.strokeStyle = "white";
            ctx.strokeRect(
                -card_size.w / 2,
                -card_size.h / 2,
                card_size.w,
                card_size.h
            )

            ctx.font = "13px monospace"; 
            ctx.fillStyle = "white"; ctx.textAlign = "center"; 
            ctx.textBaseline = "middle";
            ctx.fillText( card.name, (-card_size.w / 2) + Math.floor(card_size.w / 2), (-card_size.h / 2) + card_size.h * 1.1 );

            
    
            ctx.restore();
        }
    }

    getRewardCardCenter(card) {
        const cb = this.getCombatBox();
        return {
            x: cb.x + cb.w / 2 + card.renderX,
            y: cb.y + cb.h / 2 + card.renderY
        };
    }

    isHoveringRewardCard(card, mouseX, mouseY, cb, size) {
        const cx = cb.x + cb.w / 2 + card.renderX;
        const cy = cb.y + cb.h / 2 + card.renderY;
    
        const dx = mouseX - cx;
        const dy = mouseY - cy;
    
        const cos = Math.cos(-card.rotation);
        const sin = Math.sin(-card.rotation);
    
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
    
        return (
            lx >= -size.w / 2 &&
            lx <= size.w / 2 &&
            ly >= -size.h / 2 &&
            ly <= size.h / 2
        );
    }

    spawnRewardPellets(x, y, amount) {
        const pellets = [];
    
        for (let i = 0; i < amount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
    
            pellets.push({
                x,
                y,
    
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
    
                life: 0,
                value: 1,
                radius: 6,
                collected: false
            });
        }
    
        this.combatVariables.pellets.push(...pellets);
    }

    updatePellets(delta) {
        const cb = this.getCombatBox();
        const px = this.engine.keyboard.mouseX - cb.x;
        const py = this.engine.keyboard.mouseY - cb.y;
    
        for (const p of this.combatVariables.pellets) {
            if (p.collected) continue;
    
            p.life += delta;
    
            p.vx *= 0.98;
            p.vy *= 0.98;
    
            p.x += p.vx * delta;
            p.y += p.vy * delta;
    
            const dx = px - p.x;
            const dy = py - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
    
            if (dist < 200) {
                p.vx += (dx / dist) * 500 * delta;
                p.vy += (dy / dist) * 500 * delta;
            }
    
            // pickup range
            if (dist < 20) {
                p.collected = true;
                this.player.money += p.value;
            }
        }
    
        // cleanup
        this.combatVariables.pellets =
            this.combatVariables.pellets.filter(p => !p.collected);
    }

    drawPellets() {
        const ctx = this.engine.ctx;
        const cb = this.getCombatBox();
    
        for (const p of this.combatVariables.pellets) {
            ctx.fillStyle = "gold";
    
            ctx.beginPath();
            ctx.arc(
                cb.x + p.x,
                cb.y + p.y,
                p.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }

    onWin() {
        this.combatVariables.has_won = true;
        this.setBackgroundText("victory");
        this.combatVariables.bg_text_target_opacity = this.combatSettings.bg_text_opacity_prepare+0.1;

        this.combatVariables.victory_status = true;

        this.spawnRewards();
    }

    onDeath() {
        this.combatVariables.has_won = true;
        this.setBackgroundText("defeat");
        this.combatVariables.bg_text_target_opacity = this.combatSettings.bg_text_opacity_prepare+0.1;
        this.spawnRewards();
    }

    applyShadow(ctx, blur=20, color="rgba(0,0,0,0.5)", x=0, y=4) {
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;
        ctx.shadowOffsetX = x;
        ctx.shadowOffsetY = y;
    }

    clearShadow(ctx) {
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    setBackgroundText(text) {
        if(this.combatVariables.bg_text_current == text) return;
    
        this.combatVariables.bg_text_next = text;
        this.combatVariables.bg_text_transition = 0;
    }

    drawBackgroundText(text, angle, alpha, size, color, offsetX=0, offsetY=0) {
        if(this.engine.settings.performance_mode) return;
        const ctx = this.engine.ctx;
        
        ctx.font = `${size}px monospace`;
        const xSpacing = ctx.measureText(text).width + 10; 
        const ySpacing = size + 10;
    
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = alpha;
    
        this.combatVariables.bg_text_offset += 0.002 * (this.combatVariables.timescale*this.combatVariables.bg_text_timescale);
        if (this.combatVariables.bg_text_offset >= 1) {
            this.combatVariables.bg_text_offset = 0;
        }
    
        const currentOffsetX = this.combatVariables.bg_text_offset * xSpacing;
        const currentOffsetY = this.combatVariables.bg_text_offset * ySpacing;
    
        let x_count = Math.ceil(this.engine.camera.width / xSpacing) + 2;
        let y_count = Math.ceil(this.engine.camera.height / ySpacing) + 2;
        
        for(let y = -1; y < y_count; y++) {
            for(let x = -1; x < x_count; x++) {
                ctx.save();
                
                let posX = x * xSpacing + currentOffsetX + offsetX;
                let posY = y * ySpacing + currentOffsetY + offsetY;
                
                ctx.translate(posX, posY);
                ctx.rotate(angle * Math.PI / 180);
                
                ctx.fillText(text, 0, 0);
                ctx.restore();
            }
        }
    
        ctx.globalAlpha = 1;
    }

    render() {
        if(!this.debug.editor) {
            const rawT = this.combatVariables.bg_text_transition;
            const t = rawT * rawT * (3 - 2 * rawT);

            if(this.combatVariables.bg_text_next != null) {

                this.drawBackgroundText(
                    this.combatVariables.bg_text_current,
                    this.combatVariables.bg_text_angle - (t * 2),
                    this.combatVariables.bg_text_opacity * (1 - t),
                    14,
                    this.combatVariables.bg_text_color,
                    0,
                    -20 * t
                );

                this.drawBackgroundText(
                    this.combatVariables.bg_text_next,
                    this.combatVariables.bg_text_angle + ((1 - t) * 2),
                    this.combatVariables.bg_text_opacity * t,
                    14,
                    this.combatVariables.bg_text_color,
                    0,
                    20 * (1 - t)
                );

            } else {

                this.drawBackgroundText(
                    this.combatVariables.bg_text_current,
                    this.combatVariables.bg_text_angle,
                    this.combatVariables.bg_text_opacity,
                    14,
                    this.combatVariables.bg_text_color
                );

            }

            this.renderCombatBox();
            if(this.turn == 0) this.drawActiveSlots();
            else this.drawEditorPath(false, "white", this.scenario.path);
            
            
            this.player.render(this.engine.ctx);
            this.scenario.render();
            
            this.drawUIText();
            this.drawHealthbar()
            this.renderCardsInHand(this.combat_active);
            this.renderDraggedCard();
            this.drawRewardScreen();
            
        } else {
            this.renderCombatBox();
            this.drawEditorButtons();
            this.drawFrequencyGrid();
            this.drawEditorPath(true, "cyan");
            this.drawUIText();
        }
        
    }

    getActiveSlots() {
        const pos = [];
        const cb = this.getCombatBox();

        const card_size = Card.getSize();

        for(let a = 0; a < 3; a++) {
            let x = -20+((card_size.w)*(a*1.1)) + (cb.x + cb.w/4.5) - card_size.w/2;
            let y = (cb.y+cb.h/2) - card_size.h/2;
            pos[a] = {"x": x, "y": y, "w": card_size.w, "h": card_size.h, "i": a}
        }
        return pos;
    }

    drawActiveSlots() {
        const ctx = this.engine.ctx;

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
                `${this.combatSettings.active_keybinds[a].name}`,
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
        this.holograms.forEach(h => {
            h.render(this.engine.ctx, this.getCombatBox());
        })
    }

    drawDropShadow(size, opacity, x, y, w, h, offsetX=0, offsetY=0) {
        if(this.engine.settings.performance_mode) return;
        const ctx = this.engine.ctx;
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity/4})`;
        ctx.fillRect((x+offsetX)-size*1.5, (y+offsetY)-size*1.5, w+size*2, h+size*2);
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity/2})`;
        ctx.fillRect((x+offsetX)-size, (y+offsetY)-size, w+size*1.5, h+size*1.5);
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.fillRect((x+offsetX)-(size/2), (y+offsetY)-(size/2), w+(size*.75), h+(size*.75));
    }

    renderCombatBox() {
        const ctx = this.engine.ctx;
        let cb = this.getCombatBox();

        this.drawDropShadow(80, 0.4, cb.x, cb.y, cb.w, cb.h, 10, 10);

        ctx.strokeStyle = "white";
        ctx.lineWidth = "3";
        ctx.strokeRect(cb.x, cb.y, cb.w, cb.h);

        ctx.fillStyle = "black";
        ctx.fillRect(cb.x, cb.y, cb.w, cb.h);

        if(!this.combat_active) {
            this.drawPreviewOfTurn();
        }
        else this.renderCombat();
    }

    drawRewardScreen() {
        const ctx = this.engine.ctx;
        const cb = this.getCombatBox();
        ctx.fillStyle = `rgba(0, 0, 0, ${this.combatVariables.fade_out_opacity})`
        ctx.fillRect(cb.x, cb.y, cb.w, cb.h)

        this.drawRewards();
    }

    onRelease() {
        const box = this.getCombatBox();
        const card_size = Card.getSize();
        if(this.turn == 1) {
            if(this.card_rendering.dragged_card_in_box) {
                let x = Math.floor(this.engine.keyboard.mouseX - this.card_rendering.drag_point[0]);
                let y = Math.floor(this.engine.keyboard.mouseY - this.card_rendering.drag_point[1]);

                let xmax = box.x + box.w - card_size.w*.7;
                let ymax = box.y + (box.h - (card_size.h*1.15)*.7);
                
                x = clamp(x, box.x-card_size.w*.3, xmax);
                y = clamp(y, box.y-card_size.h*.3, ymax);

                let c = new VisualCard(
                    this.card_rendering.dragged_card,
                    x - box.x,
                    y - box.y
                );
                c.p = this.card_rendering.temporary_projectiles[0];
                c.p.setPosition(
                    x - box.x + (card_size.w / 2),
                    y - box.y + (card_size.h / 2)
                );
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

        if(this.debug.editor) this.handleEditorRelease();
    }

    getCombatBox() {
        return {
            x: (this.engine.camera.width - 500) / 2,
            y: (this.engine.camera.height - 500) / 2,
            w: 500,
            h: 500
        };
    }

    onClick() {
        const x = this.engine.keyboard.mouseX;
        const y = this.engine.keyboard.mouseY;

        if(this.debug.editor) {
            this.handleEditorClick();
        }

        let hand = this.cardManager.getHand();
        const card_size = Card.getSize();

        hand = hand.filter(c =>
            !this.card_rendering.cards
                .map(a => a.card)
                .concat(this.card_rendering.actives.filter(a => a != null))
                .find(b => b.uid === c.uid)
        );

        let skipped = 0;
        const box = this.getCombatBox();

        if(!this.combat_active) {
            for(let x1 = hand.length - 1; x1 >= 0; x1--) {
                const c = hand[x1];
                if(this.card_rendering.cards.map(a => a.card).concat(this.card_rendering.actives.filter(a => a != null)).find(b => b.uid === c.uid) != undefined) {
                    skipped += 1;
                    continue;
                };
    
                if(this.card_rendering.dragged_card == c) {
                    continue;
                }

                const pos = this.getHandCardPosition(
                    x1 - skipped,
                    hand.length - skipped
                );
                
                const cx = pos.x - (card_size.w / 2);
                const cy = pos.y - (card_size.h / 2);
                if(Engine.rectanglesIntersect(x, y, 10, 10, cx, cy, card_size.w, card_size.h)) {
                    let is_usable = c.isTurn(this.turn);
                    if(is_usable) {
                        this.card_rendering.dragged_card = c;
                        this.card_rendering.drag_point = [x - cx, y - cy];
                        if(this.turn == 1) {
                            let p = this.projectiles.createProjectile(
                                cx - box.x,
                                cy - box.y,
                                this.card_rendering.dragged_card.data
                            );
                            this.card_rendering.temporary_projectiles.push(p);
                        }
                    }
                }
            }

            if(this.card_rendering.dragged_card == null) {
                this.card_rendering.cards.forEach(c => {
                    if(Engine.rectanglesIntersect(
                        x, y, 10, 10,
                        box.x + c.x,
                        box.y + c.y,
                        card_size.w,
                        card_size.h
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

        if(this.turn == 0) {
            this.scenario.runPlacingTurn();
            this.setBackgroundText("dodge");
            this.player.iframes = 1;
        } else {
            this.setBackgroundText("watch");
        }

        this.combatVariables.bg_text_target_opacity = this.combatSettings.bg_text_opacity_play;

        this.round_timer = (this.projectiles.getHighestLifespan()-1) || 10;

        this.combat_active = true;
    }

    onRoundEnd() {
        this.combat_active = false;
        this.card_rendering.cards = [];
        this.projectiles.clearProjectiles()
        for(let x = 0; x < this.card_rendering.actives.length; x++) {
            const a = this.card_rendering.actives[x];
            if(a == null) continue;
            if(a.ability.uses <= 0) {
                this.cardManager.discard(a);
                this.card_rendering.actives[x] = null;
            }
        }
        this.turn = this.turn == 0 ? 1 : 0;
        this.round_timer = this.turn == 1 ? this.combatVariables.placing_time : this.combatVariables.placing_time/2;
        this.combatVariables.bg_text_target_opacity = this.combatSettings.bg_text_opacity_prepare;
        this.setBackgroundText("prepare");
        let cb = this.getCombatBox();
        this.player.x = Math.floor(cb.w / 2)
        this.player.y = Math.floor(cb.h / 2)
        this.turn_counter += 1;
        if(this.turn_counter == 2) {
            this.turn_counter = 0;
            this.onTurnCompletion();
        }
        
    }

    combatUpdate(delta) {
        if(this.combatVariables.has_won) {

            if(this.combatVariables.bg_text_next != null) {
                this.combatVariables.bg_text_transition +=
                    this.combatVariables.bg_text_transition_speed * delta;
            
                if(this.combatVariables.bg_text_transition >= 1) {
                    this.combatVariables.bg_text_current =
                        this.combatVariables.bg_text_next;
            
                    this.combatVariables.bg_text_next = null;
                    this.combatVariables.bg_text_transition = 0;
                }
            }
    
            this.combatVariables.bg_text_opacity +=
            (
                this.combatVariables.bg_text_target_opacity -
                this.combatVariables.bg_text_opacity
            ) * this.combatVariables.bg_text_opacity_speed * delta;

            this.combatVariables.fade_out_opacity +=
            (
                1 -
                this.combatVariables.fade_out_opacity
            ) * this.combatVariables.fade_out_opacity_speed * delta;


            const cb = this.getCombatBox();
            const card_size = Card.getSize();
            let mouseX = this.engine.keyboard.mouseX;
            let mouseY = this.engine.keyboard.mouseY;
            this.combatVariables.reward_cards.forEach(card => {
                const hovered = this.isHoveringRewardCard(
                    card,
                    mouseX,
                    mouseY,
                    cb,
                    card_size
                );

                if (hovered && card.state === "active") {
                    card.state = "fade";
                }

            });
            this.updateRewards(delta);

            if(this.combatVariables.reward_cards.length == 0 && this.combatVariables.pellets.length == 0) {
                this.exitCombat();
            }

            
            return;
        }
        delta *= this.combatVariables.timescale
        this.round_timer -= delta;
        if(this.round_timer < 0) {
            if(!this.combat_active) this.onRoundStart();
            else this.onRoundEnd();
        }
        const cb = this.getCombatBox();
        const card_size = Card.getSize();
        this.projectiles.updateProjectiles(delta);
        let mouseX = this.engine.keyboard.mouseX - cb.x;
        let mouseY = this.engine.keyboard.mouseY - cb.y;
        const handZoneY = cb.y + cb.h-(card_size.h*1.5);
        const hoveringHand =
            mouseY > handZoneY && !this.combat_active && this.card_rendering.dragged_card == null && this.card_rendering.dragged_alr_card == null;

        this.combatVariables.hand_hover += (
            (hoveringHand ? 1 : 0) -
            this.combatVariables.hand_hover
        ) * this.combatVariables.hand_hover_speed * delta;
        if(this.card_rendering.dragged_card != null) {
            let dcx = Math.floor(
                mouseX -
                this.card_rendering.drag_point[0]
            );
    
            let dcy = Math.floor(
                mouseY -
                this.card_rendering.drag_point[1]
            );

            let in_box = Engine.rectanglesIntersect(dcx+cb.x, dcy+cb.y, card_size.w, card_size.h, 
                cb.x,
                cb.y,
                cb.w,
                cb.h
            )
    
            this.card_rendering.temporary_projectiles.forEach(p => {
                if(in_box) p.visible = true;
                else p.visible = false;
                p.setPosition(dcx + card_size.w/2, dcy + card_size.h/2)
            });
        }

        if(this.card_rendering.dragged_alr_card != null) {
            const cb = this.getCombatBox();

            let dcx = Math.floor(this.engine.keyboard.mouseX - cb.x - this.card_rendering.drag_point[0]);
            let dcy = Math.floor(this.engine.keyboard.mouseY - cb.y - this.card_rendering.drag_point[1]);

            dcx = clamp(dcx, -card_size.w*.3, cb.w - card_size.w*.7);
            dcy = clamp(dcy, -card_size.h*.3, cb.h - ((card_size.h)*1.15)*.7);

            this.card_rendering.dragged_alr_card.x = dcx;
            this.card_rendering.dragged_alr_card.y = dcy;

            this.card_rendering.dragged_alr_card.p.setPosition(
                dcx + card_size.w/2,
                dcy + card_size.h/2
            );
        }

        let dirx = 0, diry = 0;
        if (this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.LEFT_ARROW) || this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.A_KEY)) { dirx += -1; }
        if (this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.RIGHT_ARROW) || this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.D_KEY)) { dirx += 1; }
        if (this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.UP_ARROW) || this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.W_KEY)) { diry += -1; }
        if (this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.DOWN_ARROW) || this.engine.keyboard.isDown(this.engine.keyboard.KEYCODES.S_KEY)) { diry += 1; }

        if(this.combat_active) this.player.move(delta, dirx, diry);

        if(this.debug.editor) {
            if (this.debug.is_drawing && !this.debug.path_active) {
                const mouseX = this.engine.keyboard.mouseX - cb.x;
                const mouseY = this.engine.keyboard.mouseY - cb.y;
            
                const gridX = Math.floor(mouseX / this.debug.grid_size);
                const gridY = Math.floor(mouseY / this.debug.grid_size);
            
                const grid = this.debug.freq_grids.find(
                    g => g.id == this.debug.selected_id
                );
            
                if (!grid) return;
            
                const cols = Math.floor(cb.w / this.debug.grid_size);
                const brush = this.debug.brush_size;
            
                for (let dy = -brush; dy <= brush; dy++) {
                    for (let dx = -brush; dx <= brush; dx++) {
            
                        const x = gridX + dx;
                        const y = gridY + dy;
            
                        if (x < 0 || y < 0) continue;
                        if (x >= cols) continue;
            
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > brush) continue; 
            
                        const index = y * cols + x;
            
                        grid.data[index] = this.debug.selected_num;
                    }
                }
            }
        }

        if(this.combat_active) {
            if(this.turn == 0) this.player.update(delta);
            else this.scenario.dodgingUpdate(delta);
        };

        if(this.combatVariables.bg_text_next != null) {
            this.combatVariables.bg_text_transition +=
                this.combatVariables.bg_text_transition_speed * delta;
        
            if(this.combatVariables.bg_text_transition >= 1) {
                this.combatVariables.bg_text_current =
                    this.combatVariables.bg_text_next;
        
                this.combatVariables.bg_text_next = null;
                this.combatVariables.bg_text_transition = 0;
            }
        }
        

        this.holograms.forEach(h => {
            h.update(delta);
        });

        // smooth fade
        this.combatVariables.bg_text_opacity +=
        (
            this.combatVariables.bg_text_target_opacity -
            this.combatVariables.bg_text_opacity
        ) * this.combatVariables.bg_text_opacity_speed * delta;


        if(!this.engine.settings.performance_mode) {
            document.body.style.cursor = "default";
            if(this.card_rendering.dragged_card != null) {
            document.body.style.cursor = "grabbing";
            } else {
                let hand = this.cardManager.getHand();
                hand = hand.filter(c =>
                    !this.card_rendering.cards
                        .map(a => a.card)
                        .concat(this.card_rendering.actives.filter(a => a != null))
                        .find(b => b.uid === c.uid)
                );
                let skipped = 0;
                for(let x1 = hand.length - 1; x1 >= 0; x1--) {
                    const c = hand[x1];
                    if(this.card_rendering.cards.map(a => a.card).concat(this.card_rendering.actives.filter(a => a != null)).find(b => b.uid === c.uid) != undefined) {
                        skipped += 1;
                        continue;
                    };
        
                    if(this.card_rendering.dragged_card == c) {
                        continue;
                    }

                    const pos = this.getHandCardPosition(
                        x1 - skipped,
                        hand.length - skipped
                    );
                    
                    const cx = pos.x - (card_size.w / 2);
                    const cy = pos.y - (card_size.h / 2);
                    if(Engine.rectanglesIntersect(this.engine.keyboard.mouseX, this.engine.keyboard.mouseY, 10, 10, cx, cy, card_size.w, card_size.h)) {
                        let is_usable = c.isTurn(this.turn);
                        if(is_usable) {
                            document.body.style.cursor = "grab";
                        } else {
                            document.body.style.cursor = "not-allowed";
                        }
                    }
                }
            }
        }
    }

    onTurnCompletion() {
        this.cardManager.drawCard(5);
        this.scenario.cardManager.drawCard(5);
    }

    reset(scenario) {
        this.setupVariables();
        this.debug.scen_data = scenario;
        this.scenario = new CombatScenario(scenario, this);
        this.engine.state = "combat";
        this.in_combat = true;
        this.setBackgroundText("prepare");
        let cb = this.getCombatBox();
        this.player.reset();
        this.cardManager.resetHand();
        this.player.x = Math.floor(cb.w / 2)
        this.player.y = Math.floor(cb.h / 2)
        
        this.onTurnCompletion();
        this.round_timer = this.turn == 1 ? this.combatVariables.placing_time : this.combatVariables.placing_time/2;
    }

    enterCombat(scenario) {
        this.engine.renderer.applyEffect("fadeOutIn", {"ms": 1200, "blackTime": 100});
        setTimeout(() => {
            this.reset(scenario)
        }, 650)
    }

    exitCombat() {
        this.engine.renderer.applyEffect("fadeOutIn", {"ms": 1200, "blackTime": 100});
        this.in_combat = false;
        setTimeout(() => {
            this.engine.state = "main";
            this.engine.setKeybinds();
        }, 650);
        
    }
}

export class CombatPlayer {
    constructor(x, y, combat) {
        this.x = x; this.y = y; 
        this.velx = 0; this.vely = 0;
        this.accx = 0; this.accy = 0;
        this.maxspeed = 1000;
        
        this.visible = false;
        this.combat = combat; this.size = {"w": 20, "h": 20};
        this.iframes = 0; this.maxhealth = 5; this.health = this.maxhealth;
        this.afterimages = [];
    }

    onProjectileCollision(proj) {
        if(this.iframes == 0) {
            this.damage();
        }
    }

    damage() {
        this.health -= 1;
        if(this.health <= 0) {
            this.onDeath();
            return;
        }
        this.iframes = 1;
        let h = new Hologram(
            this.x, this.y, 1.5, "red", true, 15, `-1`
        );
        h.on_update = () => {
            h.y -= 1;
        }
        this.combat.holograms.push(h);
    }

    onDeath() {
        this.combat.onDeath();
    }

    render(context) {
        const cb = this.combat.getCombatBox();
        if(!this.combat.combat_active || this.combat.turn == 1) return;

        if(!this.combat.engine.settings.performance_mode) {
            for (const img of this.afterimages) {
                const alpha = img.life / 0.25;
        
                context.fillStyle = `rgba(0, 0, 255, ${alpha * 0.5})`;
        
                context.fillRect(
                    img.x + cb.x,
                    img.y + cb.y,
                    this.size.w,
                    this.size.h
                );
            }
        }
        

        context.fillStyle = `rgba(0, 0, 255, ${this.iframes == 0 ? "1" : "0.4"})`;
        context.fillRect(this.x + cb.x, this.y + cb.y, this.size.w, this.size.h);
    }

    reset() {
        this.health = this.maxhealth;
    }

    getCenter() {
        return {"x": this.x+this.size.w, "y": this.y+this.size.h}
    }

    addForce(force) {
        this.velx += force.x; this.vely += force.y;
    };

    move(delta, dirx, diry, accel=3000) {

        if (dirx !== 0 || diry !== 0) {
            const len = Math.hypot(dirx, diry);
    
            dirx /= len;
            diry /= len;
        }

        this.accx += dirx * accel;
        this.accy += diry * accel;

        this.lastDirX = dirx;
        this.lastDirY = diry;
    }
    
    update(delta) {
        const cb = this.combat.getCombatBox();

        if(!this.combat.engine.settings.performance_mode) {
            const speed = Math.hypot(this.velx, this.vely);

            if (speed > 450) {
                this.afterimages.push({
                    x: this.x,
                    y: this.y,
                    life: .25
                });
            }

            for (let i = this.afterimages.length - 1; i >= 0; i--) {
                const img = this.afterimages[i];

                img.life -= delta;

                if (img.life <= 0) {
                    this.afterimages.splice(i, 1);
                }
            }
        }
        
    
        const maxX = cb.w - this.size.w;
        const maxY = cb.h - this.size.h;
    
        this.velx += this.accx * delta;
        this.vely += this.accy * delta;
    
        // friction
        this.velx *= 0.85;
        this.vely *= 0.85;
    
        this.x += this.velx * delta;
        this.y += this.vely * delta;
    
        this.accx = 0;
        this.accy = 0;
    
        this.x = Math.max(0, Math.min(this.x, maxX));
        this.y = Math.max(0, Math.min(this.y, maxY));

        if(this.iframes > 0) {
            this.iframes -= delta;
        }
        if(this.iframes < 0) this.iframes = 0;
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
        this.activeInPreview = this.settings.activeInPreview || false;
    }

    init() {
        switch(this.type) {
            case "circle": {
                this.data.angle = Math.random()*360;
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
                        let target = this.projectile.combat.player.getCenter();
                        if(this.projectile.combat.turn == 1) {
                            target = this.projectile.combat.scenario.getCenter();
                        }
                    
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
                        const turnSpeed = this.settings.turnSpeed ?? 5;
                        const alpha = 1 - Math.exp(-turnSpeed * delta);

                        this.data.velocity.x += (targetVX - this.data.velocity.x) * alpha;
                        this.data.velocity.y += (targetVY - this.data.velocity.y) * alpha;
                    
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
        this.clamp_to_box = false;
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

        const hb = this.getHitbox();

        if(this.combat.combat_active) {
            if(this.combat.turn == 0) {
                if(
                    Engine.rectanglesIntersect(hb.x, hb.y, hb.w, hb.h, 
                    this.combat.player.x, this.combat.player.y, this.combat.player.size.w, this.combat.player.size.h)
                ) {
                    this.combat.player.onProjectileCollision(this);
                }
            } else {
                if(
                    Engine.rectanglesIntersect(hb.x, hb.y, hb.w, hb.h, 
                    this.combat.scenario.x, this.combat.scenario.y, this.combat.scenario.size.w, this.combat.scenario.size.h)
                ) {
                    this.combat.scenario.onProjectileCollision(this);
                }
            }
        }
    };

    render(ctx) {
        const cb = this.combat.getCombatBox();
        let o = (1-this.spent_life/this.settings.lifespan) + 0.3;

        ctx.globalAlpha = clamp(o, .5, 1);

        ctx.save()

        ctx.beginPath();
        ctx.rect(
            cb.x,
            cb.y,
            cb.w,
            cb.h
        );

        ctx.clip();
    
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
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    getHitbox() {
        return {
            "x": this.x,
            "y": this.y,
            "w": this.settings.size,
            "h": this.settings.size
        }
    }
}