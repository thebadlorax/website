/**
 * author thebadlorax
 * created on 06-05-2026-11h-00m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Engine } from "./engine.js";
import { getApiLink } from "../common.js";

const user = JSON.parse(window.localStorage.getItem("user"));
if(!user) {
    alert("this only works if you have an account :(");
    window.location.href = "/?account";
}
let d = await fetch(getApiLink("/game/data/fetch"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass})})
d = await d.json();

console.log(d)


const engine = new Engine(d);

function start() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    document.body.appendChild(canvas)
    engine.run(context);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
} else {
    start();
}

const checkIfDisabled = async () => {
    await fetch(getApiLink("/stats")).then(async e => {
        let json = await e.json();
        if(json.disabled_features.includes("game")) window.location.href = "/";
    })
}
setInterval(async () => {await checkIfDisabled()}, 3000);