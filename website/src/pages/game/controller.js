/**
 * author thebadlorax
 * created on 06-05-2026-10h-52m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { setValueInStorage } from "./browser.js";
import { EngineSettings } from "./engine.js";

export class Keyboard {
    _keys = {};
    _key_functions = {};
    mouseX = 0; mouseY = 0;
    constructor() {
        document.addEventListener("mousemove", e => {
            this.mouseX = e.clientX; this.mouseY = e.clientY;
        })
        window.addEventListener('keydown', this._onKeyDown.bind(this));
        window.addEventListener('keyup', this._onKeyUp.bind(this));
        this.waiting = false;
    };

    listenForEvents(keys) {
        keys.forEach(function (key) {
            this._keys[key] = false;
        }.bind(this));
    };

    setFunctionOnKeyPress(key, fn) {
        this._key_functions[key] = fn;
    }

    _onKeyDown(event) {
        var keyCode = event.code;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = true;
            if(this._key_functions[keyCode] != undefined) this._key_functions[keyCode]();
        }
    };

    _onKeyUp(event) {
        var keyCode = event.code;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = false;
        }
    };

    isDown(keyCode) {
        if (!keyCode in this._keys) {
            throw new Error('Keycode ' + keyCode + ' is not being listened to');
        }
        return this._keys[keyCode];
    }

    waitForKeyPress() {
        const toggle = () => {
            this.waiting = false;
        }
        this.waiting = true;
        return new Promise(resolve => {
            function handler(event) {
                window.removeEventListener("keydown", handler);
                toggle();
                resolve(event);
            }
    
            window.addEventListener("keydown", handler);
        });
    }
}

export class Keybinds {
    static DEFAULT_KEYBINDS = [
        {
            "id": "walkLeft",
            "name": "Walk Left",
            "bind":{
                "name": "a",
                "code": "KeyA"
            }
        },
        {
            "id": "walkRight",
            "name": "Walk Right",
            "bind": {
                "name": "d",
                "code": "KeyD"
            }
        },
        {
            "id": "walkUp",
            "name": "Walk Up",
            "bind": {
                "name": "w",
                "code": "KeyW"
            }
        },
        {
            "id": "walkDown",
            "name": "Walk Down",
            "bind": {
                "name": "s",
                "code": "KeyS"
            }
        },
        {
            "id": "sprint",
            "name": "Sprint",
            "bind": {
                "name": "Shift",
                "code": "ShiftLeft"
            }
        },
        {
            "id": "active1",
            "name": "Active 1",
            "bind": {
                "name": "Shift",
                "code": "ShiftLeft"
            }
        },
        {
            "id": "active2",
            "name": "Active 2",
            "bind": {
                "name": "Tab",
                "code": "Tab"
            }
        },
        {
            "id": "active3",
            "name": "Active 3",
            "bind": {
                "name": "Space",
                "code": "Space"
            }
        },
        {
            "id": "activateLevelEditor",
            "name": "Activate Level Editor",
            "bind": {
                "name": "m",
                "code": "KeyM"
            }
        },
        {
            "id": "showGrid",
            "name": "Show Tile Grid",
            "bind": {
                "name": "g",
                "code": "KeyG"
            }
        },
    ];

    constructor(data, settings) {
        this.binds = data
        if(Object.keys(data) <= 0) {
            this.binds = Keybinds.DEFAULT_KEYBINDS
        }
        this.settings = settings;
    }

    async reset() {
        this.binds = Keybinds.DEFAULT_KEYBINDS;
        this.settings.settings.binds = this.binds;
        await this.settings.updateStorage();
    }

    getBind(id) {
        return this.binds.find(b => b.id == id);
    }

    async updateBind(id, name, code) {
        this.binds[this.binds.indexOf(this.binds.find(b => b.id == id))].bind = {
            "name": name,
            "code": code
        };
        this.settings.settings.binds = this.binds;
        await this.settings.updateStorage();
    }
}