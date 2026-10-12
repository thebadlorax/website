/**
 * author thebadlorax
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { AuthorizationWizard } from "./auth";
import { Database } from "./db";

type Poll = {
    title: string,
    author: string,
    end: number,
    id: string,
    values: Array<number>
}; const serializePoll = (poll: Poll) => {return {
    "title": poll.title,
    "author": poll.author,
    "end": poll.end,
    "id": poll.id,
    "values": poll.values
}};

class PollWizard {
    protected auth: AuthorizationWizard;
    protected db: Database;

    constructor(db: Database) {
        this.db = db;
        this.auth = new AuthorizationWizard(db);
    }

    
}