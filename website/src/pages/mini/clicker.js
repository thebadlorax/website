/**
 * author thebadlorax
 * created on 08-06-2026-22h-01m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Maths } from "./maths.js";
import { formatNumber } from "../common.js";
import { Loader, generateRandomString } from "./mini-common.js";

class Renderer {
    constructor(ctx, engine, loader) {
        this.ctx = ctx; this.engine = engine;
        this.loader = loader;
    }

    init() {
        this.MENUS = {
            "upgrade_menu": new Menu(1-0.3, 0, 0.3, 1, this.engine)
        }

        const um = this.MENUS.upgrade_menu;
        um.color = "#3d2929"
        um.visible = true;
    }

    renderMenus() {
        Object.values(this.MENUS).filter(m => m.visible).forEach(m => m.render(this.ctx));
    }

    clear() {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height); 
    }

    drawFPS(avg) {
        this.ctx.fillStyle = "grey";
        this.ctx.font = "20px monospace";
        this.ctx.fillText(`${avg.toFixed(0)} fps`, 45, 35)
    }
}

class Save {
    constructor() {
        this.data = {
            "money": 50000
        }
    }

    async init() {}

    async modifyValue(name, val) {
        this.data[name] = val;
        this.updateStorage();
    }

    updateStorage() { }
}

class Upgrade { 
    static INDEX = [
        new Upgrade("onclick", 0, "better axe", "+1 money per click", (a) => {
            return a+1;
        }, 50, 1.15, 0),
        new Upgrade("pps", 1, "hire employee", "+1 money per tick", (a) => {
            return a+1;
        }, 100, 1.15, 0),
        new Upgrade("tickspeed", 2, "automatic log cutter", "*1.1 tickspeed", (a) => {
            return a*0.9
        }, 200, 10, 0),
        new Upgrade("treemoney", 3, "taller trees", "+250 money from trees", (a) => {
            return a+250
        }, 200, 1.15, 1),
        new Upgrade("treegrid", 4, "more acres", "+plots", (a) => {
            return a+1
        }, 500, 50, 1),
        new Upgrade("pps", 5, "employ contractor", "*1.05 mpt", (a) => {
            return a*1.05
        }, 400, 3, 1),
        new Upgrade("level", 100, "get a promotion", "unlock new things", (a) => {
            return a+1
        }, 500, 100, 0),
    ]

    constructor(type, id, name, desc, fn, cost, costGrowth, level) {
        this.type = type;
        this.id = id;
        this.name = name;
        this.desc = desc;
        this.fn = fn;
        this.cost = cost; this.costGrowth = costGrowth;
        this.level = level;
    }

    getCost(count) {
        return Math.floor(this.cost * Math.pow(this.costGrowth, count));
    }
}

class UIElement {
    constructor(type, x, y, w, h, data, menu) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.menu = menu; this.onclick = null;
        this.type = type; this.data = data;
        this.scale = 1; this.clickScale = 1; this.hoverScale = 1;
    }

    getPerToScreen() {
        const rpos = this.menu.getPerToScreen();
        return {
            x: rpos.x + (this.x*rpos.w),
            y: rpos.y + (this.y*rpos.h),
            w: this.w*rpos.w,
            h: this.h*rpos.h,
        }
    }

    render(ctx) {
        const rpos = this.getPerToScreen();
        switch(this.type) {
            case "textbutton": {
                const sw = rpos.w * this.hoverScale * this.clickScale;
                const sh = rpos.h * this.hoverScale * this.clickScale;
                const sx = rpos.x - (sw - rpos.w) / 2;
                const sy = rpos.y - (sh - rpos.h) / 2;

                ctx.textAlign = "center";
                ctx.fillStyle = this.data.bgColor;
                ctx.fillRect(sx, sy, sw, sh);
                ctx.font = `${this.data.fontSize ?? 13}px monospace`;
                ctx.fillStyle = this.data.textColor ?? "white";
                ctx.fillText(this.data.text || "", sx + sw/2, sy + sh/2);
                ctx.strokeStyle = "black";
                ctx.strokeRect(sx, sy, sw, sh);
                break;
            }
            case "upgradeButton": {
                const u = this.data.upgrade;
                const sw = rpos.w * this.hoverScale * this.clickScale;
                const sh = rpos.h * this.hoverScale * this.clickScale;

                const sx = rpos.x - (sw - rpos.w) / 2;
                const sy = rpos.y - (sh - rpos.h) / 2;
                ctx.fillStyle = "grey";
                ctx.fillRect(sx, sy, sw, sh);

                ctx.textAlign = "left";
                ctx.font = `${30}px monospace`
                ctx.fillStyle = "white";
                ctx.fillText(`${u.name}`, sx+5, sy + 20)
                ctx.font = `${20}px monospace`
                ctx.fillStyle = "darkgrey";
                ctx.fillText(`${u.desc} (${this.data.count}) `, sx+5, sy + sh*.8)

                ctx.strokeStyle = "black";
                ctx.strokeRect(sx, sy, sw, sh);
                break;
            }
            case "custom": {
                this.data.renderFn(this, rpos, ctx);
                break;
            }
        }
    }

    isHovering(mouseX, mouseY) {
        const rpos = this.getPerToScreen();

        return Maths.rectRect(
            mouseX - 5,
            mouseY - 5,
            10,
            10,
            rpos.x,
            rpos.y,
            rpos.w,
            rpos.h
        );
    }
}
class Menu {
    constructor(x, y, w, h, engine) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.UIElements = []; this.engine = engine;
        this.color = "white"; this.visible = false;
    }

    getPerToScreen() {
        return {
            x: this.x*this.engine.renderer.ctx.canvas.width,
            y: this.y*this.engine.renderer.ctx.canvas.height,
            w: this.w*this.engine.renderer.ctx.canvas.width,
            h: this.h*this.engine.renderer.ctx.canvas.height,
        }
    }

    createUIElement(type, x, y, w, h, data) {
        const u = new UIElement(type, x, y, w, h, data, this)
        this.UIElements.push(u);
        return u;
    }

    render(ctx) {
        const rpos = this.getPerToScreen();
        ctx.fillStyle = this.color;
        ctx.fillRect(rpos.x, rpos.y, rpos.w, rpos.h);

        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.strokeRect(rpos.x, rpos.y, rpos.w, rpos.h)

        this.UIElements.forEach(u => u.render(ctx));
    }

    handleClick() {
        this.UIElements.forEach(u => {
            const rpos = u.getPerToScreen();
            if(u.onclick != null && Maths.rectRect(this.engine.mousePos[0]-5, this.engine.mousePos[1]-5, 10, 10, rpos.x, rpos.y, rpos.w, rpos.h)) {
                u.clickScale = .9
                u.onclick();
            }
        })
        
    }
}

class UpgradeManager {
    constructor(engine) {
        this.engine = engine;
        
        this.owned_upgrades = []
    }

    idToUpgrade(id) { return Upgrade.INDEX.find(u => u.id == id); }

    upgradesAsList() { 
        let l = [];
        this.owned_upgrades.forEach(u => {
            for(let x = 0; x < u.count; x++) {
                l.push(this.idToUpgrade(u.id))
            }
        })
        return l;
    }

    getClickValue() {
        let v = 1;
        this.upgradesAsList().filter(u => u.type == "onclick").map(u => u.fn).forEach(u => v = u(v));
        return v;
    }

    getTreeBonus() {
        let v = 0;
        this.upgradesAsList().filter(u => u.type == "treemoney").map(u => u.fn).forEach(u => v = u(v));
        return v;
    }

    getTreeGridSize() {
        let v = 2;
        this.upgradesAsList().filter(u => u.type == "treegrid").map(u => u.fn).forEach(u => v = u(v));
        return Math.floor(v);
    }

    getOwned(id) {
        return this.owned_upgrades.find(u => u.id === id);
    }

    addUpgrade(id) {
        if(this.idToUpgrade(id).type == "level") {
            this.engine.save.modifyValue("level", (this.engine.save.data.level ?? 0)+1);
            Object.values(this.engine.minigames).forEach(m => m.considerActivation());
        }
        let u = this.owned_upgrades.find(u => u.id == id)
        if(u == undefined) {
            this.owned_upgrades.push({
                "id": id,
                "count": 1
            });
            this.refreshUpgradeMenu();
            return;
        }
        u.count += 1;
        this.refreshUpgradeMenu();
    }

    getTickCooldown() {
        let v = 1;
        this.upgradesAsList().filter(u => u.type == "tickspeed").map(u => u.fn).forEach(u => v = u(v));
        return v;
    }

    getPointsPerSecond() {
        let v = 0;
        this.upgradesAsList().filter(u => u.type == "pps").map(u => u.fn).forEach(u => v = u(v));
        return v;
    }

    refreshUpgradeMenu() {
        const um = this.engine.renderer.MENUS.upgrade_menu;
        um.UIElements = [];
        Upgrade.INDEX.sort((a, b) => a.id - b.id).filter(u => u.level <= (this.engine.save.data.level ?? 0)).forEach((u, index) => {
            const owned = this.getOwned(u.id)?.count ?? 0;
            let t = um.createUIElement("upgradeButton", 0.05, 0.05+(0.125*index), 0.9, 0.1, {"upgrade":u,"count":owned, "textColor":"black","bgColor":"grey"});
            t.onclick = async () => {
                const cost = u.getCost(owned);
            
                if (this.engine.save.data.money >= cost) {
                    this.addUpgrade(u.id);
                    let t = this.engine.save.data.money - cost;
                    await this.engine.save.modifyValue("money", t);
                    let p = this.engine.perToScreenPos(0.5, 0.1, 50, 50);
                    this.engine.misc.holograms.push({
                        "x": p.x+(30-Math.random()*60),
                        "y": p.y+(30-Math.random()*60),
                        "text": `-${formatNumber(cost)}`,
                        "color": "255, 0, 0",
                        "size": 15,
                        "lifespan": .8,
                        "timealive": 0
                    });
                    switch(u.type) {
                        case "treegrid": {
                            this.engine.minigames.forest.refreshMenu();
                        }
                    }
                }
            }
        });
    }

    init() {
        this.refreshUpgradeMenu()
    }
}

class Minigame {
    constructor(engine, x, y, w, h, level) {
        this.engine = engine;
        this.level = level;
        this.menu = new Menu(x, y, w, h, engine)
        this.activated = false;
        this.engine.renderer.MENUS[generateRandomString(5)] =  this.menu;
        this.considerActivation();
    }

    activate() {
        this.menu.visible = true;
        this.activated = true;
    }
    considerActivation() {
        if((this.engine.save.data.level ?? 0) < this.level || this.activated) return;
        this.activate();
    }
    update(delta) { if((this.engine.save.data.level ?? 0) < this.level) return; }
    render() {}
    onClick() {}
}

class ForestMinigame extends Minigame {
    static SEED_DATA = {
        "oak": {
            "cost": 250,
            "reward": 1000
        },
        "maple": {
            "cost": 1000,
            "reward": 5000
        }
    };

    static BASE_GROWTH_SPEED = 30000;
    constructor(engine) {
        super(engine, 0.245, 0.495, 0.45, 0.5, 1);
        this.menu.color = "#9b7653"

        this.growth_data = {}
        this.last_growth_tick = null;

        this.selected_tree = "oak";
    }

    refreshMenu() {
        const COLS = this.engine.upgradeManager.getTreeGridSize();
        const ROWS = this.engine.upgradeManager.getTreeGridSize()-1;
    
        const rpos = this.menu.getPerToScreen();
    
        const cellW = rpos.w*.8 / COLS;
        const cellH = rpos.h*.8 / ROWS;
    
        const offsetX = 10;
        const offsetY = 10;
    
        this.menu.UIElements = [];
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
    
                const px = x * cellW;
                const py = y * cellH;
    
                let t = this.menu.createUIElement(
                    "custom",
                    (offsetX + px) / rpos.w,
                    (offsetY + py) / rpos.h,
                    cellW / rpos.w,
                    cellH / rpos.h,
                    {
                        "c": `${64+(-15+Math.random()*30)}, ${41+(-10+Math.random()*20)}, ${5+(-5+Math.random()*10)}`,
                        renderFn: (t, rpos2, ctx) => {
                            ctx.fillStyle = `rgba(${t.data.c}, 1)`
                            ctx.fillRect(rpos2.x, rpos2.y, rpos2.w, rpos2.h)
                            ctx.strokeStyle = "black";
                            ctx.strokeRect(rpos2.x, rpos2.y, rpos2.w, rpos2.h);

                            const d = this.growth_data[`${x};${y}`];
                            if(d != undefined) {
                                ctx.drawImage(
                                    this.engine.renderer.loader.getImage(`${d.seed}_tree_growth`),
                                    d.growth_stage*128,
                                    0,
                                    128,
                                    128,
                                    (rpos2.x+rpos2.w/2)-64,
                                    (rpos2.y+rpos2.h/2)-64,
                                    128,
                                    128
                                )
                            };
                        }
                    }
                );

                t.onclick = () => {
                    if(this.growth_data[`${x};${y}`] == undefined) {
                        this.placeTree(x, y, this.selected_tree)
                    } else {
                        this.harvestTree(x, y);
                    }
                }
            }
        };
        this.menu.createUIElement("custom", 0.5, 0.925, 1, 1, {"renderFn": (t, rpos2, ctx) => {
            ctx.fillStyle = "black";
            ctx.font = "20px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`next growth tick: ${((this.getGrowthTime()-(Date.now()-this.last_growth_tick))/1000).toFixed(1)}s`, rpos2.x, rpos2.y)
        }});

        let ob = this.menu.createUIElement("textbutton", 0.835, 0.1, 0.15, 0.1, {"text": "oak seeds", "bgColor": "darkgrey", "fontSize": 10, "cost": ForestMinigame.SEED_DATA.oak.cost});
        ob.onclick = () => {
            this.menu.UIElements.filter(u => u.data.cost != undefined).forEach(u => { u.data.bgColor = "black"});
            ob.data.bgColor = "darkgrey"
            this.selected_tree = "oak";
        }
        let mb = this.menu.createUIElement("textbutton", 0.835, 0.23, 0.15, 0.1, {"text": "maple seeds", "bgColor": "black", "fontSize": 10, "cost": ForestMinigame.SEED_DATA.maple.cost});
        mb.onclick = () => {
            this.menu.UIElements.filter(u => u.data.cost != undefined).forEach(u => { u.data.bgColor = "black"});
            mb.data.bgColor = "darkgrey"
            this.selected_tree = "maple";
        }
    }

    getGrowthTime() {
        return ForestMinigame.BASE_GROWTH_SPEED
    }

    placeTree(x, y, seed) {
        const cost = ForestMinigame.SEED_DATA[seed].cost
        if(this.engine.save.data.money >= cost) {
            this.growth_data[`${x};${y}`] = {
                "seed": seed,
                "last_growth": Date.now(),
                "growth_stage": 0,
                "decay_stage": 0
            }
            this.engine.save.modifyValue("money", this.engine.save.data.money-cost);
        }
        
    }

    activate() {
        super.activate();
        this.startGrowthLoop();
        this.refreshMenu();
    }

    async harvestTree(x, y) {
        let t = this.growth_data[`${x};${y}`];
        if(t.growth_stage >= 4) {
            if(t.growth_stage == 5) {
                // too late
            } else {
                await this.engine.save.modifyValue("money", this.engine.save.data.money + ForestMinigame.SEED_DATA[t.seed].reward + this.engine.upgradeManager.getTreeBonus());
            }
            delete this.growth_data[`${x};${y}`];
        };
    }

    async onGrowthTick() {
        this.last_growth_tick = Date.now();
        Object.values(this.growth_data).forEach((t, index) => {
            if(t.growth_stage >= 4) {
                if(t.decay_stage == 3) {
                    t.growth_stage += 1;
                }
                t.decay_stage += 1;
                return;
            }
            t.growth_stage += 1;
        })
    }

    startGrowthLoop() {
        const loop = async () => {
            await this.onGrowthTick();
    
            setTimeout(
                loop,
                this.getGrowthTime()
            );
        };
    
        loop();
    }

    update(delta) {
        super.update(delta);
    }
}

class Engine {
    constructor(ctx, loader) {
        this.renderer = new Renderer(ctx, this, loader);
        this.renderer.init();
        this.save = new Save();
        this.upgradeManager = new UpgradeManager(this);

        this.minigames = {
            "forest": new ForestMinigame(this)
        }

        this.cps = 0;
        this.cps_timer = 0;

        this.fps_data = []
        this.mousePos = [0, 0]
        this.misc = {
            "clickerScale": 1,
            "clickerTargetScale": 1,
            "clickScale": 1,
            "hoverScale": 1,
            "holograms": [],
            "appendToMoneyText": "",
            "appendToMoneyColor": "red",
            "appendToMoneySize": 25,
        };
        this._previousElapsed = null;
    }

    _resize() {
        const canvas = this.renderer.ctx.canvas;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    getClickerPos() {
        const canvas = this.renderer.ctx.canvas;
        return {
            "x": 40,
            "y": (canvas.height/2)-128,
            "w": 256,
            "h": 256
        }
    }

    isHoveringClicker() {
        const clickerPos = this.getClickerPos()
        if(Maths.rectRect(this.mousePos[0]-5, this.mousePos[1]-5, 10, 10, clickerPos.x, clickerPos.y, clickerPos.w, clickerPos.h)) return true
        return false;
    }

    perToScreenPos(xper, yper, minx=null, miny=null) {
        const canvas = this.renderer.ctx.canvas;
        let p = {
            x: canvas.width*xper,
            y: canvas.height*yper
        };
        if(minx != null) p.x = Math.max(minx, p.x);
        if(miny != null) p.y = Math.max(miny, p.y);
        return p;
    }

    render() {
        const ctx = this.renderer.ctx;
        this.renderer.clear();

        // draw clicker
        const clickerPos = this.getClickerPos();

        const scaledW = clickerPos.w * this.misc.clickerScale;
        const scaledH = clickerPos.h * this.misc.clickerScale;

        const scaledX = clickerPos.x - (scaledW - clickerPos.w) / 2;
        const scaledY = clickerPos.y - (scaledH - clickerPos.h) / 2;

        ctx.drawImage(
            this.renderer.loader.getImage("log"),
            scaledX,
            scaledY,
            scaledW,
            scaledH
        );

        // draw money
        ctx.fillStyle = "white"
        ctx.font = "50px monospace"
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const m = this.save.data.money ?? 0;
        const mtext = `$${formatNumber(m)}`
        const p = this.perToScreenPos(0.5, 0.1, 50, 50);
        ctx.fillText(mtext, p.x, p.y);
        const moneyWidth = ctx.measureText(mtext).width;
        const appendX = p.x + moneyWidth / 2 + 5;
        ctx.textAlign = "left";
        ctx.fillStyle = this.misc.appendToMoneyColor;
        ctx.font = `${this.misc.appendToMoneySize}px monospace`
        ctx.fillText(this.misc.appendToMoneyText, appendX, p.y);
        ctx.textAlign = "center";

        ctx.font = `30px monospace`
        ctx.fillStyle = "grey"
        ctx.fillText(`${formatNumber((1/this.upgradeManager.getTickCooldown()))} tps`, p.x+90, p.y+60);
        ctx.fillText(`${formatNumber(this.upgradeManager.getPointsPerSecond())} mpt`, p.x-90, p.y+60);

        // draw holograms
        this.misc.holograms.forEach(h => {
            ctx.font = `${h.size}px monospace`
            ctx.fillStyle = `rgba(${h.color}, ${1-(h.timealive/h.lifespan)})`;
            ctx.fillText(h.text, h.x, h.y);
        });

        // draw menus
        this.renderer.renderMenus()

        // draw fps
        let avg = 0;
        this.fps_data.forEach(f => {
            avg += f;
        });
        avg /= this.fps_data.length;
        this.renderer.drawFPS(1/avg);
    }

    async passiveTick() {
        const pps = this.upgradeManager.getPointsPerSecond();
        const m = (this.save.data.money || 0)+pps;
        if(pps > 0) {
            let p = this.perToScreenPos(0.5, 0.1, 50, 50);
            this.misc.holograms.push({
                "x": p.x+(30-Math.random()*60),
                "y": p.y+(30-Math.random()*60),
                "text": `+${formatNumber(pps)}`,
                "color": "0, 255, 0",
                "size": 15,
                "lifespan": .8,
                "timealive": 0
            })
        }
        
        await this.save.modifyValue("money", m);
    }

    startPassiveLoop() {
        const loop = async () => {
            await this.passiveTick();
    
            setTimeout(
                loop,
                this.upgradeManager.getTickCooldown() * 1000
            );
        };
    
        loop();
    }

    update(delta) {
        // hover
        const is_hovering = this.isHoveringClicker();
        const hoverTarget = is_hovering ? 1.1 : 1.0;
        this.misc.hoverScale +=
            (hoverTarget - this.misc.hoverScale) * 5 * delta;

        this.misc.clickScale +=
            (1 - this.misc.clickScale) * 4 * delta;

        this.misc.clickerScale =
            this.misc.hoverScale * this.misc.clickScale;

        this.misc.holograms.forEach((h, index) => {
            h.timealive += delta;
            h.y -= 3;
            if(h.timealive > h.lifespan) this.misc.holograms.splice(index, 1)
        });

        document.body.style.cursor = "default"
        let hoveredUpgrade = null;
        let hovered_cost = null;
        Object.values(this.renderer.MENUS).filter(m => m.visible).forEach(m => {
            m.UIElements.forEach(u => {
                const hovering = u.isHovering(this.mousePos[0], this.mousePos[1]);
            
                const hoverTarget = hovering ? 1.08 : 1.0;
            
                u.hoverScale += (hoverTarget - u.hoverScale) * 10 * delta;
            
                u.clickScale += (1 - u.clickScale) * 8 * delta;
            
                if (hovering && u.type === "upgradeButton") {
                    hoveredUpgrade = u.data.upgrade;
                    document.body.style.cursor = "pointer";
                }

                if(hovering && u.data.cost != null) {
                    hovered_cost = u.data.cost
                    document.body.style.cursor = "pointer";
                }
            });
        });
        if (hoveredUpgrade) {
            const owned = this.upgradeManager.getOwned(hoveredUpgrade.id)?.count ?? 0;
            const cost = hoveredUpgrade.getCost(owned);

            this.misc.appendToMoneyText = `-${formatNumber(cost)}`;
            this.misc.appendToMoneyColor = "red";
        } else {
            this.misc.appendToMoneyText = "";
        }

        if(hovered_cost != undefined) {
            this.misc.appendToMoneyText = `-${formatNumber(hovered_cost)}`;
            this.misc.appendToMoneyColor = "red";
        } 
        if(is_hovering) document.body.style.cursor = "pointer"

        Object.values(this.minigames).filter(m => m.activated).forEach(m => m.update(delta));

        this.cps_timer += delta;
        if(this.cps_timer >= 1) {
            this.cps_timer = 0;
            this.cps = 0;
        }
    }

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

    async onClick() {
        Object.values(this.renderer.MENUS).filter(m => m.visible).forEach(m => {
            const rpos = m.getPerToScreen();
            if(Maths.rectRect(this.mousePos[0]-5, this.mousePos[1]-5, 10, 10, rpos.x, rpos.y, rpos.w, rpos.h)) {
                m.handleClick()
            }
        })
        if(this.isHoveringClicker()) {
            const cv = this.upgradeManager.getClickValue()
            this.cps += 1;
            if(this.cps > 16) {
                this.misc.clickScale = 1.2
                this.misc.holograms.push({
                    "x": this.mousePos[0]+(15-Math.random()*30),
                    "y": this.mousePos[1],
                    "text": `too fast!`,
                    "color": "255, 0, 0",
                    "size": 15,
                    "lifespan": .8,
                    "timealive": 0
                })
                return;
            }
            await this.save.modifyValue("money", (this.save.data.money ?? 0)+cv);
            this.misc.clickScale = 1.2
            this.misc.holograms.push({
                "x": this.mousePos[0]+(15-Math.random()*30),
                "y": this.mousePos[1],
                "text": `+${formatNumber(cv)}`,
                "color": "255, 255, 255",
                "size": 15,
                "lifespan": .8,
                "timealive": 0
            })
        }
    }

    async init() {
        await this.save.init();
        this.upgradeManager.init();
        this.startPassiveLoop();

        window.addEventListener("resize", () => {  
            this._resize();
        })

        window.addEventListener("mousemove", (e) => {
            this.mousePos[0] = e.clientX;
            this.mousePos[1] = e.clientY;
        });

        window.addEventListener("mousedown", () => {
            this.onClick();
        })
    }
}

const l = new Loader();
await l.loadImage("log", "../res/mini/clicker/log.png");
await l.loadImage("oak_tree_growth", "../res/mini/clicker/oak_tree_growth.png");
await l.loadImage("maple_tree_growth", "../res/mini/clicker/maple_tree_growth.png");

const c = document.getElementById("canvas");
c.width = window.innerWidth;
c.height = window.innerHeight;
const e = new Engine(c.getContext("2d"), l)
await e.init();

window.requestAnimationFrame(e.tick.bind(e));