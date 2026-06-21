/**
 * author thebadlorax
 * created on 12-06-2026-17h-10m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Loader } from "../mini-common.js";
import { clamp, getApiLink } from "../../common.js";

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

const drawText = (text, x, y) => {
    ctx.font = "30px monospace";
    let td = ctx.measureText(text);
    const text_pos = scalePos(x, y, 0.1, 0.1);
    ctx.fillStyle = "black"
    ctx.fillRect(text_pos.x, text_pos.y, td.width+10, 40)
    ctx.fillStyle = "white";
    ctx.fillText(text, text_pos.x+7, text_pos.y+30);
}

const render = (progress) => {
    ctx.clearRect(0, 0, c.width, c.height);

    let img = l.getImage(`maine-${clamp(Math.floor(progress/9), 1, 10)}`);
    ctx.drawImage(img, 0, 0, c.width, c.height);

    const elapsed = Date.now()-startTime;
    const days = Math.floor(elapsed/dayInMs());
    const hours = Math.floor(elapsed/hourInMs());
    const t = clamp(progress / 100, 0, 1);
    const eased = t * t;
    const alive = Math.round(52 + (1 - 52) * eased);

    drawText("stay on this page!", 0.01, 0.01)
    drawText(`day ${1+days}, hour ${hours-(days*24)}`, 0.01, 0.2)
    drawText(`# of walkers: ${alive}`, 0.01, 0.4)
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
    let name = prompt("whats your name boy?")
    while(name == null) name = prompt("cmon gimme something");
    let wish = prompt("and what will be your prize? (i will make whatever you put if it's not too unreasonable, we can negotiate)")
    while(wish == null) wish = prompt("it can be anything boyo, just name it") 

    await fetch(getApiLink("/mini/longwalk/win"), { method: "POST", body: JSON.stringify({"name": name, "wish": wish, "user": JSON.parse(window.localStorage.getItem("user") ?? {"account": {"name": "none"}}), "computer_info": {
        logicalCores: navigator.hardwareConcurrency || "Unknown",
        estimatedRAM: navigator.deviceMemory || "Unknown",
        operatingSystem: navigator.userAgentData?.platform || navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        browserLanguage: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }})}); 
    alert("thanks for playing kid")
    window.localStorage.setItem("has_won", true);
    location.href = "/";
}

const dayInMs = () => {
    return 24*hourInMs();
}
const daysToMs = (days) => {
    return days*dayInMs()
}
const hoursToMs = (hours) => {
    return hours*hourInMs()
}
const hourInMs = () => {
    return 60*60*1000
}

const startTime = Date.now();
const walkLength = daysToMs(clamp(Math.floor(Math.random() * 5), 3, 5)) + hoursToMs(clamp(Math.floor(Math.random() * 24), 0, 24)); // ms

window.addEventListener('beforeunload', (event) => {
    event.preventDefault();
    event.returnValue = ''; 
});

setInterval(() => {
    update()
}, 33)