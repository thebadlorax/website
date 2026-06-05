/**
 * author thebadlorax
 * created on 05-06-2026-11h-21m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

class ConnectionContext {
    static defaultPacketConfig = {
        "seperator": ";"
    }
    constructor(packetConfig) {
        this.pConfig = packetConfig;
    }
}

export class Packet {
    static fromFormatted(str, context) {
        let a = atob(str);
        a = a.split(context.pConfig.seperator);
        return new Packet(
            a[0],
            JSON.parse(a[1]),
            context
        );
    }
    
    constructor(type, data, context) {
        this.type = type;
        this.data = data;
        this.context = context;
    }

    getFormatted() {
        return btoa(`${this.type}${this.context.pConfig.seperator}${JSON.stringify(this.data)}`);
    }
}

export class SinglePlayerServerConnection {
    constructor(engine) {
        this.engine = engine;
        this.ws = null;
        this.context = new ConnectionContext(ConnectionContext.defaultPacketConfig);
    }

    newPacket(type, data) {
        return new Packet(type, data, this.context)
    }

    onopen() {
        const user = JSON.parse(window.localStorage.getItem("user"));
        this.send(this.newPacket("register", {"name": user.account.name, "pass": user.account.pass}))
    }
    onclose() {}

    start() {
        this.ws = new WebSocket(location.host.includes("66.65.25.15") ? 
        `${location.protocol}//${location.host}/subdomain=api/game/live` : 
        `${location.protocol}//api.${location.host}/game/live`);

        this.ws.addEventListener("open", () => { this.onopen(); });
        this.ws.addEventListener("close", () => { this.onclose(); });
        this.ws.addEventListener("message", (m) => { this._onrecieve(m.data); });
    }
    _onrecieve(message) {
        const packet = Packet.fromFormatted(message, this.context);
        if(packet.data.reason != undefined) {
            console.log(`error: ${packet.data}`)
        };
        if(this.engine.settings.settings.lp) {
            console.log(`Recieved packet: \ntype:${packet.type}\ndata:${JSON.stringify(packet.data)}`);
        }
    }
    send(packet) { this.ws.send(packet.getFormatted()); }

}