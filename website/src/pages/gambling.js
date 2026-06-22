/**
 * author thebadlorax
 * created on 13-02-2026-18h-33m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink, getSettingOnAccount, changeSettingOnAccount, refreshAccount, preloadImages } from "./common.js";

let color_picker = document.getElementById("color-picker");
let name_picker = document.getElementById("name-picker");
let back_button = document.getElementById("back")
back_button.addEventListener("click", () => {
    window.location.href = `${location.protocol}//${location.host}/`;
})
let color;
try { color = getSettingOnAccount("color") }
catch { alert("make an account"); window.location.href = `${location.protocol}//${location.host}/?account`;}
let name = getSettingOnAccount("display_name")
let receiptMenu = null;

export async function getPoints() {
    await refreshAccount();
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    return saved_data["statistics"]["points"];
}

export class ServersideDeck {
    constructor() {
        this.id = null;
    }

    async init() {
        let res = await fetch(getApiLink("/gambling/cards/create"), {
            method: "POST"
        });
        let json = await res.json();
        this.id = json["id"];
    }

    async draw() {
        if(!this.id) return -1;
        let res = await fetch(getApiLink("/gambling/cards/draw"), {
            method: "POST",
            body: JSON.stringify({"id": this.id})
        });
        let json = await res.json();
        return json["card"];
    }

    getCardImageLink(index) {
        return `../res/cards/${index}.png`
    }
}

function showSurveyMenu() {
    document.getElementById("receipt-bg").src = `../res/gambling_balance_survey.png`
    document.getElementById("survey").classList.add("hide");
    document.getElementById("points").classList.add("hide");
    document.getElementById("survey-div").classList.remove("hide")
    document.getElementById("receipt-snail-racing").style.display = "none";
}

function hideSurveyMenu() {
    document.getElementById("receipt-bg").src = "../res/gambling_balance.png"
    document.getElementById("survey").classList.remove("hide")
    document.getElementById("points").classList.remove("hide");
    document.getElementById("survey-div").classList.add("hide");

    showReceiptMenu(receiptMenu);
}

const receiptNotification = () => {
    if(document.getElementById("receipt").matches(":hover")) return;
    let receipt = document.getElementById("receipt");
    receipt.style.transform = "scale(0.85) rotate(25deg)";
    setTimeout(() => { receipt.style.removeProperty("transform"); }, 200);
}

export function showReceiptMenu(divname) {
    if(divname == null || receiptMenu == divname) return;
    if(receiptMenu != null) document.getElementById(receiptMenu).style.display = "none";
    //hideSurveyMenu();
    receiptMenu = divname;
    document.getElementById(divname).style.display = "block";
    receiptNotification();
}

export function hideReceiptMenu(divname) {
    if(divname == null) return;
    //hideSurveyMenu();
    document.getElementById(divname).style.display = "none";
    receiptMenu = null;
}

document.getElementById("survey").addEventListener("click", () => { showSurveyMenu(); })
document.getElementById("survey-close").addEventListener("click", () => { hideSurveyMenu(); })

let user_update = false;

color_picker.value = color;
color_picker.style.color = color;
color_picker.addEventListener("input", async () => {
    color_picker.value = `#${color_picker.value.slice(1)}`
    if(color_picker.value.length == 7) {
        color = color_picker.value;
        color_picker.style.color = color;
        await changeSettingOnAccount("color", color);
        user_update = true;
    }
})
name_picker.value = name;
name_picker.addEventListener("input", async () => {
    if(name_picker.value.length == 0) name_picker.value = "no name"
    name = name_picker.value;
    await changeSettingOnAccount("display_name", name);
    user_update = true;
});

let card_urls = []
for(let x = 0; x < 52; x++) {
    let path = x+1;
    if(x >= 51) path = "back";
    const url = `../res/cards/${path}.png`;
    card_urls.push(url);
}

preloadImages(["/res/gambling_balance_survey.png"].concat(card_urls))

document.getElementById("receipt").addEventListener("mouseleave", () => { // hide survey menu after 1sec of being put away
    setTimeout(() => {
        if(!document.getElementById("receipt").matches(":hover")) hideSurveyMenu();
    }, 1000);
})


const checkIfDisabled = async () => {
    await fetch(getApiLink("/stats")).then(async e => {
        let json = await e.json();
        if(json.disabled_features.includes("gambling")) window.location.href = "/";
    })
}
setInterval(async () => {await checkIfDisabled()}, 3000);




const player_name_positions = [[70, 20], [80, 30], [83, 50], [81, 70], [69, 80], [61, 47]]

class Packet {
    static fromFormatted(formatted) {
        let f = atob(formatted).split(Packet.seperator);
        return new Packet(
            f[0],
            JSON.parse(f[1])
        )
    }
    static seperator = ";"
    constructor(type, data) {
        this.type = type; this.data = data;
    }

    format() {
        return btoa(`${this.type}${Packet.seperator}${JSON.stringify(this.data)}`)
    }
}

class UIElement {
    static fromPacketData(d) {
        return new UIElement(
            d.x, d.y, d.type, d.data, d.listeners, d.id, d.visible, d.value
        )
    }
    constructor(x, y, type, data, listeners, id, visible=true, value=null) {
        this.x = x; this.y = y; this.type = type;
        this.data = data; this.listeners = listeners;
        this.id = id; this.visible = visible;
        this.value = value;
    }

    createElement() {
        let n = null;
        if(this.ele != undefined) this.destroy();
        if(!this.visible) return;

        let p = document.createElement("div");

        const parent = this.data.position == "absolute" ? document.body : document.getElementById("receipt");
        const unit = this.data.position_unit??"%";
        switch(this.type) {
            case "button": {
                const width = this.data.w ?? 0.1;
                const height = this.data.h ?? 0.1;
                n = document.createElement("button");
                n.classList.add("uibutton")
                n.style.position = this.data.position == "absolute" ? "absolute" : "fixed";
                n.style.left = `${(this.x-width/2)*(unit == "%" ? 100 : 1)}${unit}`;
                n.style.top = `${(this.y-width/2)*(unit == "%" ? 100 : 1)}${unit}`;
                n.style.width = `${width*(unit == "%" ? 100 : 1)}${unit}`
                n.style.height = `${height*(unit == "%" ? 100 : 1)}${unit}`

                if(this.listeners.includes("click")) {
                    n.style.cursor = "pointer";
                    n.addEventListener("click", e => {
                        casino.sendPacket(new Packet("UIInteraction", {"type": "click", "id": this.id}))
                    })
                }

                n.textContent = this.data.label ?? "";

                break;
            }

            case "text": {
                const width = this.data.w ?? 0.1;
                const height = this.data.h ?? 0.1;
                n = document.createElement("text");
                n.classList.add("uitext")
                n.style.position = this.data.position == "absolute" ? "absolute" : "fixed";
                n.style.left = `${(this.x-width/2)*(unit == "%" ? 100 : 1)}${unit}`;
                n.style.top = `${(this.y-width/2)*(unit == "%" ? 100 : 1)}${unit}`;
                n.style.width = this.data.w_override //?? `${width*(unit == "%" ? 100 : 1)}${unit}`
                n.style.height = this.data.h_override //?? `${height*(unit == "%" ? 100 : 1)}${unit}`

                if(this.listeners.includes("click")) {
                    n.style.cursor = "pointer";
                    n.addEventListener("click", e => {
                        casino.sendPacket(new Packet("UIInteraction", {"type": "click", "id": this.id}))
                    })
                }

                n.textContent = this.data.text ?? "";

                break;
            }

            case "slider": {
                const width = this.data.w ?? 0.1;
                const height = this.data.h ?? 0.1;
                n = document.createElement("input");
                n.classList.add("uibutton")
                n.type = "range";
                n.style.position = this.data.position == "absolute" ? "absolute" : "fixed";
                n.style.left = `${(this.x-width/2)*(unit == "%" ? 100 : 1)}${unit}`;
                n.style.top = `${(this.y-height/2)*(unit == "%" ? 100 : 1)}${unit}`;
                n.style.width = `${width*(unit == "%" ? 100 : 1)}${unit}`
                n.style.height = `${height*(unit == "%" ? 100 : 1)}${unit}`

                n.min = this.data.min??0;
                n.max = this.data.max??100;
                n.step = this.data.step??1;
                n.value = this.value??Math.floor(n.max/2)


                n.style.cursor = "pointer";
                n.addEventListener("click", e => {
                    casino.sendPacket(new Packet("UIInteraction", {"type": "change", "id": this.id, "eventData": {"value": n.value}}));
                })
                casino.sendPacket(new Packet("UIInteraction", {"type": "change", "id": this.id, "eventData": {"value": n.value}}));

                if(this.data.label != undefined) {
                    let a = document.createElement("p");
                    a.classList.add("uitext");
                    a.textContent = this.data.label
                    a.style.position = this.data.position == "absolute" ? "absolute" : "fixed";
                    a.style.left = `${(this.x-(this.data.label.length*0.005))*(unit == "%" ? 100 : 1)}${unit}`;
                    a.style.top = `${((this.y-0.05)-height/2)*(unit == "%" ? 100 : 1)}${unit}`;
                    p.appendChild(a);
                }

                if(this.data.showVal) {
                    let a = document.createElement("p");
                    a.classList.add("uitext");
                    a.style.position = this.data.position == "absolute" ? "absolute" : "fixed";
                    a.style.left = `${(this.x+(width*0.3)-(this.data.label.length*0.005))*(unit == "%" ? 100 : 1)}${unit}`;
                    a.style.top = `${((this.y+0.05)-height/2)*(unit == "%" ? 100 : 1)}${unit}`;
                    a.textContent = `${this.data.valPrefix??""}${n.value}${this.data.valSuffix??""}`
                    n.addEventListener("input", () => { a.textContent = `${this.data.valPrefix??""}${n.value}${this.data.valSuffix??""}` })
                    p.appendChild(a);
                }

                break;
            }

            case "card": {
                const width = this.data.w ?? 0.1;
                const height = this.data.h ?? 0.1;
                n = document.createElement("img");
                n.classList.add("card");
                n.style.position = this.data.position ??  "fixed";
                n.style.left = `${(this.x-width/2)*(unit == "%" ? 100 : 1)}${unit}`;
                n.style.top = `${(this.y-width/2)*(unit == "%" ? 100 : 1)}${unit}`;
                n.style.width = `${width*(unit == "%" ? 100 : 1)}${unit}`
                n.style.height = `${height*(unit == "%" ? 100 : 1)}${unit}`

                const url = `../res/cards/${this.data.card}.png`;
                n.src = url;
                n.setAttribute("draggable", false);
                if(this.data.bust) n.classList.add("bust");
                else n.classList.add("active")

                if(this.listeners.includes("click")) {
                    n.style.cursor = "pointer";
                    n.addEventListener("click", e => {
                        casino.sendPacket(new Packet("UIInteraction", {"type": "click", "id": this.id}))
                    })
                }

                break;
            }
        }
        if(this.data.disabled) {
            n.disabled = true;
            n.style.cursor = "default";
        }
        if(this.data.pos_override != undefined) {
            n.style.left = this.data.pos_override.x;
            n.style.top = this.data.pos_override.y;
            n.style.width = this.data.pos_override.w;
            n.style.height = this.data.pos_override.h;
        }
        p.appendChild(n);
        parent.appendChild(p);
        this.ele = p;
    }

    destroy() {
        if(this.ele == undefined) return;
        this.ele.replaceChildren();
        this.ele.remove();
    }
}

class UIManager {
    constructor() {
        this.UIElements = new Array();
    }

    createUIElement(ele) {
        this.UIElements.push(ele);
        ele.createElement();
        receiptNotification();
    }

    updateUIElement(ele) {
        this.destroyUIElement(ele.id);
        this.createUIElement(ele);
    }

    destroyUIElement(id) {
        let e = this.UIElements.find(u => u.id == id)
        if(!e) return;
        e.destroy();
        this.UIElements.splice(this.UIElements.indexOf(e), 1);
    }

    clearUI() {
        this.UIElements.forEach(u => {
            u.destroy();
        })
        this.UIElements = []
    }
}

class Casino {
    constructor() {
        this.ws = new WebSocket(location.host.includes("66.65.25.15") ? 
            `${location.protocol}//${location.host}/subdomain=api/gambling/live` :
            `${location.protocol}//api.${location.host}/gambling/live`
        )
        this.ws.onopen = this.onConnect.bind(this);
        this.ws.onmessage = (m) => { this.onRecieve(Packet.fromFormatted(m.data)) }

        this.ui = new UIManager();

        this.log_packets = false;
    }
    async init() {
        create_game_button.addEventListener("click", () => {
            if(this.points > 0) {
                create_game_button.style.display = "none";
                this.createNewInstance(game_chooser.value)
            }
            else alert("you're too broke")
        })
        join_game_button.addEventListener("click", () => {
            if(this.points > 0) {
                join_game_button.style.display = "none"
                this.joinInstance(progress_game_chooser.value);
            }
            else alert("you're too broke")
        })
        progress_game_chooser.addEventListener("change", () => {
            this.sendPacket(new Packet("getTableInformation", {"id": progress_game_chooser.value}));
        });

        this.points = await getPoints() ?? 0;
        this.resetPointsText();
    }

    sendPacket(packet) { 
        if(this.log_packets) console.log(`outgoing [${packet.type}]packet, data: ${JSON.stringify(packet.data)}`)
        this.ws.send(packet.format());
     }

    setupTableUI(data) {
        table_ui.replaceChildren();
        let n = []
        data.clients.forEach((c, index) => {
            const is_owner = data.owner.id == c.id;
            let ele = document.createElement("p");
            ele.classList.add("uitext");
            ele.style.position = "absolute";
            ele.style.top = `${player_name_positions[index][0]}vw`;
            ele.style.left = `${player_name_positions[index][1]}vw`;
            ele.style.width = `0.1vw`
            ele.style.color = c.color;
            ele.textContent = c.name;
            if(is_owner) {
                ele.style.fontWeight = "bold";
            }
            if(c.is_turn) {
                ele.style.textDecoration = "underline";
            }
            ele.dataset.id = c.id;
            n.push(ele);
            table_ui.appendChild(ele);
        })
        create_game_button.style.display = "block";
        join_game_button.style.display = "block";
        return n;
    }

    resetPointsText() {
        points.textContent = `${this.points} points`
    }

    onConnect() {
        let user = JSON.parse(window.localStorage.getItem("user"));
        this.sendPacket(new Packet("initauth", {"name": user.account.name, "pass": user.account.pass}));
    }
    onRecieve(packet) {
        if(this.log_packets) console.log(`incoming [${packet.type}]packet, data: ${JSON.stringify(packet.data)}`)
        if(packet.data.status != undefined && packet.data.status != 200) {
            console.log(`packet ${packet.type} response has error, data: ${JSON.stringify(packet.data)}`);
        }
        switch(packet.type) {
            case "initauth": {
                console.log("initialized w/ casino")
                this.sendPacket(new Packet("fetchInstances", {}))
                break;
            }

            case "createUI": {
                this.ui.createUIElement(UIElement.fromPacketData(packet.data));
                break;
            }
            case "destroyUI": {
                this.ui.destroyUIElement(packet.data.id)
                break;
            }
            case "updateUI": {
                this.ui.updateUIElement(UIElement.fromPacketData(packet.data));
                break;
            }
            case "clearUI": {
                this.ui.clearUI();
                break;
            }
            
            case "instanceEnrollment": {
                game_choosing_div.style.display = "none";
                break;
            }
            case "instanceUnenrollment": {
                game_choosing_div.style.display = "block";
                table_ui.replaceChildren();
                leave_button.remove();
                this.ui.clearUI();
                break;
            }

            case "getTableInformation": {
                this.setupTableUI(packet.data.data.information);
                break;
            }
            case "refreshTable": {
                let client_texts = this.setupTableUI(packet.data);
                let leave_button = document.createElement("button");
                leave_button.classList.add("uibutton");
                leave_button.style.position = "absolute";
                leave_button.style.top = `67vw`;
                leave_button.style.left = `53vw`;
                leave_button.style.width = "4vw";
                leave_button.style.height = "2vw";
                leave_button.textContent = "leave"
                leave_button.id = "leave_button";
                leave_button.addEventListener("click", () => {
                    casino.sendPacket(new Packet("leaveInstance", {}))
                    leave_button.remove()
                })
                document.body.appendChild(leave_button);

                let self = JSON.parse(window.localStorage.getItem("user"));
                if(self.account.id == packet.data.owner.id) {
                    let start_button = document.createElement("button");
                    start_button.classList.add("uibutton");
                    start_button.style.position = "absolute";
                    start_button.style.top = `67vw`;
                    start_button.style.left = `43vw`;
                    start_button.style.width = "4vw";
                    start_button.style.height = "2vw";
                    start_button.textContent = "start"
                    start_button.id = "start_button";
                    start_button.addEventListener("click", () => {
                        start_button.remove();
                        casino.sendPacket(new Packet("startGame", {}))
                    })
                    table_ui.appendChild(start_button);

                    client_texts.forEach(ele => {
                        const id = ele.dataset.id;
                        if(id == self.account.id) return;
                        ele.style.cursor = "pointer";
                        ele.addEventListener("click", () => {
                            casino.sendPacket(new Packet("setOwner", {"id": id}))
                        })
                    })
                }
                break;
            }
            case "fetchInstances": {
                if(packet.data.data.instances.length == 0) join_game_ui.style.display = "none"
                else join_game_ui.style.display = "block"
                progress_game_chooser.replaceChildren();
                packet.data.data.instances.forEach(i => {
                    let o = document.createElement("option");
                    o.textContent = `${i.owner.name}'s ${i.type} table`
                    o.value = i.id;
                    progress_game_chooser.appendChild(o);
                })
                break;
            }

            case "changePoints": {
                this.points += packet.data.delta;
                this.resetPointsText();
                break;
            }

            case "startGame": {
                leave_button.style.top = "65vw";
                leave_button.style.left = "57vw";
                try { start_button.remove(); }
                catch {}
                break;
            }

            default: {
                //console.log(`unhandled packet: ${atob(packet.format())}`)
                break;
            }
        }
    }

    createNewInstance(gameType) {
        this.sendPacket(new Packet("createInstance", {"type": gameType}))
    }
    joinInstance(id) {
        this.sendPacket(new Packet("joinInstance", {"id": id}))
    }
}

const casino = new Casino();
await casino.init();

setInterval(() => {
    if(!user_update) return;
    let user = JSON.parse(window.localStorage.getItem("user"));
    casino.sendPacket(new Packet("updateUser", {"new_user": user}))
    user_update = false;
})