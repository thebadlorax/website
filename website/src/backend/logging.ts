/**
 * author thebadlorax
 * created on 24-02-2026-16h-52m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { appendFile } from "node:fs/promises";
import { createDirectory, createFile } from "./file";

export class LogWizard {
    public logDir: string
    private logFileName: string
    constructor(logDir: string = "logs") {
        this.logDir = logDir;
        this.logFileName = `${this.logDir}/${new Date().toLocaleDateString().replaceAll("/", "_")}.log`
    }
    async init() {
        await createDirectory(this.logDir);
        await createFile(this.logFileName, `LOG GENERATED ON ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}\n\n`);
        await this._appToLog("------ STARTING ------")
        this.log("Initialized", "LOGWIZARD");
    }
    protected async _appToLog(msg: string) { appendFile(this.logFileName, `${msg}\n`)}
    protected _log(msg: string) { let formatted = `${this._time()} - ${msg}`; console.log(formatted); this._appToLog(formatted)}
    protected _time() { return `${new Date().toLocaleTimeString()}`}
    log(msg: string, source: string = "LOG") { this._log(`[${source}]: ${msg}`)}
    error(msg: string, source: string = "ERROR", reason: string = "UNSPECIFIED") { this._log(`---${reason} ERROR---\n[${source}]: ${msg}`)}
}