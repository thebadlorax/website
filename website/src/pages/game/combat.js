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

export class CardManager {
    constructor() {
        this.cards = [];
        this.deck = [];
    };

    getCardFromID(id) { return this.cards.find(c => c.id == id); };

    getDeck() {
        let d = this.deck.map(dc => this.getCardFromID(dc));
        return d
    }

    addToDeck(...ids) { ids.forEach(id => this.deck.push(id)) };

    getAllCardsOfType(type) { return this.cards.filter(c => c.type == type); };
}

export class CombatManager {
    constructor(cm, engine) {
        this.cardManager = cm;
        this.engine = engine;

        this.in_combat = false;
        this.turn = false; // false = dodging, true = placing
        this.card_rendering = {
            "dragged_card": null,
            "drag_point": null
        }
    }

    rendeCardsInHand() {
        const ctx = this.engine.renderer.ctx;
        const deck = this.cardManager.getDeck();
        const card_size = 128;
        for(let x = 0; x < deck.length; x++) {
            const c = deck[x];
            let cx, cy;
            let dcx, dcy;
            let is_dragged = c.id == this.card_rendering.dragged_card;
            if(is_dragged) {
                dcx = Math.floor(this.engine.keyboard.mouseX-this.card_rendering.drag_point[0]);
                dcy = Math.floor(this.engine.keyboard.mouseY-this.card_rendering.drag_point[1]);
            }
            cx = 10+(card_size*x)+(x*10);
            cy = 10;

            if(this.card_rendering.dragged_card == c.id) {
                ctx.fillStyle = "rgba(0, 255, 255, 0.1)"
                ctx.fillRect(cx, cy, card_size, card_size);
                ctx.strokeStyle = "rgba(0, 255, 255, 0.1)"
                ctx.strokeRect(cx, cy, card_size, card_size);
            }

            ctx.strokeStyle = "white";
            ctx.strokeRect(
                is_dragged ? dcx : cx, 
                is_dragged ? dcy : cy, 
                card_size, card_size);
            ctx.drawImage(
                    c.image, 
                    is_dragged ? dcx : cx, 
                    is_dragged ? dcy : cy
            );
        }
    }

    renderCombatBox() {
        let combatWidth = 500;
        let combatHeight = 500;
        let x = (this.engine.camera.width - combatWidth) / 2;
        let y = (this.engine.camera.height - combatHeight) / 2;
        x = clamp(x, 256, this.engine.camera.width)
        this.engine.ctx.strokeStyle = "white";
        this.engine.ctx.lineWidth = "3";
        this.engine.ctx.strokeRect(x, y, combatWidth, combatHeight);
    }

    onRelease() {
        this.card_rendering.dragged_card = null;
        this.card_rendering.drag_point = null;
    }

    onClick() {
        const x = this.engine.keyboard.mouseX;
        const y = this.engine.keyboard.mouseY;

        const deck = this.cardManager.getDeck();
        const card_size = 128;

        for(let x1 = 0; x1 < deck.length; x1++) {
            const c = deck[x1]
            let cx, cy;
            cx = 10+(card_size*x1)+(x1*10);
            cy = 10;
            if(Engine.rectanglesIntersect(x, y, 10, 10, cx, cy, card_size, card_size)) {
                this.card_rendering.dragged_card = c.id;
                this.card_rendering.drag_point = [x - cx, y - cy];
            }
        }
    }

    combatUpdate(delta) {
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