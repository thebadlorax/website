/**
 * author thebadlorax
 * created on 24-02-2026-17h-11m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { Database } from "./db";
import { LogWizard } from "./logging";

type message = {
    type: string;
    content: string;
    timestamp: number;
}
  
const formatMessage = (message: message) => JSON.stringify({"type": message.type, "content": message.content, "timestamp": message.timestamp})

export class ChatInstance {
    private db: Database
    private log: LogWizard
    constructor(db: Database) {
        this.db = db;
        this.log = new LogWizard();
    }

    async init() {
        try {
            JSON.parse(await this.db.fetch("chat"))["history"]
        } catch (error) { // no history in db
            await this.db.modify("chat", JSON.stringify({"history": [`{"type": "message", "content": "Welcome to chat!", "timestamp": "${Date.now()}"}`]}))
        }
    }

    // TODO: make the triple escape bug in the db go away its inflating the size of it
    async appendMessageToHistory(message: message) {
        let data = JSON.parse(await this.db.fetch("chat"));
        let messages = data["history"];
        messages.push(formatMessage(message))
        this.log.log(`${message.content}`, "CHAT")
        data.history = messages;
        await this.db.modify("chat", JSON.stringify(data));
    }
      
    async fetchMessagesFromHistory(amt: number, con_msgs: (string | boolean)) {
        let data = JSON.parse(await this.db.fetch("chat"));
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
}