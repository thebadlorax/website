/**
 * author thebadlorax
 * created on 24-02-2026-17h-11m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Database } from "./db";
import { LogWizard } from "./logging";
import { generateRandomString } from "./utils";
import { type User } from "./auth"
import type { ServerWebSocket } from "bun";

type message = {
    type: string;
    content: string;
    timestamp: number;
}
  
const formatMessage = (message: message) => JSON.stringify({"type": message.type, "content": message.content, "timestamp": message.timestamp})

// TODO: move all of chatting to a chat instance to work towards instance creation w/ accounts (dms)
// TODO: sanitize color values because rn it can be whatever
/* TODO: allow images or gifs hosted from my website to be embedded:
 * to that end, should probably also refactor the way messages work
 * so that each message can take a huge amount of space / have a better
 * way to display user & time 
 */

// TODO: if 2 ppl send at the same ms it crashes the server
export class ChatInstance {
    protected db: Database
    protected log: LogWizard = new LogWizard();
    public id: string = generateRandomString(10)
    protected assignees: Array<User> = new Array();
    protected private: boolean = false;
    protected users: Map<ServerWebSocket<{ source: string }>, User> = new Map();

    constructor(db: Database) { this.db = db; }

    async init() {
        try {
            JSON.parse(await this.db.fetch("chat"))["history"]
        } catch (error) { // no history in db
            await this.db.modify("chat", JSON.stringify({"history": [`{"type": "message", "content": "Welcome to chat!", "timestamp": "${Date.now()}"}`]}))
        }
    }

    // TODO: make the triple escape bug in the db go away its inflating the size of the db
    async appendMessageToHistory(message: message, isPrivate: boolean = false) {
        let data;
        try { data = JSON.parse(await this.db.fetch("chat")); }
        catch { return; }
        let messages = data["history"];
        messages.push(formatMessage(message))
        this.log.log(`${message.content}`, "CHAT")
        data.history = messages;
        await this.db.modify("chat", JSON.stringify(data));
    }

    async addUserToChat(user: User) {
        this.assignees.push(user);
    }
      
    async fetchMessagesFromHistory(amt: number, con_msgs: (string | boolean)) {
        let data;
        try { data = JSON.parse(await this.db.fetch("chat")); }
        catch { return; }
        let messages: Array<string> = data["history"];
        con_msgs = (con_msgs === "true")
        if(!con_msgs) {
          messages = messages
          .map(item => JSON.parse(item))
          .filter(item => item.type !== "connection")
          .map(item => JSON.stringify(item));
        }
        if(amt != -1) messages = messages.slice(-amt);
        let new_messages = new Array();
        for(let x = 0; x < messages.length; x++) {
          let parsed = JSON.parse(messages[x]!);
          let new_message: message = {
            type: parsed.type,
            content: parsed.content,
            timestamp: parsed.timestamp
          };
          new_messages.push(new_message);
        }
        return new_messages
    }

    async handleRecieved(msg: string) {
        
    }
}