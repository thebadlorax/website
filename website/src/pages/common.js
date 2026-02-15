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

export function* range(start, end, step = 1) {
    for (let i = start; i < end; i += step) {
        yield i;
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

export function formatSeconds(seconds) {
    let text = `${seconds}s` // sec
    if(seconds >= 60) { // min
        text = `${(seconds/60).toFixed(1)}m`;
    } if(seconds >= 3600) { // hour
        text = `${((seconds/60)/60).toFixed(1)}h`;
    } if(seconds >= 86400) { // day
        text = `${(((seconds/60)/60)/24).toFixed(1)}d`;
    } if(seconds >= 604800) { // week
        text = `${((((seconds/60)/60)/24)/7).toFixed(1)}w`;
    } if(seconds >= 31556952) { // year
        text = `${(((((seconds/60)/60)/24)/7)/52.1775).toFixed(1)}y`;
    }
    return text;
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

export function getApiLink(route) {
    let link;
    if(location.host.includes("66.65.25.15")) {
        link = location.protocol + '//' + location.host + '/subdomain=api' + route // allow ip to emulate subdomains
    } else {
        link = location.protocol + '//' + 'api.' + location.host + route
    }
    return link
}