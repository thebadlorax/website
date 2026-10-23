/**
 * author thebadlorax
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { formatSeconds, getApiLink } from "../../common.js";

const container = document.getElementById("container");

class Server {
    constructor() {
        this.link = getApiLink("/poll");
    }

    async getPollsByAuthor(authorID) {
        const req = await fetch(`${this.link}/fromAuthor?id=${authorID}`);
        if(req.status == 404) return null;

        const json = await req.json();

        return json;
    }

    async getPollsByID(ID) {
        const req = await fetch(`${this.link}/fromIDr?id=${ID}`);
        if(req.status == 404) return null;

        const json = await req.json();

        return json;
    }
}

class PollManager {
    constructor() {
        this.polls = new Array();
    }

    updateAll() {
        this.polls.forEach(p => p.updateElement());
    }

    async create(po) {
        const p = new Poll(po.title, po.author, po.votes, ["yes", "no"], po.timeLeft, po.id);
        await p.init()
        this.polls.push(p);
        await p.createElement();
        return p;
    }
}
class Poll {
    constructor(title, author, values, labels, timeLeft, id) {
        this.labels = labels
        this.values = values;
        this.title = title;
        this.author = author;
        this.end = Date.now()+timeLeft;
        this.id = id;

        this.buttonColors = ["green", "red"]

        this.timeText = null;
        this.progress = [null, null];
    }

    async init() {
        this.vote_status = await this.getVoteStatus();
        console.log(this.vote_status)
    }

    async createElement() {
        const ele = document.createElement("div");
        ele.classList.add("item");
        ele.draggable = false;
        const time_header = document.createElement("div");
        time_header.classList.add("flex-container", "row", "header");
        const time = document.createElement("h3");
        time.textContent = formatSeconds(this.end - Date.now(), 1);
        this.timeText = time;
        const title = document.createElement("h1");
        title.textContent = this.title;
        const authorLabel = document.createElement("h2");
        authorLabel.textContent = this.author.display.name;
        authorLabel.style.color = this.author.display.color;
        authorLabel.title = this.author.id
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

            if(this.progress[0] == null) this.progress[0] = progress_bar
            else if(this.progress[1] == null) this.progress[1] = progress_bar
    
            button.addEventListener("click", () => onPress(button));
    
            return div;
        }
    
        let t = async (i, pressed) => {
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
        };
        const whole = this.values[0] + this.values[1];
        const buttons = [
            createButton(this.buttonColors[0], Math.floor((this.values[0]/whole)*100), this.labels[0], async (p) => { await t(0, p)}),
            createButton(this.buttonColors[1], Math.floor((this.values[1]/whole)*100), this.labels[1], async (p) => { await t(1, p)})
        ]
        buttons.forEach(b => buttons_container.appendChild(b));
    
        if (this.vote_status != null) {
            const button = buttons[this.vote_status].querySelector("button");
        
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
        }
    
        time_header.appendChild(time);
    
        ele.appendChild(time_header);
        ele.appendChild(title);
        ele.appendChild(authorLabel);
        ele.appendChild(buttons_container);
    
        container.appendChild(ele);
        this.element = ele;
    }

    updateElement() {
        this.timeText.textContent = formatSeconds(this.end - Date.now(), 1);
    }

    modifyValues(values) {
        this.values = values;

        const whole = this.values[0] + this.values[1];

        this.progress[0].style.width = `${Math.floor((this.values[0]/whole)*100)}%`;
        this.progress[1].style.width = `${Math.floor((this.values[1]/whole)*100)}%`;
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
            console.error(`problem checking vote (${req.status})`);
            return;
        }
        const json = await req.json();
        return json.vote;
    }
}

const manager = new PollManager();
const server = new Server();

const test_vals = await server.getPollsByAuthor("u_0-OVYBg8VnPntje2O");
const test = Object.values(test_vals)[0];

await manager.create(test);

const update = () => {
    manager.updateAll();
    window.requestAnimationFrame(update);
}
update();