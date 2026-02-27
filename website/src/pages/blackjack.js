/**
 * author thebadlorax
 * created on 13-02-2026-20h-21m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink, getSettingOnAccount } from "./common.js";

const name_positions = [[70, 20], [80, 30], [83, 50], [81, 70], [69, 80]]
let player_texts = []
let color = getSettingOnAccount("color")
let name = getSettingOnAccount("display_name")

let join_table_button = document.getElementById("join-table")
let leave_table_button = document.getElementById("leave-table")
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
let wsUri; 
if(location.host.includes("66.65.25.15")) {
    wsUri = `${protocol}//${location.host}/subdomain=api/gambling/blackjack/join`;
} else {
    wsUri = `${protocol}//api.${location.host}/gambling/blackjack/join`;
}
const ws = new WebSocket(wsUri);
let in_table = false;
ws.addEventListener("message", (msg) => {
    let rec = msg.data;
    const method = rec.slice(0, rec.indexOf(";"));
    const json = JSON.parse(rec.slice(rec.indexOf(";")+1));
    switch (method) {
        case "state": updateTableState(json); break;
        case "start": hideStartUI(); break;
    }
})

function hideStartUI() {
    join_table_button.style.display = "none"; leave_table_button.style.display = "none";
}

function showStartUI() {
    join_table_button.style.display = "block"; leave_table_button.style.display = "block";
}

function updateTableState(json) {
    let players = json.players;
    if(json.is_active) hideStartUI();
    else showStartUI();
    player_texts.forEach(txt => { txt.remove() });
    for(let x = 0; x < players.length; x++) {
        let player = players[x];
        console.log(name_positions[x])
        let player_text = document.createElement("p")
        player_text.classList.add("unselectable")
        player_text.style.position = "absolute";
        player_text.style.top = `${name_positions[x][0]}vw`
        player_text.style.left = `${name_positions[x][1]}vw`
        player_text.style.color = player.color
        player_text.textContent = player.display_name
        player_texts.push(player_text);
        document.getElementById("blackjack").appendChild(player_text);
    }
    
}

join_table_button.addEventListener("click", () => { 
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
    console.log(`current: ${color} ; new: ${found_color}`);
    if(found_color !== color || found_name !== name) {
        
        color = found_color;
        name = found_name;
        ws.send(`update;${JSON.stringify({"user": JSON.parse(window.localStorage.getItem("user"))})}`)
    }
}, 250)