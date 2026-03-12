const {getApiLink, changeSettingOnAccount, getSettingOnAccount, getCookie, setCookie } = await import('./common.js');

const message_box = document.getElementById("message-box");
message_box.addEventListener("wheel", (e) => {
    const atTop = message_box.scrollTop === 0;
    const atBottom = message_box.scrollTop + message_box.clientHeight >= message_box.scrollHeight;

    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
        e.preventDefault();
    }
}, { passive: false });
const msg_input = document.getElementById("input");
const name_input = document.getElementById("name");
const emoji_picker = document.getElementById("emoji-picker");
const emoji_btn = document.getElementById("emoji-btn");
const emojiGrid = document.querySelector(".emoji-grid");
const categoryButtons = document.querySelectorAll(".emoji-cat");
const color_input = document.getElementById("color");
const chatter_text = document.getElementById("chatters");
//const startBtn = document.getElementById("startVoiceBtn");
const connection_check = document.getElementById("show-con-messages");
let id = "";
connection_check.checked = (getCookie("con-msg") == "true")
connection_check.addEventListener("click", () => {
    setCookie("con-msg", connection_check.checked, 90);
    refresh();
})
document.getElementById("banner").addEventListener("click", () => {
    if(document.getElementById("chat").style.display == "none") {
        window.location.href = "/";
    } else {
        document.getElementById("chat").style.display = "none";
        document.getElementById("picker").style.display = "block";
        ws.send(JSON.stringify({"type": "wizard", "method": "unsubscribe", "content": "", "id": id}));
    }
})
let color;
try { color = getSettingOnAccount("color") }
catch { alert("make an account"); window.location.href = `${location.protocol}//${location.host}/?account`;}
color_input.value = color;
color_input.style.color = color;
color_input.addEventListener("input", () => {
    color_input.value = `#${color_input.value.slice(1)}`
    if(color_input.value.length == 7) {
        color = color_input.value;
        color_input.style.color = color;
        changeSettingOnAccount("color", color);
    }
})

const urlRegex = /(https?:\/\/[^\s]+)/g;
let wsUri; 
if(location.host.includes("66.65.25.15")) {
    wsUri = `${location.protocol}//${location.host}/subdomain=api/chat/live`;
} else {
    wsUri = `${location.protocol}//api.${location.host}/chat/live`;
}
let messages = [];
const ws = new WebSocket(wsUri);
document.getElementById("chat-name-input").value = "";
document.getElementById("chat-name-input").addEventListener("input", () => {
    if(document.getElementById("chat-name-input").value != "") {
        document.getElementById("create-room-button").style.display = "block";
        document.getElementById("private-room-check").style.display = "block";
        document.getElementById("private-room-text").style.display = "block";
    }
    else {
        document.getElementById("create-room-button").style.display = "none";
        document.getElementById("private-room-check").style.display = "none";
        document.getElementById("private-room-text").style.display = "none";
    }
})

document.getElementById("create-room-button").addEventListener("click", () => {
    if(document.getElementById("chat-name-input").value == "") return;
    ws.send(JSON.stringify({"type": "wizard", "method": "create", "user": JSON.parse(window.localStorage.getItem("user")), "content": document.getElementById("chat-name-input").value, "private": !document.getElementById("private-room-check").checked}));
})
document.getElementById("invite-input-button").addEventListener("click", () => {
    if(document.getElementById("invite-input").value == "") { return; }
    ws.send(JSON.stringify({"type": "wizard", "method": "invite", "content": document.getElementById("invite-input").value, "id": id}));
})
// TODO: add scrolling to top of chat by allowing history to be fetched from a start point;
ws.addEventListener('message', (e) => {
    let json = JSON.parse(e.data);
    switch(json.type) {
        case "system":
            switch(json.method) {
                case "chat_count":
                    chatter_text.textContent = `Active Chatters: ${json.content}`;
                    break;
            }
            break;
        case "wizard": 
            switch(json.method) {
                case "fetch":
                    document.getElementById("chat-picker-list").replaceChildren();
                    for(let x = 0; x < json.content.ids.length; x++) {
                        let id = json.content.ids[x];
                        let name = json.content.names[x];
                        let item = document.createElement("p");
                        item.classList.add("grid-item", "unselectable", "clickable");
                        item.textContent = name ? name : id;
                        item.style.fontWeight = json.content.private[x] ? "700" : "400"
                        item.style.color = json.content.private[x] ? "red" : "black";
                        item.addEventListener("click", () => { openChat(id); })
                        document.getElementById("chat-picker-list").appendChild(item);
                    }
                    break;
                case "create":
                    ws.send(JSON.stringify({"type": "wizard", "method": "fetch", "content": JSON.parse(window.localStorage.getItem("user")).account.id}));
                    document.getElementById("chat-name-input").value = "";
                    const event = new Event('input', {
                        bubbles: true,
                        cancelable: true
                    });
                    document.getElementById("chat-name-input").dispatchEvent(event);
                    break;
                case "invite":
                    if(json.content == "NO") {
                        alert("invalid name (probably doesn't exist)");
                    } else if(json.content == "ALR"){
                        alert("already in chat");
                    } else {
                        alert("added to chat")
                    } break;
            }
            break;
        case "message":
            messages.push(`${json.content}`);
            update_messages(`${json.content}`);
            break;
    }
});
ws.addEventListener("open", () => {
    ws.send(JSON.stringify({"type": "wizard", "method": "fetch", "content": JSON.parse(window.localStorage.getItem("user")).account.id}));
})

