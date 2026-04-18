const { getCookie, setCookie, formatSeconds, getApiLink, formatNumber } = await import('./common.js');
import { openMenu } from './account.js';

/*const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; // dynamic swap for testing
let wsUri;
if(location.host.includes("66.65.25.15")) {
    wsUri = `${protocol}//${location.host}/subdomain=api/chat/live`;
} else {
    wsUri = `${protocol}//api.${location.host}/chat/live`;
}

const ws = new WebSocket(wsUri);*/
const uptime_text = document.getElementById("uptime");
const visitor_text = document.getElementById("visitors");
const commit_text = document.getElementById("commit");
const redirect = (loc) => {
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    if(saved_data != null) window.location.href = loc;
    else openMenu();
}
//document.getElementById("recent-chats").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/chat`); })
document.getElementById("files-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/files`) })
document.getElementById("chat-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/chat`) })
document.getElementById("gambling-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/gambling`) })
//document.getElementById("game-link").addEventListener("click", () => { redirect(`${location.protocol}//${location.host}/game`) })

setTimeout(() => { // ideal ad size = 1200 x 100
    document.getElementById("f").style.backgroundImage = "url(../res/ads/example_ad.png)";
    document.getElementById("f").style.display = "block";
}, Math.random()*1000)

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

/*let messages = await fetch_history(100)
for(let x = 0; x < messages.length; x++) {
    let message = messages[x];
    if(!message.includes("[")) messages.splice(x, 1);
}
update_messages()

ws.addEventListener('message', (e) => { // add message to the queue
    messages.push(`${e.data}`);
    update_messages();
})

function update_messages() {
    while(messages.length > 11) messages.shift();

    message_box.innerHTML = "";

    let y_off = -1;

    for(let x = 0; x < messages.length; x++) {
        let message = messages[x];
        if(message[0] == "#") {
            message = message.slice(7);
        }
        if(message[0] != "[") continue;
        let ele = document.createElement("p");
        ele.textContent = message;
        ele.classList.add("basic-text", "unselectable");
        ele.style.position = "absolute"
        ele.style.marginLeft = ".5vw"
        ele.style.fontSize = "1vw"
        y_off += 1;
        ele.style.marginTop = `${y_off}vw`
        if(ele.textContent.length > 25) ele.textContent = ele.textContent.slice(0, 25) + "..."
        message_box.appendChild(ele);
    }
}

async function fetch_history(length) {
    const res = await fetch(getApiLink("/chat/history"), {
        method: "POST",
        body: JSON.stringify({"amount": length, "connection_messages": false})
    });

    if (!res.ok || !res.body) return [];
    let new_messages = new Array();
    let rec_messages = await res.json();
    for(let x = 0; x < rec_messages.length; x++) {
        let msg = rec_messages[x];
        new_messages.push(msg.content);
    }
    return new_messages;
}*/

let data = initial_data;

async function update_stats(do_fetch) {
    if(do_fetch) {
        const res = await fetch(getApiLink("/stats"), { method: "GET" });
        data = await res.json();
    }

    if(show_full_stats) {
        commit_text.textContent = `Latest Commit: "${data["latest-commit"]}"`;
        uptime_text.textContent = `Uptime: ${formatSeconds(data["uptime"])}`;
    } else {
        commit_text.textContent = ``;
        uptime_text.textContent = ``;
    }
    visitor_text.textContent = `Unique Visitors: ${formatNumber(data["visitor-count"])}`;
}

await update_stats(false);
setInterval(() => {
    update_stats(true)
}, 3000);