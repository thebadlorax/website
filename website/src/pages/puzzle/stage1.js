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

async function downloadPDF() {
    try {
        const res = await fetch(getApiLink("/puzzle/getStage2Clue"));
    
        if (!res.ok || !res.body) return;
    
        const total = Number(res.headers.get("Content-Length"));
        let received = 0;
    
        const reader = res.body.getReader();
        const chunks = [];
    
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
    
          chunks.push(value);
          received += value.length;
        }
    
        const blob = new Blob(chunks);
        const url = URL.createObjectURL(blob);
    
        const a = document.createElement("a");
        a.href = url;
        a.download = "stage-2.pdf";
        document.body.appendChild(a);
        a.click();
    
        URL.revokeObjectURL(url);
        a.remove();
    } catch (err) {
        console.error("Download failed", err);
        return;
    }
}



if(localStorage.getItem("abcdef")) {
    document.getElementById("rd").addEventListener("click", async () => {
        await downloadPDF();
    })
    document.getElementById("poem-button").addEventListener("click", async () => {
        let r = await fetch(getApiLink("/puzzle/validateStage2Poem"), {
            body: JSON.stringify({"poem": document.getElementById("poem-input").value}),
            method: "POST"
        })
        let json = await r.json();
        if(!json.isValid) {
            alert("invalid poem (make sure everything is seperated correctly onto new lines, just like it would be in the pdf)")
        } else {
            localStorage.setItem("stage2Key", json.key)
            location.href = "/stage2"
        }
    });

    let r2 = await fetch(getApiLink("/puzzle/validateStage2Key"), {
        body: JSON.stringify({"key": localStorage.getItem("stage2Key") || ""}),
        method: "POST"
    })
    let json = await r2.json();
    if(json.isValid) {
        location.href = "/stage2"
    }
} else {
    let p = prompt("password?");
    let r = await fetch(getApiLink("/puzzle/validateStage1Password"), {
        body: JSON.stringify({"pass": p}),
        method: "POST"
    })
    let json = await r.json();
    
    if(!json.isValid) {
        alert("invalid password");
        window.location.href = "/"
    } else {
        localStorage.setItem("abcdef", true);
        await downloadPDF();
        location.reload();
    }
}
