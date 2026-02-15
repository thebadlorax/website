/**
 * author thebadlorax
 * created on 13-02-2026-18h-33m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink, setCookie, getCookie } from "./common.js";

let points = 0;

let color_picker = document.getElementById("color-picker");
let name_picker = document.getElementById("name-picker");
let color = getCookie("color") || "#000000"
let name = getCookie("username") || ""

export function addPoints(point_count) {
    points += point_count;
    document.getElementById("points").textContent = `${points} points.`
}

export function getPoints() {
    return points;
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
    document.getElementById("receipt-bg").src = "../res/gambling_balance_survey.png"
    document.getElementById("survey").classList.add("hide")
    document.getElementById("points").classList.add("hide");
    document.getElementById("survey-div").classList.remove("hide")
}

function hideSurveyMenu() {
    document.getElementById("receipt-bg").src = "../res/gambling_balance.png"
    document.getElementById("survey").classList.remove("hide")
    document.getElementById("points").classList.remove("hide");
    document.getElementById("survey-div").classList.add("hide");
}

document.getElementById("survey").addEventListener("click", () => { showSurveyMenu(); })
document.getElementById("survey-close").addEventListener("click", () => { hideSurveyMenu(); })

color_picker.value = color;
color_picker.style.color = color;
color_picker.addEventListener("input", () => {
    color_picker.value = `#${color_picker.value.slice(1)}`
    if(color_picker.value.length == 7) {
        color = color_picker.value;
        color_picker.style.color = color;
        setCookie("color", color, 90);
    }
})
name_picker.value = name;
name_picker.addEventListener("input", () => {
    name = name_picker.value;
    setCookie("username", name, 90);
})

document.getElementById("receipt").addEventListener("mouseleave", () => { // hide survey menu after 1sec of being put away
    setTimeout(() => {
        if(!document.getElementById("receipt").matches(":hover")) hideSurveyMenu();
    }, 1000);
})
