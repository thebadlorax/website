/**
 * author thebadlorax
 * created on 24-02-2026-16h-49m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import type { Database } from "./db";
import { LogWizard } from "./logging";
import { generateRandomString, clamp } from "./utils";

type Account = {
    name: string;
    pass: string;
    id: string;
}

type UserSettings = {
    display_name: string;
    color: string;
}

type Statistics = {
    cTime: number;
    uniquesOnCreation: number;
    points: number;
}

export type User = {
    account: Account;
    statistics: Statistics;
    settings: UserSettings;
}

export const userToJSON = (user: User) => {
    return JSON.stringify({
        "account": {
            "name": user.account.name,
            "pass": user.account.pass,
            "id": user.account.id
        },
        "settings": {
            "display_name": user.settings.display_name,
            "color": user.settings.color
        },
        "statistics": {
            "points": user.statistics.points,
            "cTime": user.statistics.cTime,
            "uniquesOnCreation": user.statistics.uniquesOnCreation
        }
        
    });
};

export const JSONToUser = (json: any) => {
    let newUser: User = {
        account: {
            name: json.account.name,
            pass: json.account.pass,
            id: json.account.id
        },
        settings: {
            display_name: json.settings.display_name,
            color: json.settings.color
        },
        statistics: {
            points: json.statistics.points,
            cTime: json.statistics.cTime,
            uniquesOnCreation: json.statistics.uniquesOnCreation
        }
        
    }
    return newUser
}

const generateUser = (name: string, pass: string, uniques: number) => {
    let user: User = {
        account: {
            name: name,
            pass: pass,
            id: generateRandomString(15)
        },
        settings: {
            display_name: name,
            color: "#000000"
        },
        statistics: {
            points: 100,
            cTime: Date.now(),
            uniquesOnCreation: uniques
        }
        
    }
    return user
}

export class AuthorizationWizard {
    protected db: Database
    protected log: LogWizard

    constructor(db: Database) {
        this.db = db;
        this.log = new LogWizard();
    }

    async init() {
        let admin_user: User = generateUser("admin", "admin", parseInt(await this.db.fetch("visitors")) || 0)
        if(!await this.db.exists("auth")) await this.db.modify("auth", JSON.stringify({"users": {"admin": userToJSON(admin_user)}}))
        this.log.log("Initialized", "AUTHWIZARD");
    }

    async createAccount(name: string, pass: string) {
        if(await this.exists(name)) return undefined;
        let user: User = generateUser(name, pass, parseInt(await this.db.fetch("visitors")) || 0)
        let json = await this._getAccounts();
        json[name] = userToJSON(user);
        this.log.log(`Creating new account "${name}"`, "AUTHWIZARD")
        await this.db.modify("auth", JSON.stringify({"users": json}));
        return user;
    }

    async _getAccounts() {
        let json = await this.db.fetch("auth");
        json = JSON.parse(json);
        let accounts = json["users"];
        return accounts
    }

    async fetchAccount(name: string, pass: string) {
        if(!this.exists(name)) return undefined;
        let accounts = await this._getAccounts();
        let user; try { user = JSONToUser(JSON.parse(accounts[name])); }
        catch { return undefined };
        if(user.account.pass == pass) return user; // this.checkPass would be better but it would bloat :(
    }

    async checkPass(name: string, pass: string) {
        if(!this.exists(name)) return undefined;
        let accounts = await this._getAccounts();
        let user = JSONToUser(JSON.parse(accounts[name]));
        if(user.account.pass == pass) return true;
        else return false;
    }

    async exists(name: string) {
        let accounts = await this._getAccounts();
        if(!accounts[name]) return false; else return true;
    }

    async _confirmAccessAndExistance(name: string, pass: string) {
        if(!await this.exists(name)) return false;
        if(!this.checkPass(name, pass)) return false;
        return true;
    }

    async updateAccount(name: string, pass: string, updated: User) {
        if(!await this._confirmAccessAndExistance(name, pass)) return undefined;
        let json = await this._getAccounts();
        if(updated.account.name !== name) {
            await this.renameAccount(name, pass, updated.account.name);
        }
        let old = await this.fetchAccount(name, pass);
        if(!old) return undefined;
        old.account.name = updated.account.name;
        old.account.pass = updated.account.pass;
        old.settings.display_name = updated.settings.display_name;
        old.settings.color = updated.settings.color;
        json[updated.account.name] = userToJSON(old);
        await this.db.modify("auth", JSON.stringify({"users": json}));
        return updated;
    }

    async changePoints(name: string, pass: string, amt: number) {
        if(!await this._confirmAccessAndExistance(name, pass)) return undefined;
        let json = await this._getAccounts();
        let user = await this.fetchAccount(name, pass);
        if(!user) return undefined;
        user.statistics.points += amt;
        if(user.statistics.points < 0) user.statistics.points = 0;
        let JSON_user = userToJSON(user);
        json[name] = JSON_user
        await this.db.modify("auth", JSON.stringify({"users": json}));
    }

    async deleteAccount(name: string, pass: string) {
        if(!await this._confirmAccessAndExistance(name, pass)) return undefined;
        this.log.log(`Deleting Account "${name}"`, "AUTHWIZARD")
        let json = await this._getAccounts();
        delete json[name];
        await this.db.modify("auth", JSON.stringify({"users": json}));
    }

    async renameAccount(name: string, pass: string, newName: string) {
        if(!await this._confirmAccessAndExistance(name, pass)) return undefined;
        let json = await this._getAccounts();
        let acc = await this.fetchAccount(name, pass);

        if(!acc) return undefined;
        acc.account.name = newName;
        json[newName] = JSON.parse(userToJSON(acc));
        this.log.log(`Renaming Account "${name}" to "${newName}"`, "AUTHWIZARD")
        await this.db.modify("auth", JSON.stringify({"users": json}));
        setTimeout(async () => {await this.deleteAccount(name, pass);}, 250);
    }
}