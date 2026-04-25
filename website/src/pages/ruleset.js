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
        "menu": "test_submenu",
        "color": "yellow"
    },
    "test2": {
        "name": "testing block 2",
        "menu": "test_submenu2",
        "color": "purple"
    },
    "test3": {
        "name": "testing block 3",
        "menu": "test_submenu3",
        "color": "cyan"
    },
    "supertest": {
        "name": "supertest block",
        "menu": "supertest",
        "color": "pink"
    },
    "submenu_test1": {
        "name": "number setting",
        "submenu": true,
        "color": "green",
        "settings": {
            "type": "number",
            "name": "amount"
        }
        
    },
    "submenu_test2": {
        "name": "text setting",
        "submenu": true,
        "color": "",
        "settings": {
            "type": "string",
            "name": "name"
        }
    },
    "submenu_test3": {
        "name": "boolean setting",
        "submenu": true,
        "color": "yellow",
        "settings": {
            "type": "boolean",
            "name": "active"
        }
    },
    "supertest1": {
        "name": "boolean setting",
        "submenu": true,
        "color": "yellow",
        "settings": {
            "type": "boolean",
            "name": "active"
        }
    },
    "supertest2": {
        "name": "number setting",
        "submenu": true,
        "color": "green",
        "settings": {
            "type": "number",
            "name": "amount"
        }
        
    },
    "supertest3": {
        "name": "text setting",
        "submenu": true,
        "color": "",
        "settings": {
            "type": "string",
            "name": "name"
        }
    }
}

const menus = {
    "timeline": {
        "blocks": [
            "test1",
            "test2",
            "test3",
            "supertest"
        ]
    },
    "test_submenu": {
        "blocks": [
            "submenu_test1"
        ],
        "color": ""
    },
    "test_submenu2": {
        "blocks": [
            "submenu_test2"
        ],
        "color": ""
    },
    "test_submenu3": {
        "blocks": [
            "submenu_test3"
        ],
        "color": ""
    },
    "supertest": {
        "blocks": [
            "supertest1",
            "supertest2",
            "supertest3",
        ],
        "color": ""
    }
}

let save = {
    "timeline": {
        "blocks": []
    }
};

let context = {
    "is_open": false,
    "window_title": "",
    "current_tab": 0,
    "toolbar_disabled": false,
    "toolbar_submenu": "",
    "focused_block": document.body,
}; const ruleset_div = document.getElementById("ruleset-maker");
const exit_button = document.getElementById("rm_exit_button");
const window_title_text = document.getElementById("rm_title_text");
const toolbar_div = document.getElementById("rm_toolbar_blocks_div");
const workspace_div = document.getElementById("rm_workspace_div");
workspace_div.addEventListener("click", (e) => {
    if(context.toolbar_submenu != "" && !e.target.dataset.is_block_in_workspace) on_open_tab(context.current_tab);
})
const workspace_blocks_div = document.getElementById("rm_workspace_blocks_div");
const workspace_settings_div = document.getElementById("rm_workspace_settings_div");

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
    hide_timeline();
    hide_settings();
    toolbar_div.style.backgroundColor = "";
    context.focused_block.classList.remove("focused");
    context.focused_block = document.body;
    switch(tab) {
        case 0: {
            set_toolbar_visible(true);
            set_workspace_visiblity(true);
            workspace_blocks_div.style.display = "block";
            workspace_settings_div.style.display = "none";
            menus["timeline"]["blocks"].forEach((b) => { create_block_on_toolbar(b); });
            return;
        }
        case 1: {
            set_toolbar_visible(false);
            set_workspace_visiblity(false);
            return;
        }
        case 2: {
            set_toolbar_visible(false);
            set_workspace_visiblity(false);
            return;
        }
        case 3: {
            set_toolbar_visible(false);
            set_workspace_visiblity(false);
            return;
        }
    }
}; 


// TOOLBAR
const create_block_on_toolbar = (id) => {
    let ele = document.createElement("div");
    ele.textContent = blocks[id]["name"];
    ele.style.backgroundColor = blocks[id]["color"] || "";
    ele.dataset.index = toolbar_div.childElementCount;
    if (blocks[id].submenu) {
        let setting = blocks[id]["settings"];
        let setting_ele = document.createElement("input");
    
        setting_ele.placeholder = setting.name;
    
        const block = get_focused_save_block();
        if (block && block.settings[setting.name] !== undefined) {
            setting_ele.value = block.settings[setting.name];
        }
    
        setting_ele.addEventListener("change", () => {
            const block = get_focused_save_block();
            if (!block) return;
    
            let value = setting_ele.value;
            let parsed;
    
            if (setting.type === "number") {
                parsed = Number(value);
                if (isNaN(parsed)) parsed = null;
            } else if (setting.type === "boolean") {
                if (value.toLowerCase() === "true") parsed = true;
                else if (value.toLowerCase() === "false") parsed = false;
                else parsed = null;
            } else {
                parsed = value;
            }
    
            if (parsed === null) {
                delete block.settings[setting.name];
                setting_ele.value = "";
            } else {
                block.settings[setting.name] = parsed;
            }
        });
    
        ele.appendChild(setting_ele);
    }
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
    context.toolbar_submenu = menuid;
}; 

