/**
 * author thebadlorax
 * created on 12-02-2026-19h-15m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getPoints, addPoints } from "./gambling.js";

addPoints(100);

const snail_racing = document.getElementById("snail-racing")
const winner_text = document.getElementById("winner")
//const points_text = document.getElementById("points")
let can_bet = true;
let picked = null;
let won_last_game = null;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function refreshPoints() {
    //points_text.textContent = `${getPoints()} points`
}

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
        if(can_bet) {
            if(!button.classList.contains("picked")) {
                button.classList.add("picked");
                if(picked != null) document.getElementById(picked).classList.remove("picked");
                picked = position;
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

    const time = 15;
    const fps = 60;
    const speed_division = Math.floor((Math.random() * 3)+1);
    const speed_multipler = (Math.random()*0.5) + 0.5;

    let speeds = []
    let winner = null;
    let color = 0;

    can_bet = true;
    if(picked != null) document.getElementById(picked).classList.remove("picked");
    picked = null;
    won_last_game = null;

    function recalculateSpeeds() {
        speeds = [
            ((Math.random() * 4)+1)*speed_multipler, 
            ((Math.random() * 4)+1)*speed_multipler, 
            ((Math.random() * 4)+1)*speed_multipler, 
            ((Math.random() * 4)+1)*speed_multipler,
        ]
    }

    function tick() {
        let snail1_x = parseFloat(snail1.style.left.split("vw")[0])
        if(snail1_x < 87) {
            snail1.style.left = `${snail1_x+(.07*speeds[0])}vw`
        } else {
            if(winner == null) winner = 0;
        }
        let snail2_x = parseFloat(snail2.style.left.split("vw")[0])
        if(snail2_x < 87) {
            snail2.style.left = `${snail2_x+(.07*speeds[1])}vw`
        } else {
            if(winner == null) winner = 1;
        }
        let snail3_x = parseFloat(snail3.style.left.split("vw")[0])
        if(snail3_x < 87) {
            snail3.style.left = `${snail3_x+(.07*speeds[2])}vw`
        } else {
            if(winner == null) winner = 2;
        }
        let snail4_x = parseFloat(snail4.style.left.split("vw")[0])
        if(snail4_x < 87) {
            snail4.style.left = `${snail4_x+(.07*speeds[3])}vw`
        } else {
            if(winner == null) winner = 3;
        }
        let positions = [[snail1_x, 0], [snail2_x, 1], [snail3_x, 2], [snail4_x, 3]].sort()
        if(winner == null && !winner_text.textContent.includes("win")) winner_text.textContent = `Snail ${positions.at(-1)[1]+1} in the lead!`
    }

    winner_text.style.display = "block"

    winner_text.textContent = "Starting in 10";
    await delay(1000);
    winner_text.textContent = "Starting in 9";
    await delay(1000);
    winner_text.textContent = "Starting in 8";
    await delay(1000);
    winner_text.textContent = "Starting in 7";
    await delay(1000);
    winner_text.textContent = "Starting in 6";
    await delay(1000);
    winner_text.textContent = "Starting in 5";
    await delay(1000);
    winner_text.textContent = "Starting in 4";
    await delay(1000);
    winner_text.textContent = "Starting in 3";
    await delay(1000);
    winner_text.textContent = "Starting in 2";
    await delay(1000);
    winner_text.textContent = "Starting in 1";
    await delay(1000);
    can_bet = false;

    for(let x = 0; x < time*speed_division; x++) {
        recalculateSpeeds();
        for(let y= 0; y < fps/speed_division; y++) {
            if(winner != null) {
                if(winner == picked) won_last_game = true;
                else if(picked != null) won_last_game = false;
                let winner_ele = document.getElementById(winner);
                if(winner_text.style.display == "none") winner_text.style.display = "block";
                winner_text.textContent = `Snail ${winner+1} wins!`
                winner_ele.style.filter = `hue-rotate(${color}deg)`
                color += 2
            }
            tick();
            await delay(1000/fps);
        }
    }
}

refreshPoints();

while(true) {
    await runSnailRace();
    if(won_last_game) addPoints(getPoints() * .25);
    else if(won_last_game != null) addPoints(getPoints() * -.25);
    refreshPoints();
}