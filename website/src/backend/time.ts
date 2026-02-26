/**
 * author thebadlorax
 * created on 26-02-2026-10h-06m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { LogWizard } from "./logging";

export class TimeWizard {
    public startTime: number
    protected log: LogWizard
    constructor() {
        this.startTime = Date.now();
        this.log = new LogWizard();
        this.log.log("Initialized", "TIMEWIZARD")
    }

    time<Args extends unknown[], Return>( // cooked bc function params in ts are fried
        fn: (...args: Args) => Return | Promise<Return>
      ) {
        return async (...args: Args): Promise<Return> => {
          const start = performance.now();
      
          const result = await fn(...args);
      
          const end = performance.now();
          this.log.log(`Function "${fn.name}" took ${end - start}ms to execute`, "TIMEWIZARD");
      
          return result;
        };
    }

    timer() { return new TimeWizard.timer(this.log); }

    protected static timer = class {
        private startTime;
        private endTime;
        private log: LogWizard;

        constructor(log: LogWizard) {
            this.log = log;
            this.startTime = performance.now();
            this.endTime = 0;
            this.log.log("Timer started", "TIMEWIZARD")
        }

        end() { 
            this.endTime = performance.now();
            let final = this.endTime-this.startTime;
            this.log.log(`Timer finished in ${final}ms`, "TIMEWIZARD")
            return final;
        }
    }
}