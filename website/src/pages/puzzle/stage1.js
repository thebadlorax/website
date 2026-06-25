/**
 * author thebadlorax
 * created on 25-06-2026-12h-42m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

function getApiLink(route) {
    let link;
    if(location.host.includes("66.65.25.15")) {
        link = location.protocol + '//' + location.host + '/subdomain=api' + route // allow ip to emulate subdomains
    } else {
        link = location.protocol + '//' + 'api.' + location.host + route
    }
    return link
};

function formatTimeLeft(targetDate) {
        const now = new Date();
        const difference = new Date(targetDate) - now;
    
        if (difference <= 0) {
        return "0:0:0:0";
        }
    
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
    
        return `${days}:${hours}:${minutes}:${seconds}`;
};

let r = await fetch(getApiLink("/puzzle/validateStage1Password"), {
    body: JSON.stringify({"pass": prompt("password?")}),
    method: "POST"
})
let json = await r.json();

if(!json.isValid) {
    alert("invalid password");
    window.location.href = "/"
} else {
    const countdown = document.createElement("p");
    d.appendChild(countdown);
    setInterval(() => {
        countdown.textContent = formatTimeLeft("2026-08-31T00:00:00.000Z");
    }, 100) 
}