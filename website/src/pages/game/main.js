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
let d = await fetch(getApiLink("/game/data"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass})})
d = await d.json();


const engine = new Engine(d);

function start() {
    const canvas = document.getElementById("demo");
    const context = canvas.getContext("2d");
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


if(!window.location.href.includes("localhost")) {
    let a = setInterval(() => {
        console.log("DO NOT MESS AROUND IN HERE\nyou won't learn anything and my engine is too cool for you to understand\nalso if you fuck up your playerdata i can't help you")
    }, 30)
    setTimeout(() => {
        clearInterval(a);
        console.log("but if you wanna help me program pls i need a lackey")
    }, 1000)
}
