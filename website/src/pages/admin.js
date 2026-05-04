/**
 * author thebadlorax
 * created on 22-04-2026-21h-31m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink, formatSeconds, formatBytes } from "./common.js";

const user = JSON.parse(window.localStorage.getItem("user"));
if(!user) { alert("not authorized"); window.location.href = "/"; }
await fetch(getApiLink("/admin/verify"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass})}).then((e) => {
    if(e.status == 200) {
        document.getElementById("main").style.display = "block";
        document.getElementById("feedback").style.display = "block";
    } else {
        alert("not authorized");
        window.location.href = "/";
    }
});
// ------------
const news_input = document.getElementById("cn");
document.getElementById("submit_cn").addEventListener("click", async () => {
    await fetch(getApiLink("/admin/changeNews"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "news": news_input.value.split("\n")})}).then((e) => {
        if(e.status == 200) {
            alert("success")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
}); 
const update_news = async () => { let news = await fetch(getApiLink("/news"), { method: "GET" }); news = await news.json(); news_input.value = news.join("\n"); }
news_input.value = "loading";
document.getElementById("main-text").addEventListener("click", () => {
    window.location.href = `${location.protocol}//${location.host}/`
})

const feedback = document.getElementById("feedback");
const reset_feedback = async () => {
    feedback.replaceChildren();
    let title = document.createElement("p");
    title.textContent = "feedback";
    title.style.fontSize = "3vw";
    title.style.width = "25vw";
    title.style.textDecoration = "underline";
    feedback.appendChild(title);

    let fb = await fetch(getApiLink("/feedback/fetch"), { method: "GET" }); fb = await fb.json(); fb = fb.feedback;
    fb.forEach(f => {
        let ele = document.createElement("p");
        ele.textContent = `- ${f}`;
        ele.style.cursor = "pointer";
        ele.style.textWrap = "wrap";
        ele.style.width = "25vw";
        ele.addEventListener("click", async () => {
            await fetch(getApiLink("/admin/deleteFeedback"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "feedback": ele.textContent.replace("- ", "")})}).then((e) => {
                if(e.status == 200) {
                    reset_feedback();
                } else if(e.status == 400) {
                    alert("invalid feedback?")
                } else {
                    alert("not authorized");
                    window.location.href = "/";
                }
            });
        })
        feedback.appendChild(ele);
    })
}
await reset_feedback();

const id_input = document.getElementById("ui");
document.getElementById("submit_ui").addEventListener("click", async () => {
    await fetch(getApiLink("/admin/getID"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "nameToFetch": id_input.value})}).then(async (e) => {
        if(e.status == 200) {
            let json = await e.json();
            alert(json.id);
        } else if(e.status == 400) {
            alert("invalid username")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
})

const fp = document.getElementById("fp");
document.getElementById("submit_fp").addEventListener("click", async () => {
    await fetch(getApiLink("/admin/fetchPass"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "nameToFetch": fp.value})}).then(async (e) => {
        if(e.status == 200) {
            let json = await e.json();
            alert(json.pass);
        } else if(e.status == 400) {
            alert("invalid username")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
})

const da = document.getElementById("da");
document.getElementById("submit_da").addEventListener("click", async () => {
    await fetch(getApiLink("/admin/deleteAccount"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "name2": da.value})}).then(async (e) => {
        if(e.status == 200) {
            alert("success")
        } else if(e.status == 400) {
            alert("invalid username")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
})

const cpa1 = document.getElementById("cpa1"); const cpa2 = document.getElementById("cpa2");
document.getElementById("submit_cpa").addEventListener("click", async () => {
    await fetch(getApiLink("/admin/changePassword"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "name2": cpa1.value, "pass2": cpa2.value})}).then(async (e) => {
        if(e.status == 200) {
            alert("success")
        } else if(e.status == 400) {
            alert("invalid username")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
});

const sp1 = document.getElementById("sp1"); const sp2 = document.getElementById("sp2");
document.getElementById("submit_sp").addEventListener("click", async () => {
    await fetch(getApiLink("/admin/setPoints"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "name2": sp1.value, "amt": parseInt(sp2.value)})}).then(async (e) => {
        if(e.status == 200) {
            alert("success")
        } else if(e.status == 400) {
            alert("invalid username")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
})

const ma = document.getElementById("ma");
document.getElementById("submit_ma").addEventListener("click", async () => {
    await fetch(getApiLink("/admin/giveAdmin"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "name2": ma.value})}).then(async (e) => {
        if(e.status == 200) {
            alert("success")
        } else if(e.status == 400) {
            alert("invalid username")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
})

const ra = document.getElementById("ra");
document.getElementById("submit_ra").addEventListener("click", async () => {
    await fetch(getApiLink("/admin/revokeAdmin"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "name2": ra.value})}).then(async (e) => {
        if(e.status == 200) {
            alert("success")
        } else if(e.status == 400) {
            alert("invalid username")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
})

document.getElementById("get_db").addEventListener("click", async () => {
    alert("this may take a little bit (click to start)")
    await fetch(getApiLink("/admin/fetchDatabase"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass})}).then(async (e) => {
        if(e.status == 200) {
            let json = await e.json();
            const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            URL.revokeObjectURL(url);
        } else if(e.status == 500) {
            alert("server error")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
});

let last_db_update_time = 0;
const refresh_db_info = async () => {
    await fetch(getApiLink("/admin/dbInfo"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass})}).then(async (e) => {
        if(e.status == 200) {
            let json = await e.json();
            let h = json.bk_diff;
            last_db_update_time = h;
            document.getElementById("db_bk").textContent = `last database backup: ${formatSeconds(json.bk_diff)} ago, database size: ${formatBytes(json.size)}`
        } else if(e.status == 500) {
            alert("server error")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
}
refresh_db_info();
update_news();

document.getElementById("restore_db").addEventListener("click", async () => {
    if(!confirm(`are you sure? the last backup was ${formatSeconds(last_db_update_time)} ago.`)) return;
    await fetch(getApiLink("/admin/restoreDatabase"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass})}).then(async (e) => {
        if(e.status == 200) {
            alert("success")
            refresh_db_info();
        } else if(e.status == 500) {
            alert("server error")
        } else {
            alert("not authorized");
            window.location.href = "/";
        }
    });
})

setInterval(refresh_db_info, 5000);

