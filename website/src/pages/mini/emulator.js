/**
 * author thebadlorax
 * created on 19-06-2026-21h-39m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

async function launchGame(core, file) {
    menu.style.display = "none";
    emulator.style.display = "flex";

    window.EJS_player = "#game";
    window.EJS_biosUrl = "";
    window.EJS_core = core;
    window.EJS_gameUrl = file;
    window.EJS_lightgun = false;

    // load loader.js exactly once
    if (!window.EJS_loaded) {
        window.EJS_loaded = true;

        const s = document.createElement("script");

        s.src = "https://www.emulatorjs.com/loader.js";

        document.body.appendChild(s);

        await new Promise(resolve => {
            s.onload = resolve;
        });
    }

    EJS_start();
}

pkmnfr.onclick = () => {
    launchGame("gba", "/res/mini/roms/pokemon.gba");
};

smb.onclick = () => {
    launchGame("nes", "/res/mini/roms/smb.nes");
};