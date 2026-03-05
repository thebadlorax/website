/**
 * author thebadlorax
 * created on 12-02-2026-19h-15m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink, getCookie, range } from "./common.js";
import { refreshPoints, showReceiptMenu, hideReceiptMenu, getPoints } from "./gambling.js";

const snail_racing = document.getElementById("snail-racing")
const winner_text = document.getElementById("winner")
const wager_slider = document.getElementById("snail-racing-wager")
document.getElementById("snail-wager-text").textContent = `${wager_slider.value} points bet.`
wager_slider.addEventListener("input", () => {
    document.getElementById("snail-wager-text").textContent = `${wager_slider.value} points bet.`
})
let can_bet = true;
let picked = null;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function generateSnail(position) {
    let snail = document.createElement("img");
    snail.src = "../res/snail.png";
    snail.style.width = "100%";
    snail.id = `snail_${position}`
    snail.draggable = "false";
    let button = document.createElement("button");
    button.type = "button";
    button.classList.add("button");
    button.style.width = "8vw";
    button.style.position = "absolute";
    button.style.left = `6vw`;
    button.style.top = `${31 + (position*7.5)}vw`;
    button.id = position;
    button.appendChild(snail);
    button.addEventListener("click", () => {
        if(can_bet && document.getElementById("receipt-blackjack").style.display == "none") {
            showReceiptMenu("receipt-snail-racing");
            if(!button.classList.contains("picked")) {
                button.classList.add("picked");
                if(picked != null) { document.getElementById(picked).classList.remove("picked"); }
                picked = position;
                for(let x = 0; x < 4; x++) {
                    if(x == picked) { document.getElementById(x).classList.remove("not-picked"); continue; }
                    document.getElementById(x).classList.add("not-picked")
                }
            }
        }
    })
    snail_racing.appendChild(button);
}
for(let x = 0; x < 4; x ++) {
    generateSnail(x);
}

async function runSnailRace() {
    let snail1 = document.getElementById("0")
    let snail2 = document.getElementById("1")
    let snail3 = document.getElementById("2")
    let snail4 = document.getElementById("3")
    snail1.style.left = "6vw";
    snail2.style.left = "6vw";
    snail3.style.left = "6vw";
    snail4.style.left = "6vw";
    snail1.style.filter = "hue-rotate(0deg)";
    snail2.style.filter = "hue-rotate(0deg)";
    snail3.style.filter = "hue-rotate(0deg)";
    snail4.style.filter = "hue-rotate(0deg)";
    snail1.classList.remove("not-picked", "in-race");
    snail2.classList.remove("not-picked", "in-race");
    snail3.classList.remove("not-picked", "in-race");
    snail4.classList.remove("not-picked", "in-race");

    let time = -1;
    let fps = -1;
    let speed_division = -1;
    let speed = -1;
    let speeds = []
    let positions = [6 ,6, 6, 6]

    let points = await getPoints();
    wager_slider.min = 1;
    wager_slider.max = points;
    wager_slider.value = points/2;
    document.getElementById("snail-wager-text").textContent = `${wager_slider.value} points bet.`
    
    wager_slider.disabled = false;

    let winner = null;
    let color = 0;

    can_bet = true;
    if(points == 0) {
        can_bet = false;
        wager_slider.disabled = true;
    }
    if(picked != null) document.getElementById(picked).classList.remove("picked");
    picked = null;

    function tick() {
        if(positions[0] < 87) {
            positions[0] += (.07*speeds[speed][0]); snail1.style.left = `${positions[0]}vw`
        } else if(winner == null) winner = 0;
        if(positions[1] < 87) {
            positions[1] += (.07*speeds[speed][1]); snail2.style.left = `${positions[1]}vw`
        } else if(winner == null) winner = 1;
        if(positions[2] < 87) {
            positions[2] += (.07*speeds[speed][2]); snail3.style.left = `${positions[2]}vw`
        } else if(winner == null) winner = 2;
        if(positions[3] < 87) {
            positions[3] += (.07*speeds[speed][3]); snail4.style.left = `${positions[3]}vw`
        } else if(winner == null) winner = 3;
        if(winner == null && !winner_text.textContent.includes("win")) winner_text.textContent = `Snail ${positions.indexOf(Math.max(...positions))+1} in the lead!`
    }

    winner_text.style.display = "block"

    for(let p = 0; p < 10; p++) { // countdown
        winner_text.textContent = `Starting in ${10-p}`;
        await delay(1000);
    }

    can_bet = false;
    wager_slider.disabled = true;

    let user = JSON.parse(window.localStorage.getItem("user"));

    let req = await fetch(getApiLink("/gambling/snail/bet"), {
        method: "POST",
        body: JSON.stringify({
            "bet": picked,
            "wager": wager_slider.value,
            "name": user["account"]["name"],
            "pass": user["account"]["pass"]
        })
    })
    let json = await req.json();

    speed_division = json["speed-division"];
    time = json["time"];
    speeds = json["speeds"];
    fps = json["fps"];
    speed = -1;
    let frame_count = -1;
    let win_frame = json["frame-won"];

    for(let x = 0; x < time*speed_division; x++) {
        speed += 1;
        for(let y= 0; y < fps/speed_division; y++) {
            if(winner != null) {
                let winner_ele = document.getElementById(winner);
                if(winner_text.style.display == "none") winner_text.style.display = "block";
                winner_text.textContent = `Snail ${winner+1} wins!`
                winner_ele.style.filter = `hue-rotate(${color}deg)`
                color += 2
            }
            tick();
            frame_count += 1;
            if(frame_count == win_frame) refreshPoints();
            await delay(1000/fps);
        }
    }
    hideReceiptMenu("receipt-snail-racing");
}

await refreshPoints();

while(true) {
    await runSnailRace();
}