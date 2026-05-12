/**
 * author thebadlorax
 * created on 06-05-2026-10h-52m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

export class Keyboard {
    _keys = {};
    _key_functions = {};
    KEYCODES = {
        LEFT_ARROW: "ArrowLeft",
        RIGHT_ARROW: "ArrowRight",
        UP_ARROW: "ArrowUp",
        DOWN_ARROW: "ArrowDown",
        A_KEY: "KeyA",
        D_KEY: "KeyD",
        W_KEY: "KeyW",
        S_KEY: "KeyS",

        C_KEY: "KeyC",
        G_KEY: "KeyG",

        ESCAPE: "Escape",
        SHIFT: "ShiftLeft",
        TAB: "Tab",
        SPACE: "Space",
        META: "MetaLeft"
    };
    mouseX = 0; mouseY = 0;
    constructor() {
        document.addEventListener("mousemove", e => {
            this.mouseX = e.clientX; this.mouseY = e.clientY;
        })
    };

    listenForEvents(keys) {
        window.addEventListener('keydown', this._onKeyDown.bind(this));
        window.addEventListener('keyup', this._onKeyUp.bind(this));
    
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
}