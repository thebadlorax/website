const { getCookie, setCookie, formatSeconds, getApiLink, formatNumber } = await import('./common.js');
import { openMenu, handle_updating } from './account.js';

const uptime_text = document.getElementById("uptime");
const visitor_text = document.getElementById("visitors");
const redirect = (loc) => {
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    if(saved_data != null) window.location.href = loc;
    else openMenu();
}

document.getElementById("files-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/files`) })
document.getElementById("chat-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/chat`) })
document.getElementById("gambling-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/gambling`) })
//document.getElementById("game-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/game`) })

const ad_positions = {
    "btm": [83, 22, 60, 5]
}

const createAd = (pos) => {
    let ad = document.createElement("div");
    ad.style.position = "absolute"; ad.style.backgroundSize = "contain"; ad.style.backgroundRepeat = "no-repeat"; //ad.classList.add("hide");
    ad.style.top    = `${pos[0]}vw`; 
    ad.style.left   = `${pos[1]}vw`; 
    ad.style.width  = `${pos[2]}vw`; 
    ad.style.height = `${pos[3]}vw`;
    ad.style.backgroundImage = "url(../res/ads/example_ad.png)";
    document.body.appendChild(ad);
}

createAd(ad_positions["btm"]);

// TODO: remove id and api.user/init (refactor unique visitor protocol)
let show_full_stats = false;
const stats_div = document.getElementById("stats");
stats_div.addEventListener("click", () => {
    show_full_stats = !show_full_stats;
    update_stats(false);
})

let initial_data = await fetch(getApiLink("/stats"), { method: "GET" });
initial_data = await initial_data.json();

const key = initial_data["key"]

if(getCookie("id") == "" || !getCookie("id").includes(key)) {
    const res = await fetch(getApiLink("/user/init"));
    const data = await res.json();
    setCookie("id", data["id"], 400);
    visitor_text.style.color = "green"
    visitor_text.style.fontWeight = 700
    visitor_text.style.textDecoration = "underline";
    setTimeout(() => {visitor_text.style.color = "black"; visitor_text.style.fontWeight = 400; 
        visitor_text.style.textDecoration = "none";}, 5000)
}

let data = initial_data;

async function update_stats(do_fetch) {
    if(do_fetch) {
        const res = await fetch(getApiLink("/stats"), { method: "GET" });
        data = await res.json();
    }

    if(show_full_stats) {
        uptime_text.textContent = `Uptime: ${formatSeconds(data["uptime"])}`;
    } else {
        uptime_text.textContent = ``;
    }
    visitor_text.textContent = `Unique Visitors: ${formatNumber(data["visitor-count"])}`;
}


const track = document.querySelector('.ticker-track');
let sd = JSON.parse(window.localStorage.getItem("user"));
let news_speed = sd ? sd.settings.news_speed : 100;

function updateNews(items) {
    const html = items.map(item => `
        <span class="item">${item}</span>
        <span class="dot">•</span>
    `).join('');

    track.innerHTML = `
        <div class="ticker-content">${html}</div>
        <div class="ticker-content">${html}</div>
        <div class="ticker-content">${html}</div>
        <div class="ticker-content">${html}</div>
    `;

    changeNewsSpeed(news_speed);

    const first = track.children[0];

    let pos = 0;
    let lastTime = null;

    function animate(time) {
    if (!lastTime) lastTime = time;
    const delta = (time - lastTime) / 1000;

    pos -= news_speed * delta;

    const loopWidth = first.offsetWidth;

    if (Math.abs(pos) >= loopWidth) {
        pos += loopWidth; // NOT reset to 0 → prevents jump
    }

    track.style.transform = `translateX(${pos}px)`;

    lastTime = time;
    requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

export const changeNewsSpeed = (speed) => {
    news_speed = speed;
}

fetch(getApiLink("/news"), { method: "GET" })
.then(res => res.json())
.then(items => {
    updateNews(items);
});

document.getElementById("sfb").addEventListener("click", async () => {
    let feedback = document.getElementById("fb").value;
    if(!feedback) return;
    if(feedback.trim() == "") return;
    await fetch(getApiLink("/feedback/give"), { method: "POST", body: JSON.stringify({"feedback": feedback.slice(0, 250)})});
    alert("feedback sent :)");
    document.getElementById("fb").value = "";
})


let clicks = 0;
let last_click_time = 0;
let in_cool_mode = false;
document.getElementById("banner").addEventListener("click", () => {
    if(in_cool_mode) return;
    clicks += 1;
    if(clicks > 5) {
        cool_mode();
        in_cool_mode = true;
    }
})
setInterval(() => {
    if(Date.now() - last_click_time > 3) clicks = 0;
}, 1000);

function create_cool_mode_image(src, x, y, size) {
    let img = document.createElement("img");
    img.src = src;
    img.style.position = "absolute";
    img.style.top = y;
    img.style.left = x;
    img.style.width = size;
    document.getElementById("main-container").appendChild(img);
}

function cool_mode() {
    create_cool_mode_image("../res/wooper.jpg", "40vw", "45vw", "10vw");
    create_cool_mode_image("../res//meowl_cursor.png", "20vw", "20vw", "10vw");

    document.getElementById("banner").src = "../res/transparent_banner_pride.png"

    let song = new Audio("../res/cool_music.mp3");
    song.volume = 0.2;
    song.loop = true;
    song.play();

    updateNews(
        [
            "woah everything is strange now", "what did you do?", 
            "please someone get the song out of my head", "meowl", 
            "there's no way to turn it off?!", "HELPHELPHELP", 
            "wooper", "wattesigma", "gomen gomen", "esaesaesa",
            "puts leg up", "don't climb mountains", "how'd you find this anyways",
            "the secret passcode is: ", "what were you expecting bro",
            "stop reading the news", "it's fake anyways"
        ]
    );
}   


const ticker_speed_slider = document.getElementById("ticker-speed");
const ticker_speed_text = document.getElementById("ticker-speed-text");
let last_speed = news_speed;
export const handle_ticker_speed_change = () => {
    let nspeed = ticker_speed_slider.value;
    let do_update = ticker_speed_slider.value != news_speed;
    if(nspeed <= 20) {
        ticker_speed_text.textContent = `News Speed: DISABLED`;
        track.style.display = "none";
    } else {
        ticker_speed_text.textContent = `News Speed: ${nspeed}`;
        if(track.style.display == "none") track.style.display = "flex";
        changeNewsSpeed(nspeed);
    };
    if(do_update) {
        
    }
};
ticker_speed_slider.addEventListener("change", () => {
    if(ticker_speed_slider.value != last_speed) {
        let saved_data = JSON.parse(window.localStorage.getItem("user"));
        saved_data.settings.news_speed = ticker_speed_slider.value;
        fetch(getApiLink("/user/account/update"), {
            method: "POST",
            body: JSON.stringify({"name": saved_data.account.name, "pass": saved_data.account.pass, "updated": saved_data})
        });
        last_speed = ticker_speed_slider.value
        window.localStorage.setItem("user", JSON.stringify(saved_data));
    }
})

ticker_speed_slider.addEventListener("input", () => {
    handle_ticker_speed_change();
});
handle_ticker_speed_change();


await update_stats(false);
setInterval(() => {
    update_stats(true)
}, 3000);