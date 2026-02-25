/**
 * author thebadlorax
 * created on 24-02-2026-16h-51m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { range } from "./utils";
import { type ServerWebSocket } from "bun";

export type blackjackInstance = {
    players: Map<ServerWebSocket<{ source: string}>, Array<string>>;
    deck: Deck;
    isStarted: boolean;
}

export class Deck {
    public cards: Array<number>;
    constructor() {
        this.cards = [...range(0, 52)];
    }
  
    public draw() {
        if(this.cards.length == 0) {
          this.shuffle();
        };
        let card = this.cards[Math.floor(Math.random() * this.cards.length)];
        this.cards = this.cards.filter(num => num !== card); 
        return card;
    }
  
    public shuffle() {
        this.cards = [...range(0, 52)];
    }
}