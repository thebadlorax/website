/**
 * author thebadlorax
 * created on 24-02-2026-16h-51m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { range, generateRandomString } from "./utils";
import { type User, JSONToUser } from "./auth";
import { type ServerWebSocket } from "bun";
import { LogWizard } from "./logging";

type ConnectedPlayer = {
    user: User;
    hand: Array<number>;
}

export class Deck {
    public cards: Array<number>;
    public id: string = generateRandomString(10)
    private log: LogWizard = new LogWizard();
    constructor() {
        this.cards = [...range(0, 52)];
        this.log.log(`Deck initalized with id ${this.id}`, "GAMES")
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

export class BlackjackInstance {
    public players: Map<ServerWebSocket<{ source: string; }>, ConnectedPlayer> = new Map();
    public spectators: Array<ServerWebSocket<{ source: string; }>> = new Array();
    private deck: Deck = new Deck()
    protected log: LogWizard = new LogWizard();
    public id: string = generateRandomString(15);
    public is_active: boolean = false;

    constructor() { this.log.log(`Blackjack instance initalized with id ${this.id}`, "GAMES"); }

    registerSpectator(ws: ServerWebSocket<{ source: string; }>) {
        this.spectators.push(ws);
        this.sendStateToSpectator(ws);
    }

    registerPlayer(user: User, ws: ServerWebSocket<{ source: string; }>) {
        let cu: ConnectedPlayer = {
            user: user,
            hand: new Array()
        }
        this.spectators.splice(this.spectators.indexOf(ws));
        this.players.set(ws, cu);
        this.updatePlayersOnState();
        return cu;
    };

    reset() {
        this.log.log(`Blackjack instance ${this.id} is restarting`, "GAMES");
        this.deck.shuffle();
        this.players.keys().forEach(ws => { this.deregisterPlayer(ws); });
        this.is_active = false;
    }

    deregisterPlayer(ws: ServerWebSocket<{ source: string; }>) { 
        if(this.players.delete(ws)) { this.spectators.push(ws); this.updatePlayersOnState(); if(this.players.size <= 0 && this.is_active) this.reset(); } 
    }

    broadcast(msg: string) { this.players.keys().forEach(ws => { ws.send(msg); }); }

    drawCard(ws: ServerWebSocket<{ source: string; }>) { 
        this.players.get(ws)!.hand.push(this.deck.draw()!); 
        this.updatePlayersOnState(); 
    }

    protected evaluateHand(ws: ServerWebSocket<{ source: string; }>) { 
        let value = 0;
        this.players.get(ws)!.hand.forEach(card => { value += card });
        return value;
    }

    protected _formatHand(hand: Array<number>, hide: boolean) {
        let final_hand = ""
        hand.forEach(card => {
            if(hide) final_hand += "*"
            else final_hand += card;
        });
        return final_hand;
    }

    protected _formatPlayer(cu: ConnectedPlayer, hideHand: boolean = true) {
        return {
            "name": cu.user.account.name,
            "id": cu.user.account.id,
            "points": cu.user.statistics.points,
            "display_name": cu.user.settings.display_name,
            "color": cu.user.settings.color,
            "hand": this._formatHand(cu.hand, hideHand)
        }
    }

    protected _getBaseState() {
        return {"is_active": this.is_active, "players": [] as Array<Record<string, any>>}
    }

    protected sendStateToPlayer(ws: ServerWebSocket<{ source: string; }>) {
        let state = this._getBaseState();
        let cu = this.players.get(ws);
        this.players.values().forEach(player => { state.players.push(player == cu ? this._formatPlayer(player, false) : this._formatPlayer(player)); })
        ws.send(`state;${JSON.stringify(state)}`);
    }

    protected sendStateToSpectator(ws: ServerWebSocket<{ source: string; }>) {
        let state = this._getBaseState();
        this.players.values().forEach(player => { state.players.push(this._formatPlayer(player, false)); }) // show spectators all hands (maybe remove to prevent ghosting)
        ws.send(`state;${JSON.stringify(state)}`);
    }

    startGame() {
        if(this.is_active) return;
        this.is_active = true;
        this.log.log(`Starting blackjack instance ${this.id}`, "GAMES")
        this.updatePlayersOnState();
        this.broadcast(`start;{}`)
    }

    updatePlayersOnState() { this.players.keys().forEach(ws => { this.sendStateToPlayer(ws) }); this.spectators.forEach(spc => { this.sendStateToSpectator(spc)}) }

    updatePlayerUser(ws: ServerWebSocket<{ source: string; }>, u: User) {
        let user = this.players.get(ws);
        if(!user) { this.log.log("Unknown websocket tried to update their player", "BLACKJACK"); return; }
        user.user = u;
        this.players.set(ws, {
            user: u,
            hand: user.hand
        });
        this.updatePlayersOnState();
    }

    handleRecieved(ws: ServerWebSocket<{ source: string; }>, rec: string) {
        const method = rec.slice(0, rec.indexOf(";"));
        let json;
        try { json = JSON.parse(rec.slice(rec.indexOf(";")+1)); }
        catch { return; }
        switch (method) {
            case "join": this.registerPlayer(JSONToUser(json.user), ws); break;
            case "leave": this.deregisterPlayer(ws); break;
            case "update": this.updatePlayerUser(ws, json.user); break;
            case "start": this.startGame(); break;
        }
    }

    handleConnection(ws: ServerWebSocket<{ source: string; }>) {
        this.registerSpectator(ws);
    }
}