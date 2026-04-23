/**
 * author thebadlorax
 * created on 22-04-2026-21h-31m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink } from "./common.js";

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
}); let news = await fetch(getApiLink("/news"), { method: "GET" }); news = await news.json(); news_input.value = news.join("\n");

const feedback = document.getElementById("feedback");
const reset_feedback = async () => {
    feedback.replaceChildren();
    let title = document.createElement("p");
    title.textContent = "feedback";
    title.style.fontSize = "3vw";
    title.style.textDecoration = "underline";
    feedback.appendChild(title);
    
    let fb = await fetch(getApiLink("/feedback/fetch"), { method: "GET" }); fb = await fb.json(); fb = fb.feedback;
    fb.forEach(f => {
        let ele = document.createElement("p");
        ele.textContent = f;
        ele.style.cursor = "pointer";
        ele.addEventListener("click", async () => {
            await fetch(getApiLink("/admin/deleteFeedback"), { method: "POST", body: JSON.stringify({"name": user.account.name, "pass": user.account.pass, "feedback": ele.textContent})}).then((e) => {
                if(e.status == 200) {
                    reset_feedback();
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