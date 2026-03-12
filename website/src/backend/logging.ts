/**
 * author thebadlorax
 * created on 24-02-2026-16h-52m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { appendFile } from "node:fs/promises";
import { createDirectory, createFile } from "./file";

// TODO: make duplicate lines stack ex; (2) 11:33:49 PM - etc.
export class LogWizard {
    public logDir: string;
    private logFileName: string = "";
    private logTime: string = "";
    constructor(logDir: string = "logs") {
        this.logDir = logDir;
        this.logTime = this._date();
        this.logFileName = `${this.logDir}/${this.logTime}.log`;
    }
    async init() {
        await createDirectory(this.logDir);
        await createFile(this.logFileName, `LOG GENERATED ON ${this.logTime} - ${this._time()}\n\n`); // only works when no file found
        await this._appToLog("------ STARTING ------")
        this.log("Initialized", "LOGWIZARD")
    }
    protected async refreshLog() {
        this.logTime = this._date();
        this.logFileName = `${this.logDir}/${this.logTime}.log`;
        await createFile(this.logFileName, `LOG GENERATED ON ${this.logTime} - ${this._time()}\n\n------ DAY CHANGE -----\n`);
    }
    protected async _appToLog(msg: string) { 
        if(this.logTime !== this._date()) {await this.refreshLog(); this.log("Creating new log file for the day", "LOGWIZARD"); }
        appendFile(this.logFileName, `${msg}\n`);
    }
    protected _log(msg: string) { let formatted = `${this._time()} - ${msg}`; console.log(formatted); this._appToLog(formatted)}
    protected _time() { return `${new Date().toLocaleTimeString()}`}
    protected _date() { return `${new Date().toLocaleDateString().replaceAll("/", "_")}`}
    log(msg: string, source: string = "LOG") { this._log(`${source !== "N/A" ?  `[${source}]: ` : ""}${msg}`)}
    error(msg: string, source: string = "ERROR", reason: string = "UNSPECIFIED") { this.log(`---${reason} ERROR---\n${this._time()} - [${source}]: ${msg}\n${this._time()} - ---END ERROR---`, "N/A")}
}