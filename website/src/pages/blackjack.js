/**
 * author thebadlorax
 * created on 13-02-2026-20h-21m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink, getSettingOnAccount } from "./common.js";
import { showReceiptMenu, refreshPoints, getPoints, hideReceiptMenu } from "./gambling.js";

const positions = [[70, 20], [80, 30], [83, 50], [81, 70], [69, 80], [61, 50]]
let player_texts = []
let color = getSettingOnAccount("color")
let name = getSettingOnAccount("display_name")
let index = undefined;

let join_table_button = document.getElementById("join-table")
let leave_table_button = document.getElementById("leave-table")
const wager_slider = document.getElementById("blackjack-wager");
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
let wsUri; 
if(location.host.includes("66.65.25.15")) {
    wsUri = `${protocol}//${location.host}/subdomain=api/gambling/blackjack/join`;
} else {
    wsUri = `${protocol}//api.${location.host}/gambling/blackjack/join`;
}
const ws = new WebSocket(wsUri);
let in_table = false;
ws.addEventListener("message", async (msg) => {
    let rec = msg.data;
    const method = rec.slice(0, rec.indexOf(";"));
    const json = JSON.parse(rec.slice(rec.indexOf(";")+1));
    switch (method) {
        case "state": updateTableState(json); break;
        case "start": startHandler(); break;
        case "reset": restartHandler(); break;
        case "round": 
            document.getElementById("exit-text-receipt").textContent = "exiting will NOT result in a loss"
            setTimeout(async () => { await refreshPoints(); }, 100); 
            break;
        case "bet": betPhaseHandler(); break;
        case "play": playPhaseHandler(); break;
        case "accepted": document.getElementById("reciept-blackjack-submit").style.display = "none"; break;
    }
})

document.getElementById("blackjack-points-wager-text").textContent = `${wager_slider.value} points bet.`
wager_slider.addEventListener("input", () => {
    document.getElementById("blackjack-points-wager-text").textContent = `${wager_slider.value} points bet.`
})

document.getElementById("reciept-blackjack-submit").addEventListener("click", () => {
    ws.send(`bet;${JSON.stringify({"amt": parseInt(wager_slider.value)})}`)
})

document.getElementById("exit-text-receipt").addEventListener("click", () => {
    ws.send(`leave;{}`)
    in_table = false;
    hideReceiptMenu("receipt-blackjack")
    document.getElementById("blackjack-dealer-worth").style.display = "none";
    join_table_button.textContent = "join table"
    leave_table_button.style.display = "none";
    refreshPoints();
})

const betPhaseHandler = async () => {
    let points = await getPoints();
    if(points == 0) {
        join_table_button.textContent = "join table"
        leave_table_button.style.display = "none";
        if(in_table) {
            ws.send(`leave;{}`);
            in_table = false;
        }

        hideReceiptMenu("receipt-blackjack")
        document.getElementById("blackjack-dealer-worth").style.display = "none";
        return;
    }
    document.getElementById("receipt-blackjack-card").replaceChildren();
    document.getElementById("blackjack-cards").replaceChildren();
    document.getElementById("blackjack-dealer-worth").style.display = "none";
    document.getElementById("receipt-blackjack-bet").style.display = "block";
    document.getElementById("receipt-blackjack-play").style.display = "none";
    //document.getElementById("reciept-blackjack-submit").style.display = "block";
    
    wager_slider.max = points
    wager_slider.value = points/4;
    document.getElementById("blackjack-points-wager-text").textContent = `${wager_slider.value} points bet.`

}

const playPhaseHandler = () => {
    document.getElementById("blackjack-dealer-worth").style.display = "block";
    document.getElementById("receipt-blackjack-bet").style.display = "none";
    document.getElementById("receipt-blackjack-play").style.display = "block";
    document.getElementById("exit-text-receipt").textContent = "exiting will result in a loss";
}
const startHandler = () => {
    hideStartUI();
    showReceiptMenu("receipt-blackjack");
}

const restartHandler = () => {
    document.getElementById("receipt-blackjack-card").replaceChildren();
    document.getElementById("blackjack-cards").replaceChildren();
}

function addCard(position, card, x_off = undefined, self_cards = false) {
    let card_url = `../res/cards/${card}.png`
    let y = positions[position][0]
    let x = positions[position][1]
    let card_ele = document.createElement("img")
    card_ele.src = card_url
    card_ele.classList.add("card");
    // format for table
    card_ele.style.top = `${y+3}vw`
    card_ele.setAttribute("draggable", false);
    card_ele.style.left = `${x_off != undefined ? x+x_off : x}vw`
    if(document.getElementById("receipt-blackjack-worth").textContent == "BUST" && self_cards) { card_ele.classList.add("bust");  }
    else { card_ele.classList.add("active")}
    let table_node = card_ele.cloneNode(true)
    document.getElementById("blackjack-cards").appendChild(table_node);
    // format for receipt
    if(self_cards) {
        card_ele.style.top = ""; card_ele.style.left = `${x_off*1.25}vw`
        document.getElementById("receipt-blackjack-card").appendChild(card_ele);
        //if(document.getElementById("receipt-blackjack-worth").textContent == "BUST") { card_ele.classList.add("bust");  }
    }
}

function hideStartUI() {
    join_table_button.style.display = "none"; leave_table_button.style.display = "none";
}

function showStartUI() {
    join_table_button.style.display = "block"; leave_table_button.style.display = in_table ? "block" : "none";
}

const showReceiptUI = () => {
    document.getElementById("reciept-blackjack-hit").style.display = "block"; 
    document.getElementById("reciept-blackjack-stand").style.display = "block";
}

const hideReceiptUI = () => {
    document.getElementById("reciept-blackjack-hit").style.display = "none"; 
    document.getElementById("reciept-blackjack-stand").style.display = "none";
}

function updateTableState(json) {
    let players = json.players;
    index = json.index
    if(json.is_active) hideStartUI();
    else showStartUI();
    if(!json.is_active && index == 0) join_table_button.style.display = "block";
    else { 
        if(in_table) join_table_button.style.display = "none";
    }
    player_texts.forEach(txt => { txt.remove() });
    let self_value;
    if(players.length == 0) {
        document.getElementById("receipt-blackjack-card").replaceChildren();
        document.getElementById("blackjack-cards").replaceChildren();
    }
    document.getElementById("receipt-blackjack-card").replaceChildren();
    document.getElementById("blackjack-cards").replaceChildren();
    for(let x = 0; x < players.length; x++) {
        let player = players[x];
        let cards = player["hand"].split(";");

        if(x == index) {
            document.getElementById("receipt-blackjack-worth").textContent = `${player["hand_value"] > 21 ? "BUST" : player["hand_value"]}`;
            self_value = player["hand_value"]
        }
        if(x == index && player["hand_value"] >= 21) document.getElementById("reciept-blackjack-hit").style.display = "none";
        else if(x == index && player["hand_value"] < 21) showReceiptUI(); 

        if(x == index && json.turn != index) hideReceiptUI();
        for(let y = 0; y < cards.length; y++) {
            let card = cards[y];
            if(card != "") addCard(x, card == "*" ? "back" : card, y*3, x == index);
        }
        let player_text = document.createElement("p")
        player_text.classList.add("unselectable")
        player_text.style.position = "absolute";
        player_text.style.top = `${positions[x][0]}vw`
        player_text.style.left = `${positions[x][1]}vw`
        player_text.style.color = player.color 
        player_text.textContent = `${player.display_name}${player["hand_value"] > 0 ? (player["hand_value"] > 21 ? " - BUST" : ` - (${player["hand_value"]})`) : ""}`
        if(x == json.turn) { 
            player_text.style.textDecoration = "underline"; 
            player_text.style.fontWeight = "700"
            if(x == index) { document.getElementById("reciept-blackjack-submit").style.display = "block"; }
            else { document.getElementById("reciept-blackjack-submit").style.display = "none"; }
        }
        player_texts.push(player_text);
        document.getElementById("blackjack").appendChild(player_text);
    }
    // dealer stuff
    show_dealer_hand(json.dealer, json.dealer_value, self_value);
}

const show_dealer_hand = (hand, value, player_val) => {
    let dealer_hand = hand.split(";").filter(Boolean);
    let is_hidden = false;
    if(hand !== "undefined;") {
        for(let z = 0; z < dealer_hand.length; z++) {
            let card = dealer_hand[z];
            if(card == "*") is_hidden = true;
            let card_ele;
            if(card != "") card_ele = addCard(5, card == "*" ? "back" : card, z*3, false);
        }
    };
    document.getElementById("blackjack-dealer-worth").textContent = `${ value < 21 ? `${value}${is_hidden ? "?" : `${player_val < 21 && player_val > value ? "" : ""}`}` : "BUST"}`;
}

join_table_button.addEventListener("click", () => { 
    if(document.getElementById("receipt-snail-racing").style.display != "none") return;
    join_table_button.textContent = "start game"
    leave_table_button.style.display = "block";
    if(!in_table) {
        let saved_data = JSON.parse(window.localStorage.getItem("user"));
        ws.send(`join;${JSON.stringify({"user": saved_data})}`);
        in_table = true;
    } else {
        ws.send(`start;{}`);
    }
})

leave_table_button.addEventListener("click", () => {
    join_table_button.textContent = "join table"
    leave_table_button.style.display = "none";
    if(in_table) {
        ws.send(`leave;{}`);
        in_table = false;
    }
})

setInterval(() => {
    let found_color = getSettingOnAccount("color");
    let found_name = getSettingOnAccount("display_name");
    if(found_color !== color || found_name !== name) {
        
        color = found_color;
        name = found_name;
        ws.send(`update;${JSON.stringify({"user": JSON.parse(window.localStorage.getItem("user"))})}`)
    }
}, 250)

document.getElementById("reciept-blackjack-hit").addEventListener("click", () => {
    if(parseInt(document.getElementById("receipt-blackjack-worth").textContent) < 21) ws.send(`draw;{}`);
})
document.getElementById("reciept-blackjack-stand").addEventListener("click", () => {
    ws.send(`stand;{}`);
})

setInterval(() => {
    refreshPoints();
}, 2000);