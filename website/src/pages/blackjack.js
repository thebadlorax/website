/**
 * author thebadlorax
 * created on 13-02-2026-20h-21m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { ServersideDeck as Deck } from "./gambling.js";
import { getApiLink, getCookie, setCookie, updateId } from "./common.js";

const name_positions = [[70, 20], [80, 30], [83, 50], [81, 70], [69, 80]]
let players = new Map()

let join_table_button = document.getElementById("join-table")
let leave_table_button = document.getElementById("leave-table")
let name = getCookie("username") || "No Name"
let color = getCookie("color") || "#000000"
await updateId();
let id = getCookie("id");
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
let wsUri; 
if(location.host.includes("66.65.25.15")) {
    wsUri = `${protocol}//${location.host}/subdomain=api/gambling/blackjack/join`;
} else {
    wsUri = `${protocol}//api.${location.host}/gambling/blackjack/join`;
}
const ws = new WebSocket(wsUri);
let in_table = false;
ws.addEventListener("message", (message) => {
    if(message.data[0] == "_") {
        const method = message.data.slice(1, message.data.indexOf("="));
        const value = message.data.slice(message.data.indexOf("=")+1);
        switch(method) {
            case "JOIN":
                registerPlayer(value);
                break;
            case "STATE":
                if(!value) break;
                let split_data = value.split(";");
                let is_open = split_data[0];
                let rec_players = split_data.slice(1);
                console.log(is_open);
                rec_players.forEach(player => {
                    registerPlayer(player);
                });
                break;
            case "DISCONNECT":
                if(players.get(value)) players.get(value).remove();
                players.delete(value);
                break;
            case "NAMEUPDATE":
                let split_value = value.split(";")
                let text = players.get(split_value[0]);
                if(!text) break;
                text.style.color = split_value[1].slice(0, 7)
                text.textContent = split_value[1].slice(7)
                players.set(split_value[1], text)
                players.delete(players.get(split_value[0]));
                break;
        }
    }
})

function registerPlayer(value) {
    if(!value) return;
    let player_text = document.createElement("p")
    player_text.classList.add("unselectable")
    player_text.style.position = "absolute";
    player_text.style.top = `${name_positions[players.size][0]}vw`
    player_text.style.left = `${name_positions[players.size][1]}vw`
    player_text.style.color = value.slice(0, 7);
    player_text.textContent = value.slice(7);
    document.getElementById("blackjack").appendChild(player_text);
    players.set(value, player_text)
}

join_table_button.addEventListener("click", () => { 
    join_table_button.textContent = "start game"
    leave_table_button.style.display = "block";
    if(!in_table) {
        ws.send(`_INIT=${id};${color}${name}`);
        in_table = true;
    }
})

leave_table_button.addEventListener("click", () => {
    join_table_button.textContent = "join table"
    leave_table_button.style.display = "none";
    if(in_table) {
        ws.send(`_LEAVE=${id};${color}${name}`);
        in_table = false;
    }
})

function refreshColors() {
    let new_name = getCookie("username") || "No Name"
    let new_color = getCookie("color") || "#000000"
    if(name != new_name || new_color != color) {
        color = new_color;
        name = new_name;
        ws.send(`_NAMEUPDATE=${color}${name}`);
    }
}

setInterval(refreshColors, 100)