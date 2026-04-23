/**
 * author thebadlorax
 * created on 23-04-2026-14h-05m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

// TABS: [0|1|2|3         4] (ui)

let context = {
    "is_open": false,
    "window_title": "",
    "current_tab": 0
}

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
}; 

const change_window_title = (title) => {
    context.window_title = title;
    window_title_text.textContent = title;
}; 
const change_focused_tab = (tab) => {
    document.getElementById(`rm_titlebar_button${context.current_tab}`).classList.remove("focused-titlebar-button");
    context.current_tab = tab;
    document.getElementById(`rm_titlebar_button${tab}`).classList.add("focused-titlebar-button")
}; for(let x = 0; x <= 4; x++) { document.getElementById(`rm_titlebar_button${x}`).addEventListener("click", () => { change_focused_tab(x); }) }



const ruleset_div = document.getElementById("ruleset-maker");
const exit_button = document.getElementById("rm_exit_button");
const window_title_text = document.getElementById("rm_title_text")
exit_button.addEventListener("click", () => {
    on_close_ruleset_div();
}); document.addEventListener("keydown", (e) => { // temporary
    if(e.key == "Escape") {
        if(context.is_open) on_close_ruleset_div();
        else on_open_ruleset_div();
    }
});

const save_button = document.getElementById("rm_save_button");

change_window_title("editor") // temporary