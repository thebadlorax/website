let color = 1; const warn = document.getElementById("warn");
if(warn != null) {
    setInterval(() => {
        if(color == 0) {
            warn.style.color = "black";
            warn.style.textDecoration = "none";
            color = 1;
        } else {
            warn.style.color = "#6D2B2C";
            warn.style.textDecoration = "underline .3vw";
            color = 0;
        }
    }, 1000)
}

export function setCookie(cname, cvalue, exdays) {
    const d = new Date(); d.setTime(d.getTime() + (exdays*24*60*60*1000));
    document.cookie = `${cname}=${cvalue};expires=${d.toUTCString()};path=/`;
}

export function downloadBlob(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    document.body.appendChild(link);
    link.click();
    
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
}

export function* range(start, end, step = 1) {
    for (let i = start; i < end; i += step) {
        yield i;
    }
}

export function preloadImages(imageUrls) {
    const promises = imageUrls.map(src => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { resolve(img); }
        img.onerror = () => reject(src); 
        img.src = src;
    }));

    return Promise.all(promises);
}

export async function updateId() {
    let key_data = await fetch(getApiLink("/stats"), { method: "GET" });
    key_data = await key_data.json();
    let key = key_data["key"]

    if(getCookie("id") == "" || !getCookie("id").includes(key)) {
        const res = await fetch(getApiLink("/user/init"));
        const data = await res.json();
        setCookie("id", data["id"], 90);
    }
}

export function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
}

export function formatSeconds(ms, decimals = 1) {
    const units = [
        { label: "decade",  ms: 1000 * 60 * 60 * 24 * 365 * 10 },
        { label: "year",    ms: 1000 * 60 * 60 * 24 * 365 },
        { label: "week",    ms: 1000 * 60 * 60 * 24 * 7 },
        { label: "day",     ms: 1000 * 60 * 60 * 24 },
        { label: "hour",    ms: 1000 * 60 * 60 },
        { label: "minute",  ms: 1000 * 60 },
        { label: "second",  ms: 1000 }
    ];

    for (const unit of units) {
        const value = ms / unit.ms;
        if (value >= 1) {
            const rounded = Number(value.toFixed(decimals));
            return `${rounded} ${unit.label}${rounded !== 1 ? "s" : ""}`;
        }
    }

    return `${ms} ms`;
}

export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
  
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  
    const i = Math.floor(Math.log(bytes) / Math.log(k));
  
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatNumber(number, decimals = 2) {
    if (number === 0) return "0";
  
    const k = 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["", "k", "m", "b", "t", "qd", "qn", "sx", "sp", "oc", "no", "de", "ude", "dde", "tde", "vg", "tg", "qa", "qi", "se", "sg", "og", "ng", "ce", "uce", "dce"];
  
    const i = Math.floor(Math.log(number) / Math.log(k));
  
    return parseFloat((number / Math.pow(k, i)).toFixed(dm)) +  sizes[i];
}

export async function getPoints() {
    const res = await fetch("/user/points/query", {
        method: "GET",
        headers: {
          "Content-Disposition": `attachment; id=${getCookie("id")}`
        }
    });
    const data = await res.json();

    return data["points"];
}

export const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

export function getApiLink(route) {
    let link;
    if(location.host.includes("66.65.25.15")) {
        link = location.protocol + '//' + location.host + '/subdomain=api' + route // allow ip to emulate subdomains
    } else {
        link = location.protocol + '//' + 'api.' + location.host + route
    }
    return link
}

export function getTextWidth(text, font) {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    
    context.font = font;
    
    const metrics = context.measureText(text);
    return metrics.width;
  }

export async function changeSettingOnAccount(setting, value) {
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    let name = saved_data["account"]["name"];
    let pass = saved_data["account"]["pass"];
    saved_data.settings[setting] = value;
    let req = await fetch(getApiLink("/user/account/update"), {
        method: "POST",
        body: JSON.stringify({"name": name, "pass": pass, "updated": saved_data})
    });
    if(req.status != 200) {
        alert(`error updating setting ${setting} to ${value} on your account`);
    }
    let new_data = await req.json();
    window.localStorage.setItem("user", JSON.stringify(new_data));
}

export function getSettingOnAccount(setting) { // local only
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    return saved_data.settings[setting];
}

export function getAccountCredentials() {
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    return JSON.stringify({"name": saved_data["account"]["name"], "pass": saved_data["account"]["pass"]})
}

export async function refreshAccount() {
    let req = await fetch(getApiLink("/user/account/fetch"), {
        method: "POST",
        body: getAccountCredentials()
    });
    let json = await req.json();
    window.localStorage.setItem("user", JSON.stringify(json));
}

export const isOnlyDigits = (str) =>{ return /^\d+$/.test(str) }

await updateId();

console.log("get out of here")