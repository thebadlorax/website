/**
 * author thebadlorax
 * created on 13-02-2026-18h-33m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink, getSettingOnAccount, changeSettingOnAccount, refreshAccount } from "./common.js";

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

export async function refreshPoints() {
    let points = await getPoints();
    document.getElementById("points").textContent = `${points} points.`
}

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
    document.getElementById("receipt-bg").src = "../res/gambling_balance_survey.png"
    document.getElementById("survey").classList.add("hide")
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

color_picker.value = color;
color_picker.style.color = color;
color_picker.addEventListener("input", () => {
    color_picker.value = `#${color_picker.value.slice(1)}`
    if(color_picker.value.length == 7) {
        color = color_picker.value;
        color_picker.style.color = color;
        changeSettingOnAccount("color", color);
    }
})
name_picker.value = name;
name_picker.addEventListener("input", () => {
    name = name_picker.value;
    changeSettingOnAccount("display_name", name);
})

document.getElementById("receipt").addEventListener("mouseleave", () => { // hide survey menu after 1sec of being put away
    setTimeout(() => {
        if(!document.getElementById("receipt").matches(":hover")) hideSurveyMenu();
    }, 1000);
})
