/**
 * author thebadlorax
 * created on 13-02-2026-20h-21m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { ServersideDeck as Deck } from "./gambling.js";
import { getCookie, setCookie } from "./common.js";

let join_table_button = document.getElementById("join-table")
let leave_table_button = document.getElementById("leave-table")
let your_name_text = document.getElementById("bj-your-name")
let name = getCookie("username") || "No Name"
let color = getCookie("color") || "#000000"

join_table_button.addEventListener("click", () => { 
    your_name_text.textContent = name;
    your_name_text.style.color = color;
    your_name_text.style.display = "block";

    join_table_button.textContent = "start game"
    leave_table_button.style.display = "block";
})

leave_table_button.addEventListener("click", () => {
    your_name_text.style.display = "none";
    join_table_button.textContent = "join table"
    leave_table_button.style.display = "none";
})

function refreshColors() {
    name = getCookie("username") || "No Name"
    color = getCookie("color") || "#000000"
    your_name_text.textContent = name;
    your_name_text.style.color = color;
}

setInterval(refreshColors, 250)