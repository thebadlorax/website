/**
 * author thebadlorax
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { formatSeconds } from "../../common.js";
import { getRandomName, generateRandomString } from "../mini-common.js";

const container = document.getElementById("container");

class PollManager {
    constructor() {
        this.polls = new Array();
    }

    updateAll() {
        this.polls.forEach(p => p.updateElement());
    }

    create(title="untitled poll", author="admin", percents=[80, 20], labels=["yes", "no"], end=(Date.now()+(60000))) {
        const p = new Poll(title, author, percents, labels, end);
        this.polls.push(p);
        p.createElement();
        return p;
    }
}
class Poll {
    constructor(title, author, values, labels, end) {
        this.labels = labels
        this.values = values;
        this.title = title;
        this.author = author;
        this.end = end;

        this.buttonColors = ["green", "red"]

        this.timeText = null;
        this.progress = [null, null]
    }

    createElement() {
        const ele = document.createElement("div");
        ele.classList.add("item");
        const time_header = document.createElement("div");
        time_header.classList.add("flex-container", "row", "header");
        const time = document.createElement("h3");
        time.textContent = formatSeconds(this.end - Date.now(), 1);
        this.timeText = time;
        const title = document.createElement("h1");
        title.textContent = this.title;
        const authorLabel = document.createElement("h2");
        authorLabel.textContent = this.author;
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
    
        let t = (i, pressed) => {
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

            this.vote(i)
        };
        const whole = this.values[0] + this.values[1];
        const button1 = createButton(this.buttonColors[0], Math.floor((this.values[0]/whole)*100), this.labels[0], (p) => { t(0, p)});
        const button2 = createButton(this.buttonColors[1], Math.floor((this.values[0]/whole)*100), this.labels[1], (p) => { t(1, p)});
    
        buttons_container.appendChild(button1);
        buttons_container.appendChild(button2);
    
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

    vote(index) {
        const a = Math.floor(Math.random()*100)
        const b =  Math.floor(Math.random()*100);
        this.modifyValues([a, b])
    }
}

const manager = new PollManager();
manager.create(generateRandomString(10), getRandomName());

const update = () => {
    manager.updateAll();
    window.requestAnimationFrame(update);
}
update();