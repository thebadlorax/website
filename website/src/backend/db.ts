/**
 * author thebadlorax
 * created on 24-02-2026-16h-49m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { LogWizard } from "./logging";
import { isValidJSON } from "./utils";

export class Database {
    public path: string
    private log: LogWizard

    constructor(path: string) {
        this.path = path;
        this.log = new LogWizard();
    }

    async init() {
        if(!await Bun.file(this.path).exists()) await Bun.file(this.path).write(`{"nothing":"wow"}`);
        this.log.log("Initialized", "DATABASE")
    }

    async modify(element: string, data: string) {
        try {
            const file = Bun.file(this.path)
            if(!await file.exists()) await file.write(`{"nothing":"wow"}`)
            const json = await file.json();

            json[element] = data
        
            if(data == "") {
              delete json[element]
            }
        
            
        
            await Bun.write(file, (isValidJSON(json) ? json : JSON.stringify(json)));
          } catch (error) {
            this.log.error(`Error modifiying ${element}: ${error}`, "DATABASE", "MODIFICATION");
          }
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
                    return undefined; // Path not found
                }
            }
            return json
        } catch (error) {
            this.log.error(`Error fetching element ${element}`, "DATABASE", "FETCHING")
        }
    }

    async exists(element: string) { return await this.fetch(element) != undefined; }
}