/**
 * author thebadlorax
 * created on 24-02-2026-16h-49m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { LogWizard } from "./logging";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createGzip, createGunzip } from "zlib";
import { rename } from "node:fs/promises";

export class Database {
    static defaultPath = "database.json"
    public path: string
    private log: LogWizard
    public last_backup_time: number = 0;
    private cached: any = {};
    private dirty = false;
    private updateInterval = 250;

    constructor(path: string) {
        this.path = path;
        this.log = new LogWizard();
    }

    async updateLoop() {
        if(!this.dirty) return;
        try {
            const file = Bun.file(this.path);
            if (!(await file.exists())) await file.write(`{"nothing":"wow"}`);
            // @ts-expect-error
            await Bun.write(file, JSON.stringify(this.cached), { atomic: true });
            this.dirty = false;
        } catch {
            this.log.error(`Error modifying database`, "DATABASE", "MODIFICATION");
        }
        
    }

    async init() {
        if(!await Bun.file(this.path).exists()) await Bun.file(this.path).write(`{}`);
        this.cached = await Bun.file(this.path).json();
        setInterval(this.updateLoop.bind(this), this.updateInterval);
        this.log.log("Initialized", "DATABASE");
    }

    modify(element: string, data: Record<any, any>) { this.cached[element] = data; this.dirty = true; }

    async fetch(element: string) {
        if(this.cached[element] != undefined) return this.cached[element];
        try {
            const file = Bun.file(this.path)
            let json = await file.json();
            let layers = new Array();
            element.split(".").forEach(e => {
                layers.push(e)
            });
        
            for(let i = 0; i < layers.length; i++) {
                if (json && typeof json === 'object' && layers[i] in json) {
                json = json[layers[i]];
                } else {
                    return undefined;
                }
            }
            return json
        } catch (error) {
            this.log.error(`Error fetching element ${element}`, "DATABASE", "FETCHING")
        }
    }

    async exists(element: string) { return await this.fetch(element) != undefined; }

    backup_database = async () => {
        this.log.log("moving old database backup", "DATABASE")
        try { await rename(`${this.path}.bk.gz`, `${this.path}.old.bk.gz`) }
        catch { this.log.log("no old database backup", "DATABASE")}
        this.log.log("starting database backup", "DATABASE")
        
        await pipeline(
            createReadStream(this.path),
            createGzip(),
            createWriteStream(`${this.path}.bk.gz`)
        );
        
        this.log.log("finished backing up database", "DATABASE")
        this.last_backup_time = Date.now();
    }
    recreate_backup_database = async () => {
        this.log.log("restoring database from backup", "DATABASE");
        
        const tempPath = `${this.path}.tmp`;
        
        await pipeline(
            createReadStream(`${this.path}.bk.gz`),
            createGunzip(),
            createWriteStream(tempPath)
        );
        
        await rename(tempPath, this.path);
        
        this.log.log("db restoration complete", "DATABASE");
        await this.backup_database();
    };
}