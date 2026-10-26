/**
 * author thebadlorax
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { AuthorizationWizard } from "./auth";
import { Database } from "./db";
import { LogWizard } from "./logging";
import { generateRandomString, sumNumArray } from "./utils";

export type Vote = {
    voter: string,
    weight: number
}

type Poll = {
    title: string,
    author: string,
    end: number,
    start: number,
    votes: Array<Array<Vote>>,
    id: string,
    labels: Array<string>
};

export class PollWizard {
    protected auth: AuthorizationWizard;
    protected db: Database;
    protected log: LogWizard;

    public polls: Array<Poll> = new Array();

    constructor(db: Database) {
        this.db = db;
        this.auth = new AuthorizationWizard(db);
        this.log = new LogWizard();
    }

    async init(): Promise<void> {
        await this.refreshFromDB();

        setInterval(async () => {
            await this.updateDB()
        }, 5000);
    }

    getPollsByID(id: string): Poll[] { return this.polls.filter(p => p.author == id) }
    createPoll(poll: Poll): void { 
        this.polls.push(poll); 
        this.log.log("creating new poll", "POLLWIZARD"); 
    }
    async updateDB(): Promise<void> {
        this.db.modify("polls", {
            "objects": this.polls
        })
    }
    async refreshFromDB(): Promise<void> {
        const db_obj = await this.db.fetch("polls") ?? { "objects": [] };
        const data = db_obj.objects;
        this.polls = data;
    }

    static getRemainingTime(poll: Poll): number | null { 
        const n = Date.now();
        const d = n-poll.end;
        return d*-1;
    };

    static sumVotes(poll: Poll): Array<number> { return poll.votes.map(option => sumNumArray(option!.map(v => v.weight))) };

    async serializePoll(poll: Poll): Promise<any> {const u = await this.auth._adminIdToUser(poll.author); return {
        "title": poll.title,
        "author": {
            "id": poll.author,
            "display": {
                "name": u?.settings.display_name,
                "color": u?.settings.color
            }
        },
        "timeLeft": PollWizard.getRemainingTime(poll),
        "votes": PollWizard.sumVotes(poll),
        "id": poll.id,
        "labels": poll.labels
    }};

    async getVoterVoteOnPoll(poll: Poll, user: string) {
        let a = null
        poll.votes.forEach((opt, i) => {
            const vmap = opt.map(v => v.voter);
            const v = vmap.find(v => v == user);
            if(v) a = i
        });
        return a;
    }

    static pollFromClient(title: string, author: string, length: number, labels: Array<string>): Poll {
        const n = Date.now()
        const p = {
            title: title,
            author: author,
            end: n+length,
            start: n,
            votes: new Array(),
            id: generateRandomString(5),
            labels: labels
        } as Poll;

        for(let x = 0; x < labels.length; x++) p.votes.push(new Array());

        return p;
    };

    voteOnPoll(id: string, vote: Vote, option: number): boolean {
        const poll = this.polls.find(p => p.id == id);
        if(!poll) return false;

        if(poll.votes[option] == null) return false

        poll.votes.forEach(opt => {
            const vmap = opt.map(v => v.voter);
            const v = vmap.find(v => v == vote.voter);
            if(v) opt.splice(vmap.indexOf(v), 1);
        }) // remove other votes
        poll.votes[option].push(vote);

        return true;
    }
}