// WORKSPACE
const create_block_in_workspace = (id) => {
    const uid = generate_uid();

    let ele = document.createElement("div");
    ele.textContent = blocks[id]["name"];
    ele.style.backgroundColor = blocks[id]["color"] || "";

    ele.dataset.uid = uid;
    ele.dataset.id = id;
    ele.dataset.is_block_in_workspace = true;

    ele.addEventListener("click", () => {
        if (context.focused_block !== ele) {
            focus_block_in_workspace(ele);
        } else {
            on_open_tab(context.current_tab);
        }
    });

    ele.addEventListener("contextmenu", () => {
        remove_block_by_uid(uid);
        ele.remove();
    });

    ele.classList.add("unselectable");

    save.timeline.blocks.push({
        uid,
        id,
        settings: {}
    });

    workspace_blocks_div.appendChild(ele);
}; const remove_block_by_uid = (uid) => {
    save.timeline.blocks = save.timeline.blocks.filter(b => b.uid !== uid);
}; const hide_timeline = () => { workspace_blocks_div.style.display = "none"; };
const set_workspace_visiblity = (state) => {
    if(!state) workspace_div.classList.add("disabled-section")
    else workspace_div.classList.remove("disabled-section")
}; const focus_block_in_workspace = (ele) => {
    context.focused_block.classList.remove("focused");
    ele.classList.add("focused");
    context.focused_block = ele;
    open_submenu(blocks[ele.dataset.id].menu);
}; const get_focused_save_block = () => {
    if (!context.focused_block.dataset.uid) return null;
    return save.timeline.blocks.find(
        b => b.uid === context.focused_block.dataset.uid
    );
}; const rebuild_workspace_from_save = () => {
    workspace_blocks_div.replaceChildren();

    save.timeline.blocks.forEach((blockData) => {
        const id = blockData.id;

        let ele = document.createElement("div");
        ele.textContent = blocks[id]["name"];
        ele.style.backgroundColor = blocks[id]["color"] || "";

        ele.dataset.uid = blockData.uid;
        ele.dataset.id = id;
        ele.dataset.is_block_in_workspace = true;

        ele.addEventListener("click", () => {
            if (context.focused_block !== ele) {
                focus_block_in_workspace(ele);
            } else {
                on_open_tab(context.current_tab);
            }
        });

        ele.addEventListener("contextmenu", () => {
            remove_block_by_uid(blockData.uid);
            ele.remove();
        });

        ele.classList.add("unselectable");

        workspace_blocks_div.appendChild(ele);
    });
};

const generate_uid = () => crypto.randomUUID();

// SETTINGS
const hide_settings = () => {
    workspace_settings_div.style.display = "none";
}; const show_settings = () => {
    workspace_settings_div.style.display = "block";
};

// EXPORTING
const get_save = async () => {
    let s = JSON.stringify(save);

    const byteArray = new TextEncoder().encode(s);
    const stream = new Blob([byteArray]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const compressedBuffer = await new Response(compressedStream).arrayBuffer();

    return btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)));
}; const display_save = async () => {
    let s = await get_save();
    await navigator.clipboard.writeText(s);
    alert("copied to clipboard!");
}; const update_save_from_encoded = async (data) => {
    const binary = Uint8Array.from(atob(data), c => c.charCodeAt(0));

    const stream = new Blob([binary]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();

    const json = new TextDecoder().decode(decompressedBuffer);
    save = JSON.parse(json);

    rebuild_workspace_from_save();
};
document.getElementById("rm_titlebar_button4").addEventListener("click", async () => {
    await display_save();
}); document.getElementById("rm_titlebar_button4").addEventListener("contextmenu", async () => {
    
    try {
        await update_save_from_encoded(await navigator.clipboard.readText());
        alert("imported save!")
    } catch {
        alert("invalid save")
    }
});

const change_window_title = (title) => {
    context.window_title = title;
    window_title_text.textContent = title;
}; 
const change_focused_tab = (tab) => {
    document.getElementById(`rm_titlebar_button${context.current_tab}`).classList.remove("focused-titlebar-button");
    context.current_tab = tab;
    document.getElementById(`rm_titlebar_button${tab}`).classList.add("focused-titlebar-button")
    on_open_tab(tab);
}; for(let x = 0; x <= 3; x++) { document.getElementById(`rm_titlebar_button${x}`).addEventListener("click", () => { change_focused_tab(x); }) }

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
}); document.addEventListener("click", (e) => {
})

change_window_title('"game title" editor') // temporary