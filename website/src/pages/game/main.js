/**
 * author thebadlorax
 * created on 06-05-2026-11h-00m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Engine } from "./engine.js";

const engine = new Engine();

window.onload = function () {
    var context = document.getElementById('demo').getContext('2d');
    engine.run(context);
};