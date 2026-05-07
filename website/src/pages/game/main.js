/**
 * author thebadlorax
 * created on 06-05-2026-11h-00m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Engine } from "./engine.js";
import { getApiLink } from "../common.js";
import { test_data_request } from "./data.js";

const engine = new Engine(test_data_request);

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