async function refresh() {
    message_box.replaceChildren();
    messages = await fetch_history(100);
    messages.forEach(msg => update_messages(msg));
}

let name = getSettingOnAccount("display_name") || "No Name";
name_input.value = name;

let allEmojis = [];
const kaomojis = [
    "(≧◡≦)", "(＾▽＾)", "(￣▽￣)", "(ಠ_ಠ)", 
    "(╯°□°）╯︵ ┻━┻", "(ಥ﹏ಥ)", "(¬‿¬)", "(ʘ‿ʘ)", 
    "(ง •̀_•́)ง", "¯\\_(ツ)_/¯", "(づ｡◕‿‿◕｡)づ", "(•̀ᴗ•́)و",
    "(˶˃𐃷˂˶)", "𐔌՞. .՞𐦯", "૮₍ ´ ꒳ `₎ა", "( ˶°ㅁ°) !!",
    "𓆝 𓆟 𓆞 𓆝 𓆟", "𐔌՞꜆.  ̫.꜀՞𐦯", "ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧",
    "｡°(°¯᷄◠¯᷅°)°｡", "⁶🤷⁷"
];

const emojiRowHeight = 35;

msg_input.addEventListener("keydown", (event) => { 
    if (event.key === "Enter") {
        if(msg_input.value.trim() == "") return;
        ws.send(JSON.stringify({"type": "message", "content": `${color}[${name}]: ${msg_input.value}`, "id": id}));
        msg_input.value = "";
    }
});

name_input.addEventListener("keydown", (event) => { 
    if (event.key === "Enter") {
        let new_name = name_input.value || "No Name";
        ws.send(JSON.stringify({"type": "message", "content": `${name} changed their name to ${new_name}`, "id": id}));
        name = new_name;
        changeSettingOnAccount("display_name", name);
        ws.send(JSON.stringify({"type": "system", "method": "update", "content": JSON.parse(window.localStorage.getItem("user")), "id": id}));
    }
});

function update_messages(newMessage) {
    const ele = document.createElement("p");
    ele.classList.add("basic-text");
    ele.style.marginLeft = "2.5vw";
    ele.style.maxWidth = "68ch";

    if(newMessage[0] == "#") {
        ele.style.color = newMessage.slice(0, 7);
        newMessage = newMessage.slice(7)
    }

    const matches = newMessage.match(urlRegex);
    if(matches) {
        ele.textContent = newMessage;
        matches.forEach(match => {
            ele.innerHTML = ele.innerHTML.replace(
                match,
                `<a class="basic-link" style="color: ${ele.style.color}" target="_blank" rel="noopener noreferrer" href="${match}">${match}</a>`
            );
        });
    } else {
        ele.textContent = newMessage;
    }

    message_box.appendChild(ele);
    message_box.scrollTop = message_box.scrollHeight;
}

async function fetch_history(length) {
    const res = await fetch(getApiLink("/chat/history"), {
        method: "POST",
        body: JSON.stringify({"amount": length, "connection_messages": getCookie("con-msg"), "id": id})
    });

    if (!res.ok || !res.body) return [];
    let new_messages = new Array();
    let rec_messages = await res.json();
    for(let x = 0; x < rec_messages.length; x++) {
        let msg = rec_messages[x];
        new_messages.push(msg.content);
    }
    return new_messages;
}

const bufferRows = 3;

async function loadAllEmojis() {
    try {
        const res = await fetch(getApiLink("/chat/emojis"));
        const data = await res.json();
        allEmojis = data["emojis"] || [];
        console.log("Loaded emojis:", allEmojis.length);
    } catch (err) {
        console.error("Failed to load emojis:", err);
    }
}

function clearEmojiGrid() {
    emojiGrid.innerHTML = "";
    emojiGrid.removeEventListener("scroll", emojiGrid._virtualScrollHandler);
    emojiGrid.style.height = "";
    emojiGrid.style.overflowY = "auto";
    emojiGrid.style.position = "";
}

