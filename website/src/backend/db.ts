/**
 * author thebadlorax
 * created on 24-02-2026-16h-49m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { LogWizard } from "./logging";
import { writeFileSync } from "fs";

export class Database {
    public path: string
    private log: LogWizard
    private lock: Promise<void> = Promise.resolve();

    constructor(path: string) {
        this.path = path;
        this.log = new LogWizard();
    }

    private async withLock(fn: () => Promise<void>) {
        const previousLock = this.lock;
        let release: () => void;
        this.lock = new Promise<void>((resolve) => (release = resolve!));

        await previousLock; // wait for previous operation
        try {
            await fn();
        } finally {
            release!();
        }
    }

    async init() {
        if(!await Bun.file(this.path).exists()) await Bun.file(this.path).write(`{}`);
        this.log.log("Initialized", "DATABASE")
    }

    async modify(element: string, data: Record<any, any>) {
        await this.withLock(async () => {
            try {
                const file = Bun.file(this.path);
                if (!(await file.exists())) await file.write(`{"nothing":"wow"}`);
                const json = await file.json();

                json[element] = data;

                // @ts-expect-error
                await Bun.write(file, JSON.stringify(json), { atomic: true });
            } catch (error) {
                this.log.error(`Error modifying ${element}: ${error}`, "DATABASE", "MODIFICATION");
            }
        });
    }

    async fetch(element: string) {
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
}