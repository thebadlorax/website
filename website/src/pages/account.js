/**
 * author thebadlorax
 * created on 26-02-2026-13h-47m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink } from "./common.js";

const account_button = document.getElementById("account-button");
const sign_in_button = document.getElementById("sign-in-button");
const delete_button = document.getElementById("delete-button");
const manage_text = document.getElementById("mng-txt");
const owned_folders_text = document.getElementById("owned-folders-acc");
const owned_folders_parent_text = document.getElementById("owned-folders-parent");
const sign_out_button = document.getElementById("sign-out-button");
const update_button = document.getElementById("update-button");
const sign_in_div = document.getElementById("sign-in");
const create_account_button = document.getElementById("create-account-button");
const account_menu = document.getElementById("account-menu");
const account_management = document.getElementById("account-management");
const main_container = document.getElementById("main-container");
const pass_input = document.getElementById("pass");
const name_input = document.getElementById("name");
const new_pass_input = document.getElementById("new-pass");
const new_name_input = document.getElementById("new-name");
const id_text = document.getElementById("id-acc");
const points_text = document.getElementById("points-acc");
const timestamp_text = document.getElementById("timestamp-acc");
const display_name_text = document.getElementById("display-name-acc");
const unique_text = document.getElementById("unq-visitors");
let password = ""
pass_input.value = "";
let menu_is_open = false;

async function updateManagementValues() {
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    let req = await fetch(getApiLink("/user/account/fetch"), {
        method: "POST",
        body: JSON.stringify({"name": saved_data["account"]["name"], "pass": saved_data["account"]["pass"]})
    });
    if(req.status != 200) { openMenu(); return; }
    let json = await req.json();
    window.localStorage.setItem("user", JSON.stringify(json));
    
    new_name_input.value = json["account"]["name"]
    password = json["account"]["pass"];
    new_pass_input.value = new_pass_input.value = "*".repeat(json["account"]["pass"].length-1) + json["account"]["pass"].at(-1);
    id_text.textContent = `ID: ${json["account"]["id"]}`
    points_text.textContent = `${json["statistics"]["points"]} points`
    timestamp_text.textContent = `Account created on ${new Date(json["statistics"]["cTime"]).toDateString()}`
    display_name_text.style.color = json["settings"]["color"]
    display_name_text.textContent = json["settings"]["display_name"]
    unique_text.textContent = `${json["statistics"]["uniquesOnCreation"]} unique visitors when you joined`
    let owned_folders = json["ownedFolders"].join(", ");
    if(owned_folders != "") {
        owned_folders_text.textContent = `${owned_folders}`;
        owned_folders_parent_text.textContent = `Claimed Folders:`;
        owned_folders_text.style.display = "block"
        owned_folders_parent_text.style.display = "block"
    }
    else {
        owned_folders_text.style.display = "none"
        owned_folders_parent_text.style.display = "none"
    }
   
    await fetch(getApiLink("/admin/verify"), {
        method: "POST",
        body: JSON.stringify({"name": saved_data["account"]["name"], "pass": saved_data["account"]["pass"]})
    }).then(r => {
        if(r.status == 200) {
            manage_text.style.color = "darkred";
        } else {
            manage_text.style.color = "black"
        }
    })
}

export async function openMenu() {
    let user = window.localStorage.getItem("user");
    let menu_to_open = 0
    if(user !== null) {
        try {
            user = JSON.parse(user);
            let req = await fetch(getApiLink("/user/account/fetch"), {
                method: "POST",
                body: JSON.stringify({"name": user["account"]["name"], "pass": user["account"]["pass"]})
            });
            if(req.status == 200) menu_to_open = 1
        } catch {}
    }
    password = ""
    if(menu_to_open == 0) {
        sign_in_div.style.display = "block"
        account_management.style.display = "none"
        pass_input.value = "";
        
    } else if(menu_to_open == 1) {
        sign_in_div.style.display = "none"
        account_management.style.display = "block"
        updateManagementValues();
    }
    main_container.style.display = "none"
    account_menu.style.display = "block"
    account_button.textContent = "Go Back"
    account_button.style.left = "87vw"
    menu_is_open = true;
}

function hideMenu() {
    main_container.style.display = "flex"
    account_menu.style.display = "none"
    account_button.style.left = "75vw"
    account_button.textContent = "Account Management"
    menu_is_open = false;
}

async function handleSignIn() {
    let test = password;
    const req = await fetch(getApiLink("/user/account/fetch"), {
        method: "POST",
        body: JSON.stringify({"name": name_input.value, "pass": test})
    });
    if(req.status == 404) {
        alert("invalid username or password") 
        pass_input.value = ""; password = ""
        return;
    }
    let json = await req.json();
    window.localStorage.setItem("user", JSON.stringify(json));
    await openMenu();
}

sign_in_button.addEventListener("click", async () => {
    await handleSignIn();
})

create_account_button.addEventListener("click", async () => {
    const req = await fetch(getApiLink("/user/account/create"), {
        method: "POST",
        body: JSON.stringify({"name": name_input.value, "pass": password})
    });
    if(req.status == 400) {
        alert("something went wrong (duplicate account)") 
        pass_input.value = ""; password = "";
        name_input = "";
        return;
    } else if(req.status != 201) {
        alert("something went wrong (idk)") 
        pass_input.value = ""; password = "";
        name_input = "";
        return;
    }
    let json = await req.json();
    window.localStorage.setItem("user", JSON.stringify(json));
    alert("created account")
    await openMenu();
})

account_button.addEventListener('click', async () => {
    if(!menu_is_open) {
        await openMenu();
    } else {
        hideMenu();
    }
})

sign_out_button.addEventListener("click", () => {
    window.localStorage.removeItem("user");
    password = "";
    openMenu();
})


function sanitize(str) {
    let n = str.replace(/[^\x20-\x7E]/g, '')
    return n;
}

async function handle_updating() {
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    let name = saved_data["account"]["name"];
    let pass = saved_data["account"]["pass"];
    saved_data["account"]["name"] = new_name_input.value;
    saved_data["account"]["pass"] = password;
    let req = await fetch(getApiLink("/user/account/update"), {
        method: "POST",
        body: JSON.stringify({"name": name, "pass": pass, "updated": saved_data})
    });
    let new_data = await req.json();
    window.localStorage.setItem("user", JSON.stringify(new_data));
    alert("updated");
}

update_button.addEventListener("click", async () => {
    await handle_updating();
})
new_pass_input.addEventListener("keydown", async (e) => {
    if(e.key == "Enter") {
        await handle_updating();
    }
})

new_name_input.addEventListener("keydown", async (e) => {
    if(e.key == "Enter") {
        await handle_updating();
    }
})

manage_text.addEventListener("click", () => {
    if(id_text.style.display == "none") id_text.style.display = "block"
    else id_text.style.display = "none"
})

const handle_enter = async (e) => {
    if(e.key == "Enter") {
        if(pass_input.value.trim() != "" && pass_input.value.trim() != "") await handleSignIn();
    }
}

pass_input.addEventListener("keydown", async (e) => {
    await handle_enter(e)
})

name_input.addEventListener("keydown", async (e) => {
    await handle_enter(e)
})

window.addEventListener("keydown", async (e) => {
    if(e.key != "Escape") return;
    if(menu_is_open) hideMenu();
    else await openMenu();
})

delete_button.addEventListener("click", async () => {
    if(!confirm("are you sure")) return;
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    let name = saved_data["account"]["name"];
    let pass = saved_data["account"]["pass"];
    let req = await fetch(getApiLink("/user/account/delete"), {
        method: "POST",
        body: JSON.stringify({"name": name, "pass": pass})
    });
    if(req.status != 200) { alert("something went wrong deleting your account"); return; }
    name_input.value = "";
    openMenu();
})

// TODO: temporary
let next_points_amt = 0;
let do_it = false;
points_text.addEventListener("click", () => {
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    next_points_amt += 10;
    if(do_it) return;
    do_it = true;
    setTimeout(async () => {
        await fetch(getApiLink("/user/account/changePoints"), {
            method: "POST",
            body: JSON.stringify({"name": saved_data["account"]["name"], "pass": saved_data["account"]["pass"], "amt": next_points_amt})
        });
        updateManagementValues();
        do_it = false;
        next_points_amt = 0;
    }, 500);
})

const sanitize_input = (input) => {
    input.addEventListener("input", () => {
        input.value = sanitize(input.value)
    });
}

const handle_password_input = (input) => {
    input.addEventListener("input", (e) => {
        const banned_inputs = ["\\", "/", "."]
        if (e.inputType === "deleteContentBackward") password = password.slice(0, -1);
        else if(e.inputType === "insertText") { if(!banned_inputs.includes(e.data)) password += e.data; }
        input.value = "*".repeat(password.length).slice(0, -1) + (password.at(-1) == undefined ? "" : password.at(-1));
    });
}
sanitize_input(new_name_input)
sanitize_input(new_pass_input)
sanitize_input(pass_input)
sanitize_input(name_input)

handle_password_input(new_pass_input)
handle_password_input(pass_input)

if(window.location.href.includes("?account")) {
    openMenu(); history.replaceState(null, '', window.location.href.slice(0, window.location.href.indexOf("?account")))
}

const signInVisibilityHandler = () => {
    if(pass_input.value != "" && name_input.value != "") {
        create_account_button.style.display = "block";
        sign_in_button.style.display = "block";
    }
    else {
        create_account_button.style.display = "none";
        sign_in_button.style.display = "none";
    }
}

pass_input.addEventListener("input", signInVisibilityHandler)
name_input.addEventListener("input", signInVisibilityHandler)