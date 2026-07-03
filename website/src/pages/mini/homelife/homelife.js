/**
 * author thebadlorax
 * created on 25-06-2026-18h-32m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Loader } from "../mini-common.js";

class Engine {
    constructor(ctx, loader) {
        this.ctx = ctx;
        this.loader = loader;
        
        this.fps_data = [];
    }
    async init() {}
    tick(elapsed) {
        if(this._previousElapsed === null) {
            this._previousElapsed = elapsed;
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        }
    
        const delta = Math.min(
            (elapsed - this._previousElapsed) / 1000,
            0.12
        );
    
        this._previousElapsed = elapsed;

        if(this.fps_data.length == 5) this.fps_data.pop();
        this.fps_data.push(delta || 0);

        this.update(delta);
        this.render();

        window.requestAnimationFrame(this.tick.bind(this));
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.fillStyle = "red";
        ctx.fillRect(100, 100, 100, 100);
    }
    
    update(delta) {}
}

const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d");

const loader = new Loader();

const engine = new Engine(ctx);
window.requestAnimationFrame(engine.tick.bind(engine));