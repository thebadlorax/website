/**
 * author thebadlorax
 * created on 13-06-2026-12h-26m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Maths, Vector2 } from "./maths.js";
import { clamp } from "../common.js";

export class Keyboard {
    _keys = {};
    _key_functions = {};
    constructor() {
        window.addEventListener('keydown', this._onKeyDown.bind(this));
        window.addEventListener('keyup', this._onKeyUp.bind(this));

        window.addEventListener("blur", () => {
            for (const key in this._keys) {
                this._keys[key] = false;
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                for (const key in this._keys) {
                    this._keys[key] = false;
                }
            }
        });

        this.waiting = false;
    };

    listenForEvents(keys) {
        keys.forEach(function (key) {
            this._keys[key] = false;
        }.bind(this));
    };

    setFunctionOnKeyPress(key, fn) {
        this._key_functions[key] = fn;
    }

    _onKeyDown(event) {
        var keyCode = event.code;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = true;
            if(this._key_functions[keyCode] != undefined) this._key_functions[keyCode]();
        }
    };

    _onKeyUp(event) {
        var keyCode = event.code;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = false;
        }

        if (keyCode === "MetaLeft" || keyCode === "MetaRight") {
            for (const key in this._keys) {
                if (key !== "MetaLeft" && key !== "MetaRight") {
                    this._keys[key] = false;
                }
            }
        }
    };

    isDown(keyCode) {
        if (!(keyCode in this._keys)) {
            throw new Error('Keycode ' + keyCode + ' is not being listened to');
        }
        return this._keys[keyCode];
    }

    waitForKeyPress() {
        const toggle = () => {
            this.waiting = false;
        }
        this.waiting = true;
        return new Promise(resolve => {
            function handler(event) {
                window.removeEventListener("keydown", handler);
                toggle();
                resolve(event);
            }
    
            window.addEventListener("keydown", handler);
        });
    }
}

class UnitTypes {
    static TypeData = {
        "infantry": {
            "speed": 100,
            "damage": 10,
            "recovery": 3,
            "visual": {
                "color": "red",
                "size": 20
            }
        }
    }
}
class Unit {
    constructor(type, count, x, y, uc) {
        this.group = null;
        this.type = type;
        this.count = count;
        this.pos = new Vector2(x, y);
        this.targetPos = new Vector2(null, null);
        this.controller = uc; this.selected = false;
        this.exists = true;
        this.mergeTarget = null;
        this.lockedFromMerging = false;
        this.hasMoved = false;
    }

    update(delta) {
        if(!this.exists) return;
        const speed = UnitTypes.TypeData[this.type].speed * delta;
        if(!this.targetPos.isNull()) {
            if(!this.hasMoved) this.hasMoved = true;
            let bounds = this.controller.engine.camera.bounds;
            let size = this.getSize();
            this.targetPos.x = clamp(
                this.targetPos.x,
                size,
                bounds.x - size
            );
        
            this.targetPos.y = clamp(
                this.targetPos.y,
                size,
                bounds.y - size
            );
            let dir = this.targetPos.sub(this.pos).normalize().sMul(speed);
            this.pos.addIp(dir);
            this.pos.x = clamp(this.pos.x, size, bounds.x); this.pos.y = clamp(this.pos.y, size, bounds.y);

            if(this.pos.dist(this.targetPos) < 1 || (bounds.x-this.pos.x < 2 && bounds.y-this.pos.y < 2)) {
                this.targetPos.setIp(new Vector2(null, null));
                this.onReachDestination();
            }
        }
    }

    getDamage() {
        return UnitTypes.TypeData[this.type].damage * this.count;
    }

    getSize() {
        const d = UnitTypes.TypeData[this.type].visual;
        let size = d.size+(this.count*0.1);
        return size * this.controller.engine.camera.scale;
    }

    render(ctx) {
        const camera = this.controller.engine.camera;
        const d = UnitTypes.TypeData[this.type].visual;
        let size = this.getSize();

        let pos = camera.worldToScreen(this.pos);
        let tpos = camera.worldToScreen(this.targetPos);
        if(!this.targetPos.isNull()) {
            ctx.strokeStyle = "cyan";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
                tpos.x,
                tpos.y,
                size*0.2,
                0,
                Math.PI * 2
            );
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(tpos.x, tpos.y);
            ctx.stroke();
        }
        ctx.fillStyle = d.color;
        ctx.fillRect(pos.x-(size/2), pos.y-(size/2), size, size);

        if(this.selected) {
            ctx.strokeStyle = "cyan";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
                pos.x,
                pos.y,
                size*1.05,
                0,
                Math.PI * 2
            );
            ctx.stroke();
            ctx.fillStyle = "rgba(0,255,255,0.2)";
            ctx.beginPath();
            ctx.arc(
                pos.x,
                pos.y,
                size*1.05,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }

    onReachDestination() {
        let size = this.getSize();
        let eligible_mergers = this.controller.getUnitsWithinDist(this.pos, size).filter(u => u.type == this.type && u != this);
        if(eligible_mergers.length > 0) {
            eligible_mergers = eligible_mergers.filter(u => u.exists);
            if(eligible_mergers.length > 0) this.controller.mergeLater(this,  eligible_mergers[0]);
        }
    }
}
class UnitController {
    constructor(engine) {
        this.units = new Array();
        this.pendingMerges = new Array();
        this.engine = engine;
    }

    init() {
        this.createUnit("infantry", 1, 100, 100);
        this.createUnit("infantry", 50, 200, 200);
        this.createUnit("infantry", 200, 300, 300);
        this.createUnit("infantry", 100, 1000, 1000);
        this.createUnit("infantry", 5, 500, 500);
    }

    createUnit(type, count, x, y) {
        let n = new Unit(type, count, x, y, this);
        this.units.push(n);
        return n;
    }

    render(ctx) {
        this.units.forEach(u => u.render(ctx));
    }

    getUnitsInRect(x, y, w, h) {
        let units = []
        this.units.forEach(u => {
            let size = u.getSize()
            if(Maths.rectRect(u.pos.x, u.pos.y, size, size, x, y, w, h)) {
                units.push(u)
            }
        });
        return units;
    }

    getUnitsWithinDist(pos, maxDist) {
        let units = [];
        this.units.forEach(u => {
            if(pos.dist(u.pos) <= maxDist) {
                units.push(u)
            }
        });
        return units;
    }

    destroyUnit(unit) {
        unit.exists = false;
        this.units.splice(this.units.indexOf(unit), 1);
    }

    mergeLater(a, b) {
        if (a.mergeTarget || b.mergeTarget) return;

        a.mergeTarget = b;
        this.pendingMerges.push([a, b]);
    }

    update(delta) {
        for (const u of this.units) {
            u.update(delta);
        }
    
        let merged;
    
        do {
            merged = false;
    
            outer:
            for (let i = 0; i < this.units.length; i++) {
                const a = this.units[i];
    
                for (let j = i + 1; j < this.units.length; j++) {
                    const b = this.units[j];
    
                    if (
                        a.exists &&
                        b.exists &&
                        a.type === b.type &&
                        a.pos.dist(b.pos) <= Math.max(a.getSize(), b.getSize()) &&
                        a.targetPos.isNull() && b.targetPos.isNull() &&
                        !a.lockedFromMerging && !b.lockedFromMerging &&
                        a.hasMoved && b.hasMoved
                    ) {
                        this.merge(b, a);
                        merged = true;
                        break outer;
                    }
                }
            }
        } while (merged);
    }

    merge(unit1, unit2) {
        if (!unit1.exists || !unit2.exists) return;
        if (unit1 === unit2) return;
        unit1.count += unit2.count;
        this.destroyUnit(unit2);

    }
    split(unit, count) {
        if(count > unit.count) {
            count = unit.count
        }
        const perGroup = Math.floor(unit.count/count)
        for(let x = 0; x < Math.max(0, count-1); x++) {
            this.createUnit(unit.type, perGroup, unit.pos.x + -(unit.getSize()*1.5) + (Math.random()*(unit.getSize()*1.5)), unit.pos.y + -(unit.getSize()*1.5) + (Math.random()*(unit.getSize()*1.5)))
        }
        let needs_extra = (perGroup * count != unit.count)
        this.createUnit(unit.type, needs_extra ? perGroup+1 : perGroup, unit.pos.x + (Math.random()*unit.getSize()*1.5), unit.pos.y + (Math.random()*unit.getSize()*1.5))
        this.destroyUnit(unit);
    }

    createFormation(units, formation) {
        if (units.length === 0) return;
    
        // center formation on average position
        let center = new Vector2(0, 0);
    
        for (const u of units) {
            center.addIp(u.pos);
        }
    
        center.sDivIp(units.length);
    
        const positions = [];
    
        switch (formation) {
            case "horizontal line": {
                const spacing = 50;
    
                const startX =
                    center.x - ((units.length - 1) * spacing) / 2;
    
                for (let i = 0; i < units.length; i++) {
                    positions.push(
                        new Vector2(
                            startX + i * spacing,
                            center.y
                        )
                    );
                }
    
                break;
            }
    
            case "vertical line": {
                const spacing = 50;
    
                const startY =
                    center.y - ((units.length - 1) * spacing) / 2;
    
                for (let i = 0; i < units.length; i++) {
                    positions.push(
                        new Vector2(
                            center.x,
                            startY + i * spacing
                        )
                    );
                }
    
                break;
            }
    
            case "circle": {
                const radius = Math.max(
                    50,
                    units.length * 8
                );
    
                for (let i = 0; i < units.length; i++) {
                    const angle =
                        (i / units.length) * Math.PI * 2;
    
                    positions.push(
                        new Vector2(
                            center.x + Math.cos(angle) * radius,
                            center.y + Math.sin(angle) * radius
                        )
                    );
                }
    
                break;
            }
        }
    
        // assign closest unit to each position
        const remaining = [...units];
    
        for (const p of positions) {
            let best = 0;
            let bestDist = Infinity;
    
            for (let i = 0; i < remaining.length; i++) {
                const d = remaining[i].pos.dist(p);
    
                if (d < bestDist) {
                    bestDist = d;
                    best = i;
                }
            }
    
            const unit = remaining.splice(best, 1)[0];
    
            unit.targetPos.setIp(p);
        }
    }
}

class Map {
    constructor() {}
}
class Camera {
    constructor(engine) {
        this.pos = new Vector2(0, 0);
        this.engine = engine;
        this.scale = 1;
        this.speed = 1;

        this.uiOffset = new Vector2(0, 0);

        this.bounds = new Vector2(3000, 2000)
    }

    worldToScreen(worldPos) {
        const cx = this.engine.ctx.canvas.width / 2;
        const cy = this.engine.ctx.canvas.height / 2;
    
        return worldPos
            .sub(this.pos)
            .sMul(this.scale)
            .add(new Vector2(cx, cy));
    }

    screenToWorld(screenPos) {
        const cx = this.engine.ctx.canvas.width / 2;
        const cy = this.engine.ctx.canvas.height / 2;
    
        return screenPos
            .sub(new Vector2(cx, cy))
            .sDiv(this.scale)
            .add(this.pos);
    }

    zoomAt(mx, my, zoom) {
        const mouse = new Vector2(mx, my);
    
        const before = this.screenToWorld(mouse);
    
        const minScaleX = this.engine.ctx.canvas.width / this.bounds.x;
        const minScaleY = this.engine.ctx.canvas.height / this.bounds.y;
    
        this.scale = clamp(
            this.scale * zoom,
            Math.max(minScaleX, minScaleY),
            5
        );
    
        const after = this.screenToWorld(mouse);
    
        this.pos.addIp(before.sub(after));
    
        const halfW = (this.engine.ctx.canvas.width / 2) / this.scale;
        const halfH = (this.engine.ctx.canvas.height / 2) / this.scale;
    
        this.pos.x = clamp(
            this.pos.x,
            halfW,
            this.bounds.x - halfW
        );
    
        this.pos.y = clamp(
            this.pos.y,
            halfH,
            this.bounds.y - halfH
        );
    }

    move(dir) {
        const halfW = (this.engine.ctx.canvas.width / 2) / this.scale;
        const halfH = (this.engine.ctx.canvas.height / 2) / this.scale;
    
        let npos = this.pos.add(dir.sMul((this.speed / this.scale)));
    
        npos.x = clamp(npos.x, halfW, this.bounds.x - halfW);
        npos.y = clamp(npos.y, halfH, this.bounds.y - halfH);
    
        this.pos.setIp(npos);
    }
}

class Server {
    constructor() {}
}
class Lobby {
    constructor() {}
    getPlayers() {}
}

class Player {
    constructor() {}
}

class UIElement {
    constructor(type, pos, w, h, data, menu) {
        this.type = type; this.pos = pos; this.w = w; this.h = h; this.data = data;
        this.menu = menu;
    }

    getRenderPos() {
        const cp = this.menu.getRenderPos();
        const cw = cp.w; const ch = cp.h;
        return {
            "x": cp.x+(this.pos.x*cw),
            "y": cp.y+(this.pos.y*ch),
            "w": this.w*cw,
            "h": this.h*ch
        } 
    }
    render(ctx) {
        const rp = this.getRenderPos()

        switch(this.type) {
            case "text": {
                ctx.font = `${this.data.fontSize ?? 13}px monospace`;
                ctx.fillStyle = this.data.color ?? "black";
                ctx.fillText(this.data.text ?? "", rp.x, rp.y);
            }
            case "custom": {
                this.data.renderFn(ctx, this, rp);
            }
        }
    }
}
class Menu {
    constructor(pos, w, h, color, engine) {
        this.pos = pos; this.w = w; this.h = h;
        this.UIElements = new Array(); this.color = color;
        this.engine = engine; this.visible = false;
        this.opacity = 1; this.scalePos = true;
    }

    createUIElement(type, pos, w, h, data) {
        let n = new UIElement(type, pos, w, h, data, this);
        this.UIElements.push(n);
        return n;
    }

    getRenderPos() {
        let p = this.engine.getPos(this.pos.x, this.pos.y, this.w, this.h);
        if(!this.scalePos) {
            p.x = this.pos.x; p.y = this.pos.y;
        }
        return p
    }

    render(ctx) {
        let rp = this.getRenderPos();
        
        ctx.globalAlpha = this.opacity;
        
        ctx.fillStyle = this.color;
        ctx.fillRect(rp.x, rp.y, rp.w, rp.h);
        ctx.strokeStyle = "rgba(128, 128, 128, 1)";
        ctx.strokeRect(rp.x, rp.y, rp.w, rp.h)

        this.UIElements.forEach(ele => ele.render(ctx));
        
        ctx.globalAlpha = 1;
    }
}

class Engine {
    constructor(ctx) {
        this.ctx = ctx;
        this.fps_data = new Array();
        this._previousElapsed = null;

        this.mousePressed = [false, false]
        this.mousePos = new Vector2(0, 0);
        this.lastMousePos = new Vector2(0, 0);
        this.keyboard = new Keyboard();

        this.menus = {
            "unit_menu": new Menu(new Vector2(0.01, 0.07), 0.12, 0.07, "rgba(188, 188, 188, 1)", this),
            "hover_menu": new Menu(new Vector2(0, 0), 0.1, 0.1, "rgba(188, 188, 188, 1)", this)
        };

        this.selection = {
            "active": false,
            "start": new Vector2(0, 0),
            "end": new Vector2(0, 0)
        }

        this.data = {
            "mode": null,
            "last_mode": null,
            "mode_data": {
                "inputted_data": ""
            }
        }

        this.selected_units = new Array();

        this.units = new UnitController(this);
        this.units.init();

        this.camera = new Camera(this);
    }

    getPos(x, y, w, h) {
        const cw = this.ctx.canvas.width; const ch = this.ctx.canvas.height;
        return {
            "x": x*cw,
            "y": y*ch,
            "w": w*cw,
            "h": h*ch
        }
    }
    _resize() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;
    }
    onLClick() {
        if(this.data.mode == "move") {
            this.selected_units.forEach(u => {
                u.targetPos.setIp(this.camera.screenToWorld(this.mousePos));
            })
            this.data.mode = null;
            this.data.mode_data.inputted_data = ""
            return;
        }
        let clicked_unit = null;
        this.units.units.forEach(u => {
            let size = u.getSize()
            const pos = this.camera.worldToScreen(u.pos);

            if (Maths.rectRect(this.mousePos.x - 5, this.mousePos.y - 5, 10, 10, pos.x - size/2, pos.y - size/2, size, size)) { 
                clicked_unit = u; 
            }
        })
        this.selected_units.forEach(u => { u.selected = false })
        this.selected_units = [];
        this.data.mode = null;
        this.data.mode_data.inputted_data = ""
        if(clicked_unit == null) {
            this.selection.active = true;
            this.selection.start.setIp(this.camera.screenToWorld(this.mousePos));
        } else {
            this.selected_units.push(clicked_unit);
            clicked_unit.selected = true;
        }
    }
    onRClick() {}
    onLRelease() {
        if(this.selection.active) {
            const x = Math.min(this.selection.start.x, this.selection.end.x);
            const y = Math.min(this.selection.start.y, this.selection.end.y);
        
            const w = Math.abs(this.selection.end.x - this.selection.start.x);
            const h = Math.abs(this.selection.end.y - this.selection.start.y);
        
            this.selected_units = this.units.getUnitsInRect(x, y, w, h);
        
            this.selected_units.forEach(u => {
                u.selected = true;
            });
        
            this.selection.active = false;
        }
    }
    onRRelease() {}
    setupMenus() {}
    getPossibleKeybinds() {
        let names = [];

        names.push(["a", "select all"])
        if(this.selected_units.length > 0) {
            names.push(["m", `(click) move unit${this.selected_units.length > 1 ? "s" : ""}`])
            names.push(["s", `(input numbers) split unit${this.selected_units.length > 1 ? "s" : ""} into groups`])
            names.push(["n", "(input number) select nearby units"])
        }
        if(this.selected_units.length > 1) {
            names.push(["f", "(input shortcut) assemble formation"])
        }
        if(this.data.mode == "split") {
            names.push(["1-0", "select number of groups"])
        }
        if(this.data.mode == "nearby") {
            names.push(["1-0", "select distance"])
        }
        if(this.data.mode == "formation") {
            names.push(["h", "horizontal line formation"])
            names.push(["v", "vertical line formation"])
            names.push(["c", "circle formation"])
        }

        return names;
    }
    init() {
        this.keyboard.listenForEvents(["KeyA", "KeyM", "KeyS", 
            "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", 
            "KeyF", "KeyH", "KeyV", "KeyC", "KeyN", "Backspace", "KeyL"]);
        this.keyboard.setFunctionOnKeyPress("KeyA", () => {
            this.selection.active = false;
            if(this.units.units.length != this.selected_units.length) {
                this.data.mode_data.inputted_data = ""
                this.data.mode = null;
            }

            this.selected_units = [];
            this.units.units.forEach(u => { this.selected_units.push(u); u.selected = true; });
        });

        // selected unit modes
        const switchMode = (mode) => {
            this.data.last_mode = this.data.mode;
            this.data.mode = this.data.mode == mode ? null : mode;
            if(this.data.last_mode == mode) {
                activate(mode);
            }
            this.data.mode_data.inputted_data = "";
        }
        const activate = (mode) => {
            switch(mode) {
                case "split": {
                    const groups = parseInt(this.data.mode_data.inputted_data);
                    
                    if(groups == NaN) return;
                    this.selected_units.forEach(u => {
                        this.units.split(u, groups);
                    })
                }
                case "formation": {
                    this.units.createFormation(this.selected_units, this.data.mode_data.inputted_data)
                }
                case "nearby": {
                    const max_dist = parseInt(this.data.mode_data.inputted_data);
                    let avg_pos = new Vector2(0, 0);
                    this.selected_units.forEach(u => avg_pos.addIp(u.pos));
                    avg_pos.sDivIp(this.selected_units.length);
                    let founds = this.units.getUnitsWithinDist(avg_pos, max_dist).filter(u => u != this.selected_units[0]);
                    founds.forEach(u => {
                        u.selected = true;
                        this.selected_units.push(u);
                    })
                }
            }
        }
        this.keyboard.setFunctionOnKeyPress("KeyM", () => {
            if(this.selected_units.length > 0) {
                switchMode("move");
            }
        });
        this.keyboard.setFunctionOnKeyPress("KeyL", () => {
            if(this.selected_units.length > 0) {
                this.selected_units.forEach(u => u.lockedFromMerging = !u.lockedFromMerging)
            }
        });
        this.keyboard.setFunctionOnKeyPress("Backspace", () => {
            if(["nearby", "split"].includes(this.data.mode)) {
                this.data.mode_data.inputted_data = this.data.mode_data.inputted_data.slice(0, -1) ?? ""
            }
        })
        this.keyboard.setFunctionOnKeyPress("KeyN", () => {
            if(this.selected_units.length > 0) {
                switchMode("nearby");
            }
        })
        this.keyboard.setFunctionOnKeyPress("KeyS", () => {
            if(this.selected_units.length > 0) {
                switchMode("split");
            }
        })
        this.keyboard.setFunctionOnKeyPress("KeyF", () => {
            if(this.selected_units.length > 1) {
                switchMode("formation");
            }
        })
        this.keyboard.setFunctionOnKeyPress("KeyH", () => {
            if(this.data.mode == "formation") {
                this.data.mode_data.inputted_data = "horizontal line"
            }
        })
        this.keyboard.setFunctionOnKeyPress("KeyV", () => {
            if(this.data.mode == "formation") {
                this.data.mode_data.inputted_data = "vertical line"
            }
        })
        this.keyboard.setFunctionOnKeyPress("KeyC", () => {
            if(this.data.mode == "formation") {
                this.data.mode_data.inputted_data = "circle"
            }
        })
        const getNumberFunction = (code) => {
            return () => {
                switch(this.data.mode) {
                    case "split": {
                        if(this.data.mode_data.inputted_data.length < 2) {
                            this.data.mode_data.inputted_data = this.data.mode_data.inputted_data.concat(code.split("Digit")[1]);
                        }
                        break;
                    }
                    case "nearby": {
                        if(this.data.mode_data.inputted_data.length < 4) {
                            this.data.mode_data.inputted_data = this.data.mode_data.inputted_data.concat(code.split("Digit")[1]);
                        }
                        break;
                    }
                }
            }
        }

        for(let x = 0; x <= 9; x++) {
            this.keyboard.setFunctionOnKeyPress(`Digit${x}`, getNumberFunction(`Digit${x}`));
        }

        window.addEventListener("resize", () => { this._resize(); })
        window.addEventListener("mousedown", (e) => { this.mousePressed = [e.button == 0 ? true : this.mousePressed[0], e.button == 2 ? true : this.mousePressed[1]]; if(e.button == 0 ){ this.onLClick() } else if(e.button == 2) { this.onRClick() }})
        window.addEventListener("mouseup", (e) => { this.mousePressed = [e.button == 0 ? false : this.mousePressed[0], e.button == 2 ? false : this.mousePressed[1]]; if(e.button == 0 ){ this.onLRelease() } else if(e.button == 2) { this.onRRelease() }})
        window.addEventListener("contextmenu", (e) => { e.preventDefault() })
        window.addEventListener("mousemove", (e) => { this.lastMousePos.setIp(this.mousePos); this.mousePos.x = e.clientX; this.mousePos.y = e.clientY; });
        window.addEventListener("wheel", e => { this.camera.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9); });
        this.menus.unit_menu.opacity = 0.7
        this.menus.unit_menu.createUIElement("custom", new Vector2(0.5, 0.5), 0, 0, {"renderFn": (ctx, e, rp) => {
            ctx.fillStyle = "black";
            ctx.font = "12px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let c = 0;
            this.selected_units.filter(u => u.exists).forEach(u => c += u.count);
            ctx.fillText(`${c} units`, rp.x, rp.y);
        }})

        this.menus.hover_menu.visible = true;
        this.menus.hover_menu.scalePos = false;
        this.menus.hover_menu.createUIElement("custom", new Vector2(0.5, 0.5), 0, 0, {"renderFn": (ctx, e, rp) => {
            let unit = e.data.unit;
            ctx.fillStyle = "black";
            ctx.font = "12px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${unit.count} ${unit.type} unit${unit.count > 1 ? "s" : ""}`, rp.x, rp.y);
        }})
    }
    update(delta) {
        this.selected_units.filter(u => !u.exists).forEach((u, index) => {
            this.selected_units.splice(index, 1);
        })
        document.body.style.cursor = "default"
        switch(this.data.mode) {
            case "move": document.body.style.cursor = "alias"
        }
        if(this.selection.active) {
            this.selection.end.setIp(this.camera.screenToWorld(this.mousePos));
            document.body.style.cursor = "crosshair"
        }
        this.menus.unit_menu.visible = this.selected_units.length > 0;
        this.menus.hover_menu.pos.setIp(this.mousePos.add(new Vector2(10, 10)));
        this.menus.hover_menu.visible = false;
        this.menus.hover_menu.UIElements[0].data.unit = null;
        this.units.units.forEach(u => {
            let size = u.getSize();
            let pos = this.camera.worldToScreen(u.pos);
            if(Maths.rectRect(this.mousePos.x-5, this.mousePos.y-5, 10, 10, pos.x-size/2, pos.y-size/2, size, size)) {
                this.menus.hover_menu.visible = true;
                this.menus.hover_menu.UIElements[0].data.unit = u;
                document.body.style.cursor = "pointer"
            }
        })

        if(this.mousePressed[1]) {
            document.body.style.cursor = "move"
            let d = this.mousePos.sub(this.lastMousePos).invert();
            this.camera.move(d);
        } else {
            this.camera.move(new Vector2(0, 0))
        }
        
        this.units.update(delta);
    }
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // units
        this.units.render(ctx);

        // selection box
        if(this.selection.active) {
            const p1 = this.camera.worldToScreen(this.selection.start);
            const p2 = this.camera.worldToScreen(this.selection.end);

            const x = Math.min(p1.x, p2.x);
            const y = Math.min(p1.y, p2.y);

            const w = Math.abs(p2.x - p1.x);
            const h = Math.abs(p2.y - p1.y);

            ctx.fillStyle = "rgba(0,255,255,0.4)";
            ctx.fillRect(x, y, w, h);

            ctx.strokeStyle = "cyan";
            ctx.strokeRect(x, y, w, h);
        }

        // topbar
        const topbar_pos = this.getPos(0, 0, 1, 0.05);
        const draw_topbar_seperator = (x) => {
            let rx = topbar_pos.w*x;
            ctx.strokeStyle = "rgba(128, 128, 128, 1)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(rx, topbar_pos.y)
            ctx.lineTo(rx, topbar_pos.y+topbar_pos.h);
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(188, 188, 188, 1)";
        ctx.strokeStyle = "rgba(128, 128, 128, 1)";
        ctx.lineWidth = 3;
        ctx.fillRect(topbar_pos.x, topbar_pos.y, topbar_pos.w, topbar_pos.h)
        ctx.beginPath();
        ctx.moveTo(topbar_pos.x, topbar_pos.y+topbar_pos.h);
        ctx.lineTo(topbar_pos.x+topbar_pos.w, topbar_pos.y+topbar_pos.h)
        ctx.stroke();

        // menus
        Object.values(this.menus).filter(m => m.visible).forEach(m => m.render(ctx));

        // fps
        ctx.fillStyle = "black";
        ctx.font = "15px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let pos = this.getPos(0.03, 0.025, 0.1, 0.1);
        let avg = 0; for(let x = 0; x < this.fps_data.length; x++) { avg += this.fps_data[x]; }; avg /= this.fps_data.length;
        ctx.fillText(`${(1/avg).toFixed(0)} fps`, pos.x, pos.y);
        draw_topbar_seperator(0.065)

        // mode shower
        ctx.textAlign = "left";
        let pos2 = this.getPos(0.08, 0.025, 0.1, 0.1);
        ctx.fillText(`mode: ${this.data.mode ?? "none"}`, pos2.x, pos2.y);
        draw_topbar_seperator(0.2)

        // mode data
        if(this.data.mode_data.inputted_data.length != 0) {
            ctx.fillStyle = "rgba(128, 128, 128, 0.3)";
            ctx.font = "50px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let dpos = this.getPos(0.5, 0.5, 0, 0);
            ctx.fillText(this.data.mode_data.inputted_data, dpos.x, dpos.y);
        }

        // draw keybinds
        const binds = this.getPossibleKeybinds();

        ctx.fillStyle = "rgba(128,128,128,1)";
        ctx.font = `${Math.max(12, this.ctx.canvas.height * 0.015)}px monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const startX = 0.01;
        const startY = 0.90;

        const rowHeight = 0.025;
        const colWidth  = 0.3;

        const maxRows = Math.floor((1 - startY) / rowHeight);

        binds.forEach((b, i) => {
            const row = i % maxRows;
            const col = Math.floor(i / maxRows);

            const p = this.getPos(
                startX + col * colWidth,
                startY + row * rowHeight,
                0,
                0
            );

            ctx.fillText(
                `[${b[0]}] ${b[1]}`,
                p.x,
                p.y
            );
        });

        switch(this.data.mode) {
            case "nearby": {
                let avg_pos = new Vector2(0, 0);
                this.selected_units.forEach(u => avg_pos.addIp(u.pos));
                avg_pos.sDivIp(this.selected_units.length);
                avg_pos = this.camera.worldToScreen(avg_pos);
                ctx.strokeStyle = "grey";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(
                    avg_pos.x,
                    avg_pos.y,
                    (parseInt(this.data.mode_data.inputted_data) ?? 0) * this.camera.scale,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();
            }
        }
            
    }
    tick(elapsed) {
        if(this._previousElapsed === null) {
            this._previousElapsed = elapsed;
            window.requestAnimationFrame(this.tick.bind(this));
            return;
        }
    
        const d = (elapsed - this._previousElapsed) / 1000;
        if(d > 1) {
            console.log("resync")
        }
        const delta = Math.min(
            d,
            0.12
        );
    
        this._previousElapsed = elapsed;

        if(this.fps_data.length > 5) {
            this.fps_data.pop();
        }
        this.fps_data.push(delta);
    
        this.update(delta);
        this.render();
    
        window.requestAnimationFrame(this.tick.bind(this));
    }
}

const c = document.getElementById("canvas");
c.width = window.innerWidth;
c.height = window.innerHeight;
const e = new Engine(c.getContext("2d"))
e.init();
window.requestAnimationFrame(e.tick.bind(e));