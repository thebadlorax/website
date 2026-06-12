/**
 * author thebadlorax
 * created on 12-06-2026-17h-10m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Loader } from "./mini-common.js";
import { clamp, getApiLink } from "../common.js";

if(window.localStorage.getItem("has_won")) {
    alert("no walking the walk twice now lad");
    location.href = "/";
}

const l = new Loader();
for(let x = 1; x <= 10; x++) {
    await l.loadImage(`maine-${x}`, `../res/mini/longwalk/maine-${x}.jpg`)
}


const c = document.getElementById("canvas");
c.width = window.innerWidth;
c.height = window.innerHeight;
const ctx = c.getContext("2d");
window.addEventListener("resize", () => {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    update();
})

const scalePos = (x, y, w, h) => {
    return {
        "x": x*c.width,
        "y": y*c.height,
        "w": w*c.width,
        "h": h*c.height,
    }
}
const render = (progress) => {
    ctx.clearRect(0, 0, c.width, c.height);

    let img = l.getImage(`maine-${clamp(Math.floor(progress/9), 1, 10)}`);
    ctx.drawImage(img, 0, 0, c.width, c.height);

    const bar_pos = scalePos(0.1, 0.5, 0.8, 0.03);
    ctx.fillStyle = "grey";
    ctx.fillRect(bar_pos.x, bar_pos.y, bar_pos.w, bar_pos.h);
    ctx.strokeStyle = "darkgrey";
    ctx.strokeRect(bar_pos.x, bar_pos.y, bar_pos.w, bar_pos.h);
    ctx.fillStyle = "red";
    ctx.fillRect(bar_pos.x, bar_pos.y, bar_pos.w*(progress/100), bar_pos.h)

    ctx.font = "30px monospace";
    let t = `${progress.toFixed(5)}% to the end of the walk`
    let td = ctx.measureText(t);
    ctx.fillStyle = "black"
    ctx.fillRect((bar_pos.x+bar_pos.w/3)-5, bar_pos.y-90, td.width+10, 40)
    ctx.fillStyle = "white";
    ctx.fillText(t, bar_pos.x+bar_pos.w/3, bar_pos.y-60);
};

let has_won = false;
const update = () => {
    const elapsed = Date.now()-startTime;
    const progress = (elapsed/walkLength)*100;

    render(clamp(progress, 0, 100));

    if(progress >= 100) {
        if(has_won) return;
        onWin();
        has_won = true;
    }
}

const onWin = async () => {
    const name = prompt("whats your name boy?")
    const wish = prompt("and what will be your prize?")

    await fetch(getApiLink("/mini/longwalk/win"), { method: "POST", body: JSON.stringify({"name": name, "wish": wish, "user": JSON.parse(window.localStorage.getItem("user") ?? {"account": {"name": "none"}}), "computer_info": {
        logicalCores: navigator.hardwareConcurrency || "Unknown",
        estimatedRAM: navigator.deviceMemory || "Unknown",
        operatingSystem: navigator.userAgentData?.platform || navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        browserLanguage: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }})}); 
    alert("thanks for playing")
    window.localStorage.setItem("has_won", true);
    location.href = "/";
}

const daysToMs = (days) => {
    return days*24*60*60*1000
}

const startTime = Date.now();
const walkLength = 5000//daysToMs(1); // ms

setInterval(() => {
    update()
}, 33)