function renderAllEmojisVirtual() {
    if (!allEmojis.length) return;

    clearEmojiGrid();

    emojiGrid.style.height = `${emojiRowHeight * 8}px`;
    emojiGrid.style.overflowY = "auto";
    emojiGrid.style.position = "relative";

    const spacer = document.createElement("div");
    spacer.style.position = "relative";
    emojiGrid.appendChild(spacer);

    const render = () => {
        const scrollTop = emojiGrid.scrollTop;

        const pickerWidth = emojiGrid.clientWidth;
        const emojiSize = 40; // button + margin
        const columns = Math.max(1, Math.floor(pickerWidth / emojiSize));
        const totalRows = Math.ceil(allEmojis.length / columns);

        spacer.style.height = `${totalRows * emojiRowHeight}px`;

        const startRow = Math.max(0, Math.floor(scrollTop / emojiRowHeight) - bufferRows);
        const endRow = Math.min(totalRows, Math.ceil((scrollTop + emojiGrid.clientHeight) / emojiRowHeight) + bufferRows);

        spacer.querySelectorAll(".emoji").forEach(e => e.remove());

        for (let row = startRow; row < endRow; row++) {
            for (let col = 0; col < columns; col++) {
                const index = row * columns + col;
                if (index >= allEmojis.length) break;

                const btn = document.createElement("button");
                btn.className = "emoji";
                btn.textContent = allEmojis[index];

                btn.style.position = "absolute";
                btn.style.top = `${row * emojiRowHeight}px`;
                btn.style.left = `${col * emojiSize}px`;
                btn.style.width = "35px";
                btn.style.height = "35px";

                spacer.appendChild(btn);
            }
        }
    };

    emojiGrid._virtualScrollHandler = render;
    emojiGrid.addEventListener("scroll", render);
    render();

    window.addEventListener("resize", render);
}

function renderKaomoji() {
    emojiGrid.innerHTML = "";

    emojiGrid.style.height = "";
    emojiGrid.style.overflowY = "auto";
    emojiGrid.style.position = "static";
    emojiGrid.style.display = "grid";
    emojiGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(45px, 1fr))";
    emojiGrid.style.gap = "4px";
    emojiGrid.style.padding = "4px";

    kaomojis.forEach(k => {
        const btn = document.createElement("button");
        btn.className = "emoji kaomoji";
        btn.textContent = k;

        // Basic styling
        btn.style.width = "auto";
        btn.style.height = "auto";
        btn.style.minWidth = "45px";
        btn.style.minHeight = "35px";
        btn.style.whiteSpace = "nowrap";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.padding = "2px";

        let fontSize = 24; // px, starting point
        btn.style.fontSize = fontSize + "px";

        document.body.appendChild(btn); // temporarily add to measure
        const maxWidth = 45;  // button minWidth
        const maxHeight = 35; // button minHeight

        while ((btn.scrollWidth > maxWidth || btn.scrollHeight > maxHeight) && fontSize > 8) {
            fontSize -= 1;
            btn.style.fontSize = fontSize + "px";
        }
        document.body.removeChild(btn); // remove temp

        emojiGrid.appendChild(btn);
    });
}

emojiGrid.addEventListener("click", e => {
    const btn = e.target.closest(".emoji"); // find closest ancestor with class emoji
    if (!btn || msg_input.value.length >= 40) return;
    msg_input.value += btn.textContent;
});


categoryButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
        categoryButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        if (btn.textContent === "All") {
            await loadAllEmojis();
            renderAllEmojisVirtual();
        } else if (btn.textContent === "Kaomoji") {
            renderKaomoji();
        }
    });
});

emoji_btn.addEventListener("click", async () => {
    emoji_picker.classList.toggle("hidden");

    if (!emoji_picker.classList.contains("hidden")) {
        const activeBtn = document.querySelector(".emoji-cat.active") || categoryButtons[0];
        activeBtn.classList.add("active");

        if (activeBtn.textContent === "Kaomoji") renderKaomoji();
        else {
            await loadAllEmojis();
            renderAllEmojisVirtual();
        }
    }
});

document.addEventListener("click", (e) => {
    if (!emoji_picker.contains(e.target) && e.target !== emoji_btn) {
        emoji_picker.classList.add("hidden");
    }
});

async function openChat(rec_id) {
    id = rec_id;
    ws.send(JSON.stringify({"type": "wizard", "method": "subscribe", "content": JSON.parse(window.localStorage.getItem("user")), "id": id}));
    document.getElementById("chat").style.display = "block";
    document.getElementById("picker").style.display = "none";
    document.getElementById("chat-id").textContent = `Chat ID: ${id}`
    refresh();
}