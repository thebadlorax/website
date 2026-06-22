/**
 * author thebadlorax
 * created on 24-02-2026-16h-51m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { range, generateRandomString, sumNumArray, mergeDicts } from "./utils";
import { type User, AuthorizationWizard } from "./auth";
import { type ServerWebSocket } from "bun";
import { LogWizard } from "./logging";
import { Database } from "./db";

const player_name_positions = [[70, 20], [80, 30], [83, 50], [81, 70], [69, 80], [61, 47]]
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

export class Deck {
    public cards: Array<number>;
    public id: string = generateRandomString(10)
    private log: LogWizard = new LogWizard();
    constructor() {
        this.cards = [...range(0, 52)];
        //this.log.log(`Deck initalized with id ${this.id}`, "GAMES")
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

    public static evaluateHand(hand: Array<number>): number {
        let ace_count = 0
        let values: Array<number> = []
        hand.forEach(c => {
            let v = Deck.getCardValue(c);
            if(!v) return;
            if(v == 11) ace_count += 1;
            else values.push(v);
        });
        while(ace_count > 0) {
            values.push(sumNumArray(values)+11 <= 21 ? 11 : 1);
            ace_count -= 1;
        }
        return sumNumArray(values);
    }
}

class Packet {
    static fromFormatted(formatted: string) {
        try {
            let f = atob(formatted).split(Packet.seperator);
            return new Packet(
                f[0]!,
                JSON.parse(f[1]!)
            )
        } catch {
            new LogWizard().error("failure to decode packet", "PACKET", "DECODE")
        }
        
    }
    static seperator = ";"
    public type: string; public data: any;
    constructor(type: string, data: any) {
        this.type = type; this.data = data;
    }

    format() {
        return btoa(`${this.type}${Packet.seperator}${JSON.stringify(this.data)}`)
    }

    getResponse(status: number, data: any = {}) {
        return new Packet(this.type, {"status": status, "data": data});
    }
}

class UIEvent {
    static fromJSON(json: string) {
        let f = JSON.parse(json);
        return new UIEvent(
            f.type,
            f.data
        )
    }
    public type: string;
    public data: any;
    constructor(type: string, data: any) {
        this.type = type; this.data = data;
    }
}

class ClientUIElement {
    public type: string;
    public x: number;
    public y: number;
    public data: any;
    public id: string = `ui_${generateRandomString(5)}`;
    public value: any = null;
    public visible: boolean = true;
    protected listeners: Map<string, Array<(event: UIEvent) => void>>
    constructor(type: string, x: number, y: number, data: any) {
        this.type = type;
        this.x = x; this.y = y;
        this.data = data;

        this.listeners = new Map();
    }

    addEventListener(type: string, fn: (event: UIEvent) => void) {
        if(!this.listeners.has(type)) this.listeners.set(type, new Array());
        this.listeners.get(type)?.push(fn);
    }

    handleEvent(type: string, event: UIEvent) {
        if(type == "change") { this.value = parseInt(event.data.value); }
        let e = this.listeners.get(type);
        if(!e) return;
        e.forEach(a => a(event))
    } 

    protected format() {
        return {
            "x": this.x,
            "y": this.y,
            "type": this.type,
            "data": this.data,
            "id": this.id,
            "value": this.value,
            "visible": this.visible,
            "listeners": this.listeners.keys().toArray()
        }
    }

    getCreationPacket() {
        return new Packet("createUI", this.format())
    }

    getDestructionPacket() {
        return new Packet("destroyUI", {"id": this.id})
    }

    getUpdatePacket() {
        return new Packet("updateUI", this.format())
    }

    getVisiblityPacket(visible: boolean) {
        this.visible = visible;
        return this.getUpdatePacket();
    }
}

const DefaultGameInstanceSettings = () => { return {
    monopoly_money: false,
    starting_money: null,
    max_players: 5
} as GameInstanceSettings }
type GameInstanceSettings = {
    monopoly_money: boolean,
    starting_money: number | null,
    max_players: number
}

class GameInstance {
    public clients: Array<Client> = new Array();
    protected log: LogWizard = new LogWizard();
    public id: string = `gi_${generateRandomString(5)}`
    public type: string;
    public owner: Client;
    public deck: Deck = new Deck();
    public markedForDestruction: boolean = false;
    public started: boolean = false;
    public can_join: boolean = true;
    public turn_index: number = -1;

    public settings: GameInstanceSettings;
    protected casino: CasinoWizard;
    constructor(type: string, owner: Client, casino: CasinoWizard, settings: GameInstanceSettings | null = null) {
        this.type = type; this.owner = owner; this.casino = casino; settings != null ? this.settings = settings : this.settings = DefaultGameInstanceSettings();
    }

    async init() {}

    enrollClient(client: Client) { 
        if(this.clients.map(c => c.user.account.id).includes(client.user.account.id)) return;
        this.clients.push(client);
        client.sendPacket(new Packet("instanceEnrollment", this.getInstanceInformation()))
        this.onClientEnrollment(client);
    }
    unenrollClient(client: Client) {
        if(!this.clients.includes(client)) {
            return;
        }
        const index = this.clients.indexOf(client)
        this.clients.splice(index, 1);
        if(this.clients.length <= 0) this.markedForDestruction = true;
        if(this.owner.user.account.id == client.user.account.id) {
            if(this.clients.length > 0) {
                this.owner = this.clients[0]!;
            }
        }
        client.sendPacket(new Packet("instanceUnenrollment", {}))
        this.onClientUnenrollment(client, index);
    }

    sendTableUpdate() {
        this.broadcastPacket(new Packet("refreshTable", {
            "owner": this.owner.getFormatted(),
            "clients": this.clients.map(c => c.getFormatted())
        }))
    }

    onClientEnrollment(client: Client) {
        this.sendTableUpdate();
    }

    onClientUnenrollment(client: Client, index: number) {
        this.sendTableUpdate();
    };

    onClientUpdateUser(client: Client) {
        if(this.owner.user.account.id == client.user.account.id) {
            this.owner = client;
        }
        this.sendTableUpdate();
    }

    getInstanceInformation() {
        return {
            "id": this.id,
            "type": this.type,
            "owner": this.owner.getFormatted(),
            "clients": this.clients.map((c, index) => mergeDicts(c.getFormatted(), {"is_turn": this.turn_index == index})),
            "started": this.started,
            "can_join": this.can_join,
            "turn_index": this.turn_index
        }
    }

    broadcastPacket(packet: Packet) { this.clients.forEach(c => c.sendPacket(packet)) }

    startGame() {
        this.started = true;
        this.can_join = false;
        this.casino.broadcast(new Packet("fetchInstances", {"data": {"instances": this.casino.instances.map(i => i.getInstanceInformation())}}))
        this.casino.broadcast(new Packet("startGame", {}));
        this.onStart();
        this.clients.forEach((c, i) => this.clientOnStart(c, i));
        this.progressTurn()
    }

    onStart() {}

    progressTurn() {
        this.turn_index += 1;
    }
    updateClientsOnTurn() {
        this.broadcastPacket(new Packet("getTableInformation", {"data": {"information": this.getInstanceInformation()}}))
    }
    resetTurn() {
        this.turn_index = 0;
    }

    clientOnStart(c: Client, i: number) {}
}

type BlackjackClientData = {
    hand: Array<number>,
    bet: number
}
const DefaultBlackjackInstanceSettings = () => { return {...DefaultGameInstanceSettings(),
    dealer_stop: 17
} as BlackjackInstanceSettings }
type BlackjackInstanceSettings = GameInstanceSettings & {
    dealer_stop: number
}

class BlackjackInstance extends GameInstance {
    public turn_type: number = 0;
    public client_data: Map<Client, BlackjackClientData> = new Map();
    override settings: BlackjackInstanceSettings;
    protected dealer_hand: Array<number> = new Array();
    constructor(owner: Client, casino: CasinoWizard, settings: BlackjackInstanceSettings | null) {
        super("blackjack", owner, casino);
        settings != null ? this.settings = settings : this.settings = DefaultBlackjackInstanceSettings();
    }

    private hasWon(checking: number, opponent: number) {
        if (checking > 21) return false;        // player busts → lose
        if (opponent > 21) return true;         // dealer busts → win
        if (checking === opponent) return null; // push (tie)
        return checking > opponent;             // higher hand wins
    }

    override onClientEnrollment(client: Client) {
        super.onClientEnrollment(client);
    }

    override clientOnStart(c: Client, i: number) {
        this.client_data.set(c, {
            hand: new Array(this.deck.draw(), this.deck.draw())
        } as BlackjackClientData);

        if(this.settings.monopoly_money) {
            c.user.statistics.points = this.settings.starting_money!
            c.sendPacket(new Packet("setMonopolyMoney", {"flag": true}))
            c.sendPacket(new Packet("setPoints", {"amt": this.settings.starting_money}));
        }

        c.UIElements.filter(ele => ele.type != "card").forEach(ele => c.destroyUIElement(ele));
        const player_data = this.client_data.get(c)!;
        player_data.hand.forEach((c1, index) => {
            let n = new ClientUIElement("card", (0.5+(0.09*index)), 0.4, {"w": 0.1, "h": 0.1333, "card": c1})
            let n2 = new ClientUIElement("card", 0, 0, {"owner_id": c.user.account.id, "position": "absolute", "pos_override": {"x": player_name_positions[i]![1]!+(index*3) + "vw", "y": player_name_positions[i]![0]!+5 + "vw", "w": "54px", "h": "72px"}, "card": c1})
            c.createUIElement(n); c.createUIElement(n2);
            this.clients.filter(c1 => c1.user.account.id != c.user.account.id).forEach(c2 => c2.createUIElement(new ClientUIElement("card", 0, 0, {"owner_id": c.user.account.id, "position": "absolute", "pos_override": {"x": player_name_positions[i]![1]!+(index*3) + "vw", "y": player_name_positions[i]![0]!+5 + "vw", "w": "54px", "h": "72px"}, "card": "back"})))
        })

        c.createUIElement(new ClientUIElement("card", 0, 0, {"dealer": true, "position": "absolute", "pos_override": {"x": player_name_positions[5]![1]! + "vw", "y": player_name_positions[5]![0]!+5 + "vw", "w": "54px", "h": "72px"}, "card": this.dealer_hand[0]}))
        c.createUIElement(new ClientUIElement("card", 0, 0, {"dealer": true, "position": "absolute", "pos_override": {"x": (player_name_positions[5]![1]!+3) + "vw", "y": player_name_positions[5]![0]!+5 + "vw", "w": "54px", "h": "72px"}, "card": "back"}))
        c.createUIElement(new ClientUIElement("text", 0, 0, {"text": `${Deck.getCardValue(this.dealer_hand[0]!)}?`, "position": "absolute", "pos_override": {"x": player_name_positions[5]![1]! + "vw", "y": player_name_positions[5]![0]!+3 + "vw", "w": "54px", "h": "72px"}}))
    }

    override onStart() {
        this.dealer_hand.push(this.deck.draw()!, this.deck.draw()!);
    }

    override onClientUnenrollment(client: Client, index: number) {
        super.onClientUnenrollment(client, index);
        this.clients.forEach((c, index) => {
            c.UIElements.filter(ele => ele.type == "card" && ele.data.owner_id == client.user.account.id).forEach(card => {
                c.destroyUIElement(card);
            })
            c.UIElements.filter(ele => ele.type == "card" && ele.data.owner_id == c.user.account.id).forEach((card, i) => {
                card.data.pos_override = {
                    "x": player_name_positions[index]![1]!+(i*3) + "vw", 
                    "y": player_name_positions[index]![0]!+5 + "vw", 
                    "w": "54px", "h": "72px"
                }
                c.updateUIElement(card);
            })
        })
        if(this.turn_index == index) {
            this.turn_index -= 1;
            this.progressTurn();
        }
    }

    clientOnTurnChange(c: Client, i: number) {
        switch(this.turn_type) {
            case 0: {
                break;
            }
            case 1: {
                break;
            }

            case 2: {
                const player_data = this.client_data.get(c)!;
                c.sendPacket(new Packet("clearUI", {}))
                const dealer_value = Deck.evaluateHand(this.dealer_hand);

                const beat_dealer = this.hasWon(Deck.evaluateHand(player_data.hand), dealer_value);
                const bust = Deck.evaluateHand(player_data.hand);
                if(player_data.bet == undefined) player_data.bet = Math.floor(c.user.statistics.points/2)
                player_data.hand.forEach((card, index) => {
                    this.clients.forEach(c1 => c1.createUIElement(new ClientUIElement("card", 0, 0, {"owner_id": c.user.account.id, "bust": bust, "position": "absolute", "pos_override": {"x": player_name_positions[i]![1]!+((index-1)*3) + "vw", "y": player_name_positions[i]![0]!+5 + "vw", "w": "54px", "h": "72px"}, "card": card})))
                });
                c.createUIElement(new ClientUIElement("text", 0.5, 0.5, {"text": beat_dealer ? `you won! +${Math.floor(player_data.bet/2)}` : `you lost :( -${player_data.bet}`}))

                const dealer_bust = dealer_value > 21;
                this.dealer_hand.forEach((card, index) => {
                    c.createUIElement(new ClientUIElement("card", 0, 0, {"bust": dealer_bust, "position": "absolute", "pos_override": {"x": player_name_positions[5]![1]!+((index)*3) + "vw", "y": player_name_positions[5]![0]!+5 + "vw", "w": "54px", "h": "72px"}, "card": card}))
                })
                c.createUIElement(new ClientUIElement("text", 0, 0, {"text": dealer_value, "position": "absolute", "pos_override": {"x": player_name_positions[5]![1]! + "vw", "y": player_name_positions[5]![0]!+3 + "vw", "w": "54px", "h": "72px"}}))
                
                if(beat_dealer) {
                    if(!this.settings.monopoly_money) {
                        c.modifyPoints(Math.floor(player_data.bet*1.5))
                    } else {
                        c.user.statistics.points += player_data.bet*1.5
                        c.sendPacket(new Packet("changePoints", {"delta": player_data.bet*1.5}));
                    }
                    
                }
            }
        }
    }

    onTurnChange() {
        switch(this.turn_type) {
            case 2: {
                while(Deck.evaluateHand(this.dealer_hand) < this.settings.dealer_stop) {
                    this.dealer_hand.push(this.deck.draw()!);
                } 
                setTimeout(() => {
                    this.clients.forEach(c => {
                        if(c.user.statistics.points <= 0) {
                            this.casino.removeFromCurrentInstance(c);
                        }
                    })
                    this.turn_index = -1;
                    this.turn_type = 0;
                    this.client_data.clear();
                    this.dealer_hand = new Array();
                    this.broadcastPacket(new Packet("clearUI", {}))
                    this.startGame();
                }, 4000)
                break;
            }
        }

        this.clients.forEach((c, i) => {this.clientOnTurnChange(c, i)})
    }

    override progressTurn() {
        super.progressTurn();
        if(this.turn_index >= this.clients.length) {
            this.turn_type += 1;
            this.onTurnChange();
            this.resetTurn();
        }

        const turn_player = this.clients[this.turn_index]; if(!turn_player) return;
        const player_data = this.client_data.get(turn_player); if(!player_data) return;

        switch(this.turn_type) {
            case 0: {
                let bet_slider = new ClientUIElement("slider", 0.5, 0.6, {"disabled": false, "label": "wager", "w": 0.3, "showVal": true, "min": 1, "max": turn_player.user.statistics.points, "valSuffix": " points"});
                let bet_button = new ClientUIElement("button", 0.75, 0.625, {"w": 0.1, "h": 0.05, "label": "bet"})
                bet_button.addEventListener("click", async () => {
                    player_data.bet = bet_slider.value ?? Math.floor(turn_player.user.statistics.points/2);
                    if(!this.settings.monopoly_money) {
                        await turn_player.modifyPoints(-player_data.bet)
                    } else {
                        turn_player.user.statistics.points -= player_data.bet
                        turn_player.sendPacket(new Packet("changePoints", {"delta": -player_data.bet}));
                    }
                    bet_slider.data.disabled = true;
                    turn_player.sendPacket(bet_slider.getUpdatePacket());
                    turn_player.sendPacket(bet_button.getDestructionPacket());
                    this.progressTurn();
                });
                turn_player.createUIElement(bet_slider); turn_player.createUIElement(bet_button)
                turn_player.sendPacket(bet_slider.getUpdatePacket());
                break;
            }
            
            case 1: {
                let stand_button = new ClientUIElement("button", 0.75, 0.8, {"w": 0.1, "h": 0.05, "label": "stand"})
                let hit_button = new ClientUIElement("button", 0.63, 0.8, {"w": 0.1, "h": 0.05, "label": "hit"})
                let worth_text = new ClientUIElement("text", 0.55, 0.81, {"text": Deck.evaluateHand(player_data.hand)})
                hit_button.addEventListener("click", () => {
                    let c = this.deck.draw()!
                    player_data.hand.push(c);
                    let n = new ClientUIElement("card", (0.5+(0.09*(player_data.hand.length-1))), 0.4, {"w": 0.1, "h": 0.1333, "card": c})
                    let n2 = new ClientUIElement("card", 0, 0, {"owner_id": turn_player.user.account.id, "position": "absolute", "pos_override": {"x": player_name_positions[this.turn_index]![1]!+((player_data.hand.length-1)*3) + "vw", "y": player_name_positions[this.turn_index]![0]!+5 + "vw", "w": "54px", "h": "72px"}, "card": c})
                    turn_player.createUIElement(n); turn_player.createUIElement(n2);
                    this.clients.filter(c => c.user.account.id != turn_player.user.account.id).forEach(c => c.createUIElement(new ClientUIElement("card", 0, 0, {"position": "absolute", "pos_override": {"x": player_name_positions[this.turn_index]![1]!+((player_data.hand.length-1)*3) + "vw", "y": player_name_positions[this.turn_index]![0]!+5 + "vw", "w": "54px", "h": "72px"}, "card": "back"})))
                    let nvalue = Deck.evaluateHand(player_data.hand);
                    worth_text.data.text = nvalue;
                    turn_player.updateUIElement(worth_text);

                    if(nvalue < 21) return;
                    turn_player.destroyUIElement(hit_button)
                    if(nvalue == 21) return
                    turn_player.UIElements.filter(c => c.type == "card" && c.data.dealer == undefined).forEach(ele => {
                        ele.data.bust = true;
                        turn_player.updateUIElement(ele);
                    })
                    worth_text.data.text = worth_text.data.text + " (BUST)"
                    turn_player.updateUIElement(worth_text);
                });
                const handle_stand = () => {
                    turn_player.UIElements.filter(ele => ele.type == "button").forEach(ele => turn_player.destroyUIElement(ele))
                    this.progressTurn();
                }
                stand_button.addEventListener("click", () => { handle_stand() })
                turn_player.createUIElement(stand_button); if(Deck.evaluateHand(player_data.hand) < 21) turn_player.createUIElement(hit_button); turn_player.createUIElement(worth_text);
                break;
            }
        }
        this.updateClientsOnTurn();
    }
}

class Client {
    public ws: ServerWebSocket<{ source: string; }>;
    public user: User;
    public UIElements: Array<ClientUIElement> = new Array();
    public instance: GameInstance | null = null;
    protected db: Database;
    protected auth: AuthorizationWizard;
    protected log: LogWizard = new LogWizard();

    constructor(ws: ServerWebSocket<{ source: string; }>, user: User, db: Database) {
        this.ws = ws;
        this.user = user;
        this.db = db; this.auth = new AuthorizationWizard(db);
    }

    sendPacket(packet: Packet) { this.ws.send(packet.format()) }

    updateUser(n: User) { 
        this.user = n;
        if(this.instance != undefined) this.instance.onClientUpdateUser(this);
    }

    createUIElement(ele: ClientUIElement) {
        this.UIElements.push(ele);
        this.sendPacket(ele.getCreationPacket());
    }
    destroyUIElement(ele: ClientUIElement) { 
        if(!this.UIElements.includes(ele)) {
            this.log.error("trying to delete ui element that doesn't exist on client", "GAMECLIENT")
            return;
        }
        this.UIElements.splice(this.UIElements.indexOf(ele), 1);
        this.sendPacket(ele.getDestructionPacket());
    }
    updateUIElement(ele: ClientUIElement) { this.sendPacket(ele.getUpdatePacket()) }
    changeUIElementVisiblity(ele: ClientUIElement) {

    }

    enroll(instance: GameInstance) {
        this.instance = instance;
        instance.enrollClient(this);
    }
    unenroll() {
        if(!this.instance) return;
        this.instance.unenrollClient(this);
    }

    getFormatted() {
        return {
            "name": this.user.settings.display_name,
            "id": this.user.account.id,
            "color": this.user.settings.color
        }
    }

    async modifyPoints(delta: number) {
        this.user.statistics.points = Math.max(0, this.user.statistics.points + delta)
        this.sendPacket(new Packet("changePoints", {"delta": delta}));
        await this.auth.changePoints(this.user.account.name, this.user.account.pass, delta);
    }
}

export class CasinoWizard {
    public instances: Array<GameInstance> = new Array();
    public allClients: Array<Client> = new Array();
    protected auth: AuthorizationWizard;
    protected db: Database;
    protected log: LogWizard = new LogWizard();
    constructor(db: Database) {
        this.db = db; this.auth = new AuthorizationWizard(db);
    }

    appendNewClient(client: Client) {
        this.allClients.push(client);
    }

    createInstance(type: string, owner: Client): GameInstance | null {
        let n;
        switch(type) {
            case "blackjack": {
                n = new BlackjackInstance(owner, this, DefaultBlackjackInstanceSettings())
                break;
            }
        }
        if(!n) return null;
        this.instances.push(n);
        this.onInstancesChange();
        return n;
    }
    destroyInstance(inst: GameInstance) {
        if(!this.instances.includes(inst)) return;
        this.instances.splice(this.instances.indexOf(inst), 1);
        this.onInstancesChange();
    }

    onInstancesChange() {
        this.broadcast(new Packet("fetchInstances", {"data": {"instances": this.instances.map(i => i.getInstanceInformation())}})); // extra data bc usually comes from getResponse
    }

    removeFromCurrentInstance(client: Client) {
        if(!client.instance) return;
        const inst = client.instance;
        inst.unenrollClient(client);
        this.auth.fetchAccount(client.user.account.name, client.user.account.pass).then(acc => { // fix monopoly money
            if(!acc) return;
            client.user.statistics.points = acc.statistics.points;
            client.sendPacket(new Packet("setMonopolyMoney", {"flag": false}))
            client.sendPacket(new Packet("setPoints", {"amt": acc.statistics.points}))
        })
        if(inst.markedForDestruction) { this.destroyInstance(inst) }
        this.broadcast(new Packet("fetchInstances", {"data": {"instances": this.instances.map(i => i.getInstanceInformation())}}))
    }

    handleConnection(ws: ServerWebSocket<{ source: string; }>, user: User) { this.allClients.push(new Client(ws, user, this.db)) }
    handleDisconnect(ws: ServerWebSocket<{ source: string; }>) {
        const client = this.allClients.find(c => c.ws == ws);
        if(!client) return;

        this.allClients.splice(this.allClients.indexOf(client), 1);
        if(client.instance != null) {
            this.removeFromCurrentInstance(client);
        }
    }
    async handleMessage(ws: ServerWebSocket<{ source: string; }>, msg: any) {
        const packet = Packet.fromFormatted(msg);
        if(!packet) return;

        if(packet.type == "initauth") {
            let u = await this.auth.fetchAccount(packet.data.name, packet.data.pass);
            if(!u) return;
            let c = new Client(ws, u, this.db);
            this.appendNewClient(c);
            c.sendPacket(packet.getResponse(200))
            return;
        }

        const client = this.allClients.find(c => c.ws == ws);
        if(!client) return;

        switch(packet.type) {
            case "createInstance": {
                const new_instance = this.createInstance(packet.data.type, client);
                if(new_instance == null) {
                    client.sendPacket(packet.getResponse(400));
                    break;
                }
                client.sendPacket(packet.getResponse(200));
                client.enroll(new_instance);
                break;
            }
            case "joinInstance": {
                const inst = this.instances.find(i => i.id == packet.data.id);
                if(!inst) {
                    client.sendPacket(packet.getResponse(400, {"reason": "invalid id"}))
                    break;
                }
                client.sendPacket(packet.getResponse(200));
                client.enroll(inst);
                break;
            }
            case "fetchInstances": {
                client.sendPacket(packet.getResponse(200, {"instances": this.instances.map(i => i.getInstanceInformation())}));
                break;
            }
            case "getTableInformation": {
                const inst = this.instances.find(i => i.id == packet.data.id);
                if(!inst) {
                    client.sendPacket(packet.getResponse(400, {"reason": "invalid id"}))
                    break;
                }
                client.sendPacket(packet.getResponse(200, {"information": inst.getInstanceInformation()}))
                break;
            }
            case "leaveInstance": {
                client.sendPacket(packet.getResponse(200));
                client.sendPacket(new Packet("clearUI", {}))
                this.removeFromCurrentInstance(client);
                break;
            }

            case "startGame": {
                if(client.instance == null) {
                    client.sendPacket(packet.getResponse(400));
                    break;
                }
                if(client.instance.owner.user.account.id != client.user.account.id) {
                    client.sendPacket(packet.getResponse(400, "you are not the owner of your instance"));
                    break;
                }
                client.sendPacket(packet.getResponse(200));
                client.instance.startGame();
                break;
            }

            case "updateUser": {
                if(packet.data.new_user == undefined) {
                    client.sendPacket(packet.getResponse(400, {"reason": "no new user"}))
                    break;
                }
                client.sendPacket(packet.getResponse(200));
                client.user = packet.data.new_user;
                if(client.instance != undefined) {
                    client.instance.onClientUpdateUser(client);
                    if(client.user.account.id == client.instance.owner.user.account.id) {
                        this.broadcast(new Packet("fetchInstances", {"data": {"instances": this.instances.map(i => i.getInstanceInformation())}}))
                    }
                }
                break;
            }

            case "UIInteraction": {
                let ele = client.UIElements.find(ele => ele.id == packet.data.id);
                if(!ele) {
                    client.sendPacket(packet.getResponse(400, {"reason": "no element found"}))
                    break;
                }
                ele.handleEvent(packet.data.type, new UIEvent(packet.data.type, packet.data.eventData ?? {}))
                break;
            }
        }
    }

    broadcast(packet: Packet) { this.allClients.forEach(c => c.sendPacket(packet)) }
}