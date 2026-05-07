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
        LEFT_ARROW: 37, A_KEY: 65,
        RIGHT_ARROW: 39, D_KEY: 68,
        UP_ARROW: 38, W_KEY: 87,
        DOWN_ARROW: 40, S_KEY: 83,
        ESCAPE: 27, G_KEY: 71
    };
    constructor() {};

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
        var keyCode = event.keyCode;
        if (keyCode in this._keys) {
            event.preventDefault();
            this._keys[keyCode] = true;
            if(this._key_functions[keyCode] != undefined) this._key_functions[keyCode]();
        }
    };

    _onKeyUp(event) {
        var keyCode = event.keyCode;
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