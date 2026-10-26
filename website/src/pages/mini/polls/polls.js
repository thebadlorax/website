/**
 * author thebadlorax
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { formatSeconds, getApiLink, getRoute } from "../../common.js";

const container = document.getElementById("container");
const create_button = document.getElementById("create-button");
const user = JSON.parse(window.localStorage.getItem("user"));
if(!user) {
    alert("make an account"); window.location.href = `${location.protocol}//${location.host}/?account`
}
let pressed_create = false;
create_button.addEventListener("click", () => {
    if(pressed_create) return;
    pressed_create = true;
    create_button.classList.remove("create-button");

    const ele = create_button;
    ele.style.backgroundColor = "lightblue"
    ele.replaceChildren();
    ele.classList.add("item");
    const time_header = document.createElement("div");
    time_header.classList.add("flex-container", "row", "header", "center-items");
    const time = document.createElement("input");
    time.style.fontWeight = 200;
    time.style.fontSize = "20px";
    time.style.height = "30px";
    time.style.marginRight = "2%";
    time.style.zIndex = 9999
    time.maxLength = 5;
    const time_suffix = document.createElement("select");
    const seconds_object = document.createElement("option");
    seconds_object.value = "s";
    seconds_object.textContent = "seconds";
    const minutes_object = document.createElement("option");
    minutes_object.value = "m";
    minutes_object.textContent = "minutes";
    const hours_object = document.createElement("option");
    hours_object.value = "h";
    hours_object.textContent = "hours";
    const days_object = document.createElement("option");
    days_object.value = "d";
    days_object.textContent = "days";

    time_suffix.appendChild(seconds_object);
    time_suffix.appendChild(minutes_object);
    time_suffix.appendChild(hours_object);
    time_suffix.appendChild(days_object);

    time.type = "text";
    time.placeholder = 60
    time.style.borderBottom = "2px black solid"
    time.addEventListener('input', (event) => { event.target.value = event.target.value.replaceAll(/\D/g, ''); });
    const title = document.createElement("input");
    title.placeholder = "title";
    title.style.zIndex = 2;
    const authorDiv = document.createElement("div");
    authorDiv.classList.add("flex-container", "row", "align-left", "justify-center");
    const authorLabel = document.createElement("h2");
    authorLabel.textContent = user.settings.display_name;
    authorLabel.style.color = user.settings.color;
    authorLabel.title = user.account.id;
    authorLabel.style.cursor = "default";
    const finishButton = document.createElement("button");
    finishButton.textContent = "finish";
    finishButton.disabled = true;
    finishButton.style.cursor = "not-allowed"
    finishButton.title = ">2 choices needed"
    finishButton.style.width = "10vw";
    finishButton.style.height = "30px";
    finishButton.style.marginLeft = "1vw"
    finishButton.addEventListener("click", async () => {
        if(finishButton.disabled) return;
        const title_value = title.value;
        let length = time.value;
        length = length.replaceAll(/\D/g, '');
        if     (time_suffix.value == "s") length *= 1000;
        else if(time_suffix.value == "m") length *= 1000*60
        else if(time_suffix.value == "h") length *= 1000*60*60
        else if(time_suffix.value == "d") length *= 1000*60*60*24
        const labels_text = labels.map(l => l.value);

        const link = getApiLink("/poll/create");
        const req = await fetch(link, { method: "POST", body: JSON.stringify({
            "name": user.account.name,
            "pass": user.account.pass,
            "title": title_value ?? "untitled poll",
            "length": length ?? 60000,
            "labels": labels_text ?? ["yes", "no"]
        })});
        alert("created poll");
        window.location.href = getRoute(`/mini/polls?method=author&id=${user.account.id}`)
    })
    const buttons_container = document.createElement("div");
    buttons_container.classList.add("flex-container", "row", "footer");


    const div = document.createElement("div");
    div.classList.add("flex-container", "center-items", "align-left", "subitem");
    const create_new_button = document.createElement("button");
    const create_new_label = document.createElement("span");
    create_new_label.textContent = "add choice";
    create_new_button.appendChild(create_new_label);
    div.appendChild(create_new_button);
    buttons_container.appendChild(div);
    create_new_button.addEventListener("click", () => { bs() });

    let button_count = 0;
    const labels = new Array();
    const bs = () => {
        const div = document.createElement("div");
        div.classList.add("flex-container", "center-items", "align-left", "subitem");
        const button = document.createElement("button");
        const label = document.createElement("input");
        labels.push(label);
        label.placeholder = `choice ${button_count+1}`;
        label.style.borderBottom = "2px black solid"
        label.style.fontWeight = 200;
        label.style.fontSize = "20px";

        button.appendChild(label);
        div.appendChild(button);
        buttons_container.appendChild(div);
        button_count += 1;
        if(button_count > 1) {
            finishButton.disabled = false;
            finishButton.style.cursor = "pointer"
            finishButton.title = ""
        }
    }

    time_header.appendChild(time);
    time_header.appendChild(time_suffix)
    
    ele.appendChild(time_header);
    ele.appendChild(title);
    authorDiv.appendChild(authorLabel);
    authorDiv.appendChild(finishButton);
    ele.appendChild(authorDiv)
    ele.appendChild(buttons_container);
});

class Server {
    static link = getApiLink("/poll");

    static async getPollsByAuthor(authorID) {
        const req = await fetch(`${Server.link}/fromAuthor?id=${authorID}`);
        if(req.status == 404) return null;

        const json = await req.json();

        return json;
    }

    static async getVotesOnPoll(pollID) {
        const poll = await Server.getPollByID(pollID);
        return poll.votes;
    }

    static async getPollByID(pollID) {
        const req = await fetch(`${Server.link}/fromID?id=${pollID}`);
        if(req.status == 404) return null;

        const json = await req.json();

        return json;
    }
}

class PollManager {
    static updateCooldown = 100;
    constructor() {
        this.polls = new Array();
        this.updates = new Map();
    }

    updateAll() {
        this.polls.forEach(p => {
            p.updateElement();
            if(this.updates.get(p.id) > PollManager.updateCooldown) {
                p.refreshValues();
                this.updates.set(p.id, 0);
            } else if((p.end - Date.now()) > 0)this.updates.set(p.id, this.updates.get(p.id)+1)
        });
    }

    async createPollFromData(po) {
        const p = new Poll(po.title, po.author, po.votes, po.labels, po.timeLeft, po.id);
        await p.init()
        this.polls.push(p);
        this.updates.set(p.id, 0);
        await p.createElement();
        return p;
    }
}
class Poll {
    static BUTTON_COLORS = ["green", "red", "magenta", "lightblue", "gold", "purple"]
    constructor(title, author, values, labels, timeLeft, id) {
        this.labels = labels
        this.values = values;
        this.title = title;
        this.author = author;
        this.end = Date.now()+timeLeft;
        this.id = id;

        this.timeText = null;
        this.progress = [null, null];
        this.buttons = null;
    }

    async init() {
        this.vote_status = await this.getVoteStatus();
    }

    async createElement() {
        const ele = document.createElement("div");
        ele.classList.add("item");
        ele.draggable = false;
        const time_header = document.createElement("div");
        time_header.classList.add("flex-container", "row", "header");
        const time = document.createElement("h3");
        const a = this.end - Date.now();
        const b = formatSeconds(a, 1);
        time.textContent = `${a <= 0 ? "ended " : ""}${b}`;
        this.timeText = time;
        const title = document.createElement("h1");
        title.textContent = this.title;
        title.title = this.id;
        title.addEventListener("click", async () => { await navigator.clipboard.writeText(getRoute(`/mini/polls?method=single&id=${this.id}`)) })
        const authorLabel = document.createElement("h2");
        authorLabel.textContent = this.author.display.name;
        authorLabel.style.color = this.author.display.color;
        authorLabel.title = this.author.id;
        authorLabel.addEventListener("click", async () => { await navigator.clipboard.writeText(getRoute(`/mini/polls?method=author&id=${this.author.id}`)) })
        const buttons_container = document.createElement("div");
        buttons_container.classList.add("flex-container", "row", "footer");
        
        const createButton = (bgColor, progress, labelText, onPress=()=>{}) => {
            const div = document.createElement("div");
            div.classList.add("flex-container", "center-items", "align-left", "subitem");
            const button = document.createElement("button");
            const progress_bar = document.createElement("div");
            progress_bar.style.backgroundColor = bgColor;
            progress_bar.style.width = `${progress}%`;
            progress_bar.style.display = "none";
            const label = document.createElement("span");
            label.textContent = `${labelText}`;
    
            button.appendChild(progress_bar);
            button.appendChild(label);
            div.appendChild(button);

            button.addEventListener("click", async () => {
                if(!button.classList.contains("disabled")) await onPress(button)
            })

            if(this.progress[0] == null) this.progress[0] = progress_bar
            else if(this.progress[1] == null) this.progress[1] = progress_bar
    
            return div;
        }
    
        this.buttons = new Array();
        this.labels.forEach(async (l, i) => {
            this.buttons.push(createButton(Poll.BUTTON_COLORS[i], 0, this.labels[i], async (pressed) => { 
                ele.querySelectorAll(".footer button div").forEach(p => {
                    p.style.display = "block";
                    if(p != pressed.querySelector("div")) setTimeout(() => { p.classList.add("active") }, 100)
                    else p.classList.add("active");
                });
    
                ele.querySelectorAll(".footer button").forEach(b => {
                    b.classList.remove("selected");
                    b.classList.add("unselected")
                });
                pressed.classList.add("selected");
                pressed.classList.remove("unselected");
                await this.vote(i)
            }))
        })
        this.modifyValues(this.values);
        this.buttons.forEach(b => buttons_container.appendChild(b));
    
        if (this.vote_status != null) {
            const button = this.buttons[this.vote_status].querySelector("button");
        
            buttons_container.querySelectorAll("button div").forEach(p => {
                p.style.display = "block";
        
                if (p !== button.querySelector("div")) setTimeout(() => p.classList.add("active"), 100);
                else p.classList.add("active");
            });
        
            buttons_container.querySelectorAll("button").forEach(b => {
                b.classList.remove("selected");
                b.classList.add("unselected");
            });
        
            button.classList.add("selected");
            button.classList.remove("unselected");
        } else if(this.end - Date.now() <= 0) {
            buttons_container.querySelectorAll("button div").forEach(p => {
                p.style.display = "block";
                p.classList.add("active");
            });
        }
    
        time_header.appendChild(time);
    
        ele.appendChild(time_header);
        ele.appendChild(title);
        ele.appendChild(authorLabel);
        ele.appendChild(buttons_container);
    
        container.prepend(ele);
        this.element = ele;
    }

    async refreshValues() {
        const votes = await Server.getVotesOnPoll(this.id);
        this.modifyValues(votes);
    }

    updateElement() {
        const a = this.end - Date.now();
        const b = formatSeconds(a, 1);
        this.timeText.textContent = `${a <= 0 ? "ended " : ""}${b}`;

        if(a <= 0 && this.buttons != null) {
            this.buttons.forEach(b => {
                b.querySelectorAll("button").forEach(b1 => {
                    b1.classList.remove("selected");
                    b1.classList.remove("unselected");
                    b1.classList.add("disabled")
                });
            })
        }
    }

    modifyValues(values) {
        this.values = values;

        let whole = 0; this.values.forEach(v => whole += v)

        if(whole == 0) {
            this.values.forEach((v, i) => {
                this.progress[i].style.width = `0%`;
            })
        }

        this.values.forEach((v, i) => {
            this.progress[i].style.width = `${Math.floor((v/whole)*100)}%`;
        })
    }

    async vote(index) {
        const user = JSON.parse(window.localStorage.getItem("user"));
        const link = getApiLink("/poll/vote");
        const req = await fetch(link, { method: "POST", body: JSON.stringify({
            "name": user.account.name,
            "pass": user.account.pass,
            "id": this.id,
            "option": index
        })});
        if(req.status != 200) {
            console.error(`problem voting (${req.status})`);
            return;
        }
        const json = await req.json();
        this.modifyValues(json.votes)
    }

    async getVoteStatus() {
        const user = JSON.parse(window.localStorage.getItem("user"));
        const link = getApiLink("/poll/checkVoteStatus");
        const req = await fetch(link, { method: "POST", body: JSON.stringify({
            "name": user.account.name,
            "pass": user.account.pass,
            "id": this.id
        })});
        if(req.status != 200) {
            console.error(`problem checking vote (${req.status})`); return;
        }
        const json = await req.json();
        return json.vote;
    }
}

const manager = new PollManager();

const params = new URLSearchParams(window.location.search);
const method = params.get("method");
const id = params.get("id");

if(id == null) {
    console.log("bruh")
}

switch(method) {
    case "author": {
        const polls = await Server.getPollsByAuthor(id);
        if(polls == null || polls.length == 0) {
            console.log("err")
            break;
        }
        await Promise.all(Object.values(polls).sort((a, b) => a.timeLeft - b.timeLeft).map(p => manager.createPollFromData(p)));
        break;
    }
    case "single": {
        const poll = await Server.getPollByID(id);
        if(poll == null) {
            console.log("err")
            break;
        }
        manager.createPollFromData(poll)
        break;
    }
    default: {
        break;
    }
}

const update = () => {
    manager.updateAll();
    window.requestAnimationFrame(update);
}
update();