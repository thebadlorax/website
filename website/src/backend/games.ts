/**
 * author thebadlorax
 * created on 24-02-2026-16h-51m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { range, generateRandomString, clamp } from "./utils";
import { type User, JSONToUser, AuthorizationWizard } from "./auth";
import { type ServerWebSocket } from "bun";
import { LogWizard } from "./logging";
import { Database } from "./db";

const cardValues: Map<number, number> = new Map([
    [0, 11],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
    [10, 10],
    [11, 10],
    [12, 10],
    [13, 11],
    [14, 2],
    [15, 3],
    [16, 4],
    [17, 5],
    [18, 6],
    [19, 7],
    [20, 8],
    [21, 9],
    [22, 10],
    [23, 10],
    [24, 10],
    [25, 10],
    [26, 11],
    [27, 2],
    [28, 3],
    [29, 4],
    [30, 5],
    [31, 6],
    [32, 7],
    [33, 8],
    [34, 9],
    [35, 10],
    [36, 10],
    [37, 10],
    [38, 10],
    [39, 11],
    [40, 2],
    [41, 3],
    [42, 4],
    [43, 5],
    [44, 6],
    [45, 7],
    [46, 8],
    [47, 9],
    [48, 10],
    [49, 10],
    [50, 10],
    [51, 10],
]);

type ConnectedPlayer = {
    user: User;
    hand: Array<number>;
    bet: number;
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

    public static getCardValue(cardIndex: number) {
        return cardValues.get(cardIndex);
    }
}

export class BlackjackInstance {
    public players: Map<ServerWebSocket<{ source: string; }>, ConnectedPlayer> = new Map();
    public spectators: Array<ServerWebSocket<{ source: string; }>> = new Array();
    private deck: Deck = new Deck()
    protected log: LogWizard = new LogWizard();
    public id: string = generateRandomString(15);
    public is_active: boolean = false;
    protected turn: number = 0;
    protected dealerHand: Array<number> = new Array();
    protected roundIsOver: boolean = false;
    protected auth: AuthorizationWizard = new AuthorizationWizard(new Database("database.json"));

    constructor() { this.log.log(`Blackjack instance initalized with id ${this.id}`, "GAMES"); }

    registerSpectator(ws: ServerWebSocket<{ source: string; }>) {
        this.spectators.push(ws);
        this.sendStateToSpectator(ws);
    }

    registerPlayer(user: User, ws: ServerWebSocket<{ source: string; }>) {
        let cu: ConnectedPlayer = {
            user: user,
            hand: new Array(),
            bet: -1
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
        this.dealerHand = new Array();
    }

    soft_reset() {
        this.turn = 0;
        this.dealerHand = new Array();
        this.roundIsOver = false;
        this.players.keys().forEach(ws => {
            this.players.get(ws)!.hand = new Array();
            this.players.get(ws)!.bet = 0;
        });/*
        this._drawDealerCard();
        this._drawDealerCard();*/
    }

    deregisterPlayer(ws: ServerWebSocket<{ source: string; }>) { 
        if(this.players.get(ws)?.bet! > 0 && !this.roundIsOver) {
            this.modifyPoints(this.players.get(ws)!.user, this.players.get(ws)!.bet*-1); 
        }
        if(this.players.delete(ws)) { 
            this.spectators.push(ws); 
            if(this.players.size <= 0 && this.is_active) this.reset(); 
            this.updatePlayersOnState();} 
    }

    broadcast(msg: string) { this.players.keys().forEach(ws => { ws.send(msg); }); }

    drawCard(ws: ServerWebSocket<{ source: string; }>, supress_update: boolean = false) { 
        let card = this.deck.draw()!
        this.players.get(ws)!.hand.push(card);
        if(!supress_update) this.updatePlayersOnState();
    }

    protected sumNumArray(arr: Array<number>) {
        let val = 0;
        arr.forEach(num => {
            val += num;
        })
        return val;
    }

    protected evaluateHand(hand: Array<number>) { 
        let cardValues: Array<number> = new Array();
        hand.forEach(card => { 
            let cardValue = Deck.getCardValue(card);
            if(cardValue) {
                cardValues.push(cardValue);
            }
        });
        let value = this.sumNumArray(cardValues);
        while(value > 21) {
            if(!cardValues.includes(11)) break;
            cardValues[cardValues.indexOf(11)] = 1
            value = this.sumNumArray(cardValues);
        }
        return value;
    }

    protected _formatHand(hand: Array<number>, hide: boolean) {
        let final_hand = ""
        hand.forEach(card => {
            if(hide) final_hand += "*;"
            else final_hand += `${card};`;
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
            "hand": this._formatHand(cu.hand, hideHand),
            "hand_value": hideHand ? -1 : this.evaluateHand(cu.hand)
        }
    }

    protected _formatDealerHand(hide: boolean) {
        let final_hand = `${this.dealerHand.at(0)};`
        let hand = this.dealerHand;
        hand.slice(1).forEach(card => {
            if(hide) final_hand += "*;"
            else final_hand += `${card};`;
        });
        return final_hand;
    }

    protected _evaluate_dealer_hand(hide: boolean) {
        let cardValues: Array<number> = new Array();
        let hand = hide ? this.dealerHand.slice(0, 1) : this.dealerHand;
        hand.forEach(card => { 
            let cardValue = Deck.getCardValue(card);
            if(cardValue) {
                cardValues.push(cardValue);
            }
        });
        let value = this.sumNumArray(cardValues);
        while(value > 21) {
            if(!cardValues.includes(11)) break;
            cardValues[cardValues.indexOf(11)] = 1
            value = this.sumNumArray(cardValues);
        }
        return value;
    }

    protected _getBaseState() {
        return {"is_active": this.is_active, "players": [] as Array<Record<string, any>>, "index": -1, "turn": this.turn, "dealer": this._formatDealerHand(!this.roundIsOver), "dealer_value": this._evaluate_dealer_hand(!this.roundIsOver)}
    }

    protected sendStateToPlayer(ws: ServerWebSocket<{ source: string; }>) {
        let state = this._getBaseState();
        let cu = this.players.get(ws);
        if(cu) state.index = this.players.values().toArray().indexOf(cu);
        this.players.values().forEach(player => { state.players.push(player == cu ? this._formatPlayer(player, false) : this._formatPlayer(player, !this.roundIsOver)); })
        ws.send(`state;${JSON.stringify(state)}`);
    }

    protected sendStateToSpectator(ws: ServerWebSocket<{ source: string; }>) {
        let state = this._getBaseState();
        this.players.values().forEach(player => { state.players.push(this._formatPlayer(player, false)); }) // show spectators all hands (maybe remove to prevent ghosting)
        ws.send(`state;${JSON.stringify(state)}`);
    }

    protected handleStartOfTurn() {
        this.turn = 0;
        this.players.keys().forEach(ws => {
            this.players.get(ws)!.hand = new Array();
            this.drawCard(ws, true);
            this.drawCard(ws, true);
        });
        this._drawDealerCard();
        this._drawDealerCard();
        this.updatePlayersOnState();
    }

    startGame() {
        if(this.is_active) return;
        this.is_active = true;
        this.log.log(`Starting blackjack instance ${this.id}`, "GAMES")
        this.turn = 0;
        this.dealerHand = new Array();
        this.broadcast(`start;{}`)
        this.broadcast(`bet;{}`)
    }

    protected _drawDealerCard() {
        let card = this.deck.draw()!
        this.dealerHand.push(card);
    }

    protected _runDealer() {
        let value = this.evaluateHand(this.dealerHand);
        while(value < 17) {
            this._drawDealerCard();
            value = this.evaluateHand(this.dealerHand);
        }
    }

    advanceTurn(ws: ServerWebSocket<{ source: string; }>) {
        if(this.players.values().toArray().indexOf(this.players.get(ws)!) != this.turn) return;
        if(this.turn >= this.players.size-1) { //.size is 1 base
            this._runDealer();
            // evaluate bets
            this.roundIsOver = true;
            this.players.keys().forEach(async ws => { this.scorePlayer(ws); });
            this.players.values().forEach(u => u.bet = 0);
            this.updatePlayersOnState();
            ws.send(`round;{}`)
            setTimeout(() => { this.broadcast(`reset;{}`); this.soft_reset(); this.updatePlayersOnState(); this.broadcast(`bet;{}`);}, 3000);
            return;
        }
        this.turn += 1;
        this.updatePlayersOnState();
    }

    hasWon(checking: number, opponent: number) {
        if(checking == opponent) return null;      // both are the same : nothing
        else if(checking > 21) return false;       // player bust       : lose
        else if(opponent > 21) return true;        // opponent bust     : win
        else if(checking > opponent) return true;  // player has more   : win
        else if(checking < opponent) return false; // player has less   : lose
    }

    protected scorePlayer = async (ws: ServerWebSocket<{ source: string; }>) => {
        let player = this.players.get(ws);
        if(!player) return;
        let dealer_value = clamp(this.evaluateHand(this.dealerHand), 0, 22)
        let value = clamp(this.evaluateHand(player.hand), 0, 22)

        let won = this.hasWon(value, dealer_value);
        if(won == null) return;
        else if(won) this.modifyPoints(player.user, Math.round(player.bet*0.5));
        else if(!won) this.modifyPoints(player.user, -player.bet);

    }

    modifyPoints = async (user: User, amt: number) => await this.auth.changePoints(user.account.name, user.account.pass, amt)

    protected handleBetTurn(ws: ServerWebSocket<{ source: string; }>, amt: number) {
        if(this.players.values().toArray().indexOf(this.players.get(ws)!) != this.turn) return;
        this.players.get(ws)!.bet = amt;
        ws.send(`accepted;{}`)
        if(this.turn >= this.players.size-1) {
            this.handleStartOfTurn();
            this.updatePlayersOnState();
            this.broadcast(`play;{}`)
            return;
        }
        this.turn += 1;
        this.updatePlayersOnState();
    }

    updatePlayersOnState() { this.players.keys().forEach(ws => { this.sendStateToPlayer(ws) }); this.spectators.forEach(spc => { this.sendStateToSpectator(spc)}) }

    updatePlayerUser(ws: ServerWebSocket<{ source: string; }>, u: User) {
        let user = this.players.get(ws);
        if(!user) { this.log.log("Unknown websocket tried to update their player", "BLACKJACK"); return; }
        user.user = u;
        this.players.set(ws, {
            user: u,
            hand: user.hand,
            bet: user.bet
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
            case "draw": if(!this.roundIsOver) this.drawCard(ws); break;
            case "stand": if(!this.roundIsOver) this.advanceTurn(ws); break;
            case "bet": if(!this.roundIsOver) this.handleBetTurn(ws, json.amt); break;
        }
    }

    handleConnection(ws: ServerWebSocket<{ source: string; }>) {
        this.registerSpectator(ws);
    }
}