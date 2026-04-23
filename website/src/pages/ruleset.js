/**
 * author thebadlorax
 * created on 23-04-2026-14h-05m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

// TABS: [0|1|2|3         4] (ui)

const blocks = {
    "test1": {
        "name": "testing block",
        "onClick": () => {
            open_submenu("test_submenu");
        },
        "onEnterWorkspace": () => {},
        "color": "yellow"
    },
    "test2": {
        "name": "testing block 2",
        "onClick": () => {},
        "onEnterWorkspace": () => {},
        "color": ""
    },
    "test3": {
        "name": "testing block 3",
        "onClick": () => {},
        "onEnterWorkspace": () => {},
        "color": "cyan"
    },
    "test4": {
        "name": "testing block 4",
        "onClick": () => {},
        "onEnterWorkspace": () => {},
        "color": ""
    },
    "test5": {
        "name": "testing block 5",
        "onClick": () => {},
        "onEnterWorkspace": () => {},
        "color": "green"
    },
    "submenu_test1": {
        "name": "test setting",
        "submenu": true,
        "color": ""
    },
}

const menus = {
    "test_submenu": {
        "blocks": [
            "submenu_test1"
        ],
        "color": ""
    }
}

let context = {
    "is_open": false,
    "window_title": "",
    "current_tab": 0,
    "toolbar_disabled": false,
    "in_toolbar_submenu": false
}; const ruleset_div = document.getElementById("ruleset-maker");
const exit_button = document.getElementById("rm_exit_button");
const window_title_text = document.getElementById("rm_title_text");
const toolbar_div = document.getElementById("rm_toolbar_blocks_div");
const workspace_div = document.getElementById("rm_workspace_div");
const workspace_blocks_div = document.getElementById("rm_workspace_blocks_div");

const on_close_ruleset_div = () => {
    ruleset_div.style.display = "none";
    document.body.classList.remove("no-scroll");
    document.getElementById("receipt").style.display = "block";
    context.is_open = false;
}; const on_open_ruleset_div = () => {
    ruleset_div.style.display = "block";
    document.body.classList.add("no-scroll");
    change_focused_tab(context.current_tab);
    document.getElementById("receipt").style.display = "none";
    context.is_open = true;
}; const on_open_tab = (tab) => {
    clear_toolbar_blocks();
    context.in_toolbar_submenu = false;
    toolbar_div.style.backgroundColor = ""
    switch(tab) {
        case 0: {
            set_toolbar_visible(true);
            create_block_on_toolbar("test1");
            create_block_on_toolbar("test2");
            create_block_on_toolbar("test3");
            return;
        }
        case 1: {
            set_toolbar_visible(true);
            create_block_on_toolbar("test4");
            create_block_on_toolbar("test5");
            return;
        }
        case 2: {
            set_toolbar_visible(false);
            return;
        }
        case 3: {
            set_toolbar_visible(false);
            return;
        }
        case 4: {
            set_toolbar_visible(true);
            return;
        }
    }
}; 


// TOOLBAR
const create_block_on_toolbar = (id) => {
    let ele = document.createElement("div");
    ele.textContent = blocks[id]["name"];
    ele.style.backgroundColor = blocks[id]["color"] || "";
    ele.addEventListener("click", () => { 
        if(!blocks[id].submenu) create_block_in_workspace(id);
     });
    ele.classList.add("unselectable");
    toolbar_div.appendChild(ele)
}; const clear_toolbar_blocks = () => { toolbar_div.replaceChildren(); }
const set_toolbar_visible = (state) => {
    context.toolbar_disabled = state;
    if(!state) document.getElementById("rm_toolbar_div").classList.add("disabled-section");
    else document.getElementById("rm_toolbar_div").classList.remove("disabled-section");
}; const open_submenu = (menuid) => {
    let menu = menus[menuid];
    clear_toolbar_blocks();
    toolbar_div.style.backgroundColor = menu.color || ""
    menu.blocks.forEach((b) => {create_block_on_toolbar(b)});
    context.in_toolbar_submenu = true;
}

// WORKSPACE
const create_block_in_workspace = (id) => {
    blocks[id].onEnterWorkspace();
    let ele = document.createElement("div");
    ele.textContent = blocks[id]["name"];
    ele.style.backgroundColor = blocks[id]["color"] || "";
    ele.addEventListener("click", () => {
        if(!context.in_toolbar_submenu) blocks[id].onClick();
        else on_open_tab(context.current_tab);
    });
    ele.classList.add("unselectable");
    ele.dataset.is_block_in_workspace = true;
    ele.dataset.id = id;
    ele.id = `rm_workspace_block$${id}`;
    ele.dataset.index = workspace_blocks_div.childElementCount;
    workspace_blocks_div.appendChild(ele)
};

const change_window_title = (title) => {
    context.window_title = title;
    window_title_text.textContent = title;
}; 
const change_focused_tab = (tab) => {
    document.getElementById(`rm_titlebar_button${context.current_tab}`).classList.remove("focused-titlebar-button");
    context.current_tab = tab;
    document.getElementById(`rm_titlebar_button${tab}`).classList.add("focused-titlebar-button")
    on_open_tab(tab);
}; for(let x = 0; x <= 4; x++) { document.getElementById(`rm_titlebar_button${x}`).addEventListener("click", () => { change_focused_tab(x); }) }

exit_button.addEventListener("click", () => {
    on_close_ruleset_div();
}); 

document.addEventListener("keydown", (e) => { // temporary
    if(e.key == "Escape") {
        if(context.is_open) on_close_ruleset_div();
        else on_open_ruleset_div();
    }
}); document.addEventListener("contextmenu", (e) => { 
    if(!context.is_open) return;

    e.preventDefault();
    if(e.target.dataset.is_block_in_workspace) e.target.remove();
}); document.addEventListener("click", (e) => {
})

change_window_title('"game title" editor') // temporary