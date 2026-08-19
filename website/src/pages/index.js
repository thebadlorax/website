const { getCookie, setCookie, formatSeconds, getApiLink, formatNumber } = await import('./common.js');
import { openMenu } from './account.js';

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
document.getElementById("game-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/game`) })
document.getElementById("music-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/music`) })
document.getElementById("mmo-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/mmo`) })



const ad_positions = {
    "btm": [83, 22, 60, 5]
}

async function getRepoStars(owner, repo) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    const data = await response.json();
    return data.stargazers_count;
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

//createAd(ad_positions["btm"]);

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
        uptime_text.textContent = `Uptime: ${formatSeconds(data["uptime"]*1000)}`;
    } else {
        uptime_text.textContent = ``;
    }
    visitor_text.textContent = `Unique Visitors: ${formatNumber(data["visitor-count"])}`;
    getRepoStars("thebadlorax", "website").then(star_count => {
        document.getElementById("star_count").textContent = `Github Stars: ${star_count}`;
    })

    document.getElementById("files-link").style.display = data.disabled_features.includes("files") ? "none" : "block";
    document.getElementById("chat-link").style.display = data.disabled_features.includes("chat") ? "none" : "block";
    document.getElementById("gambling-link").style.display = data.disabled_features.includes("gambling") ? "none" : "block";
    document.getElementById("game-link").style.display = data.disabled_features.includes("game") ? "none" : "block";
    document.getElementById("music-link").style.display = data.disabled_features.includes("music") ? "none" : "block";
    document.getElementById("mmo-link").style.display = data.disabled_features.includes("mmo") ? "none" : "block";
}




document.getElementById("sfb").addEventListener("click", async () => {
    let feedback = document.getElementById("fb").value;
    if(!feedback) return;
    if(feedback.trim() == "") return;
    await fetch(getApiLink("/feedback/give"), { method: "POST", body: JSON.stringify({"feedback": feedback.slice(0, 250)})});
    alert("feedback sent :)");
    document.getElementById("fb").value = "";
})

const img = document.getElementById("di");

let isDragging = false;
let startX = 0;
let startY = 0;
let initialLeft = 0;
let initialTop = 0;

const dragStart = (e) => {
  isDragging = true;
  
  const pageX = e.touches ? e.touches[0].pageX : e.pageX;
  const pageY = e.touches ? e.touches[0].pageY : e.pageY;
  
  startX = pageX;
  startY = pageY;
  
  initialLeft = img.offsetLeft;
  initialTop = img.offsetTop;

  localStorage.setItem("abcd", true);
};

const dragMove = (e) => {
  if (!isDragging) return;
  
  const pageX = e.touches ? e.touches[0].pageX : e.pageX;
  const pageY = e.touches ? e.touches[0].pageY : e.pageY;
  
  const deltaX = pageX - startX;
  const deltaY = pageY - startY;
  
  img.style.left = `${initialLeft + deltaX}px`;
  img.style.top = `${initialTop + deltaY}px`;

}
const dragEnd = () => {
  isDragging = false;
};

img.addEventListener("mousedown", dragStart);
document.addEventListener("mousemove", dragMove);
document.addEventListener("mouseup", dragEnd);


await update_stats(false);
setInterval(() => {
    update_stats(true)
}, 3000);