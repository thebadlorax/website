const { setCookie, getCookie, getApiLink } = await import('./common.js');

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
const startBtn = document.getElementById("startVoiceBtn");
let in_vc = false;
startBtn.addEventListener("click", () => {
    in_vc = !in_vc;
    if(in_vc) {
        ws.send(`${name} has entered voice chat`)
    } else {
        ws.send(`${name} has exited voice chat`)
    }
})

let color = getCookie("color") || "#000000"
color_input.value = color;
color_input.style.color = color;
color_input.addEventListener("input", () => {
    color_input.value = `#${color_input.value.slice(1)}`
    if(color_input.value.length == 7) {
        color = color_input.value;
        color_input.style.color = color;
        setCookie("color", color, 90);
    }
})

const urlRegex = /(https?:\/\/[^\s]+)/g;
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
let wsUri; 
if(location.host.includes("66.65.25.15")) {
    wsUri = `${protocol}//${location.host}/subdomain=api/chat/live`;
} else {
    wsUri = `${protocol}//api.${location.host}/chat/live`;
}
const ws = new WebSocket(wsUri);
ws.addEventListener('message', (e) => {
    if(e.data[0] == "_") {
        const method = e.data.slice(1, e.data.indexOf("="));
        const value = e.data.slice(e.data.indexOf("=")+1);
        switch(method) {
            case "SETCHATTERS":
                chatter_text.textContent = `Active Chatters: ${value}`;
                break;
        }
    } else {
        messages.push(`${e.data}`);
        update_messages(`${e.data}`);
    }
});
ws.addEventListener("open", () => {
    ws.send(`_NAME=${name}`);
    ws.send(`_ID=${getCookie("id")}`)
    ws.send(`_CONNECT=null`);
})

let name = getCookie("username") || "No Name";
name_input.value = name;
let messages = [];

let allEmojis = [];
const kaomojis = [
    "(≧◡≦)", "(＾▽＾)", "(￣▽￣)", "(ಠ_ಠ)", 
    "(╯°□°）╯︵ ┻━┻", "(ಥ﹏ಥ)", "(¬‿¬)", "(ʘ‿ʘ)", 
    "(ง •̀_•́)ง", "¯\\_(ツ)_/¯", "(づ｡◕‿‿◕｡)づ", "(•̀ᴗ•́)و",
    "(˶˃𐃷˂˶)", "𐔌՞. .՞𐦯", "૮₍ ´ ꒳ `₎ა", "( ˶°ㅁ°) !!",
    "𓆝 𓆟 𓆞 𓆝 𓆟", "𐔌՞꜆.  ̫.꜀՞𐦯", "ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧",
    "｡°(°¯᷄◠¯᷅°)°｡"
];

const emojiRowHeight = 35;

// ------------------ CHAT FUNCTIONS ------------------
await init();

msg_input.addEventListener("keydown", (event) => { 
    if (event.key === "Enter") {
        if(msg_input.value.trim() == "") return;
        ws.send(`${color}[${name}]: ${msg_input.value}`);
        msg_input.value = "";
    }
});

name_input.addEventListener("keydown", (event) => { 
    if (event.key === "Enter") {
        let new_name = name_input.value || "No Name";
        ws.send(`${name} changed their name to ${new_name}`);
        name = new_name;
        setCookie("username", name, 90);
        ws.send(`_NAME=${name}`);
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

async function init() {
    messages = await fetch_history(100);
    messages.forEach(msg => update_messages(msg));
}

async function fetch_history(length) {
    const res = await fetch(getApiLink("/chat/history"), {
        method: "GET",
        headers: { "Content-Disposition": `attachment; history=${length}` }
    });

    if (!res.ok || !res.body) return [];
    return await res.json();
}

// ------------------ RESPONSIVE VIRTUAL SCROLL EMOJI PICKER FIX ------------------
const bufferRows = 3;

// Load all emojis once
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

// Clear emojiGrid completely
function clearEmojiGrid() {
    emojiGrid.innerHTML = "";
    emojiGrid.removeEventListener("scroll", emojiGrid._virtualScrollHandler);
    emojiGrid.style.height = "";
    emojiGrid.style.overflowY = "auto";
    emojiGrid.style.position = "";
}

// Render All emojis with responsive virtual scroll
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

        // Columns based on current width
        const pickerWidth = emojiGrid.clientWidth;
        const emojiSize = 40; // button + margin
        const columns = Math.max(1, Math.floor(pickerWidth / emojiSize));
        const totalRows = Math.ceil(allEmojis.length / columns);

        spacer.style.height = `${totalRows * emojiRowHeight}px`;

        const startRow = Math.max(0, Math.floor(scrollTop / emojiRowHeight) - bufferRows);
        const endRow = Math.min(totalRows, Math.ceil((scrollTop + emojiGrid.clientHeight) / emojiRowHeight) + bufferRows);

        // Remove previous buttons
        spacer.querySelectorAll(".emoji").forEach(e => e.remove());

        // Render visible buttons
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

    // Store the handler so we can remove it later
    emojiGrid._virtualScrollHandler = render;
    emojiGrid.addEventListener("scroll", render);
    render();

    // Re-render on resize
    window.addEventListener("resize", render);
}

// Render Kaomoji
function renderKaomoji() {
    emojiGrid.innerHTML = "";

    // Use grid layout
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

        // Dynamically scale font to fit button
        // Start large and shrink until it fits
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


// ------------------ CATEGORY BUTTONS ------------------
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

// ------------------ PICKER TOGGLE ------------------
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


// ------------------ CLOSE PICKER ON OUTSIDE CLICK ------------------
document.addEventListener("click", (e) => {
    if (!emoji_picker.contains(e.target) && e.target !== emoji_btn) {
        emoji_picker.classList.add("hidden");
    }
});
