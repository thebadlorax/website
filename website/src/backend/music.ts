/**
 * author thebadlorax
 * created on 02-07-2026-21h-40m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { AuthorizationWizard } from "./auth";
import type { Database } from "./db";

type Playlist = {
    songs: Array<any>,
    name: string
}

export class MusicWizard {
    static youtubeToAudio(url: string) {
        const proc = Bun.spawn([
            "yt-dlp",
            "-f", "bestaudio",
            "-o", "-",
            url
        ], {
            stdout: "pipe",
            stderr: "pipe",
        });
    
        proc.exited.then(async code => {
            if (code !== 0)
                console.error(await new Response(proc.stderr).text());
        });
    
        return proc.stdout;
    }
    static youtubeToMp3(url: string) {
        const proc = Bun.spawn([
            "sh",
            "-c",
            `yt-dlp -f bestaudio -o - "$1" | ffmpeg -i pipe:0 -vn -f mp3 -codec:a libmp3lame -b:a 192k pipe:1`,
            "sh",
            url,
        ], {
            stdout: "pipe",
            stderr: "pipe",
        });
    
        proc.exited.then(async code => {
            if (code !== 0)
                console.error(await new Response(proc.stderr).text());
        });
    
        return proc.stdout;
    }
    static getYouTubeId(url: string) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        // @ts-expect-error
        return (match && match[2].length === 11) ? match[2] : null;
    }
    static async urlToData(url: string) {
        try {
            const videoId = MusicWizard.getYouTubeId(url);
            if (!videoId) return null;
    
            const response = await fetch(
                `https://www.youtube.com/oembed?url=${encodeURIComponent(
                    `https://www.youtube.com/watch?v=${videoId}`
                )}&format=json`
            );
    
            if (!response.ok) {
                return null;
            }
    
            const data = await response.json();
    
            return {
                "title": data.title,
                "author": {
                    "name": data.author_name,
                    "url": data.author_url
                },
                "thumbnail": {
                    "height": data.thumbnail_height,
                    "width": data.thumbnail_width,
                    "url": data.thumbnail_url
                }
            }
        } catch (err) {
            console.error(err);
            return null;
        }
    }
    static async urlToTitle(url: string) {
        try {
            const videoId = MusicWizard.getYouTubeId(url);
            if (!videoId) return null;
    
            const response = await fetch(
                `https://www.youtube.com/oembed?url=${encodeURIComponent(
                    `https://www.youtube.com/watch?v=${videoId}`
                )}&format=json`
            );
    
            if (!response.ok) {
                return null;
            }
    
            const data = await response.json();
    
            return data.title;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    static serializePlaylist(playlist: Playlist) {
        return {
            "songs": JSON.stringify(playlist.songs),
            "name": playlist.name
        }
    }
    static deserializePlaylist(playlist: any) {
        return {
            songs: playlist.songs,
            name: playlist.name
        } as Playlist
    }

    protected auth: AuthorizationWizard;
    protected db: Database;

    constructor(db: Database) {
        this.db = db;
        this.auth = new AuthorizationWizard(db);
    }

    protected async getUserData(name: string) {
        return await this.auth.fetchUserData(name, "music");
    }

    async getPlaylists(name: string) {
        const ud = await this.getUserData(name);
        if(ud.playlists == undefined) ud.playlists = {};
        return ud.playlists;
    }
    async createPlaylist(name: string, pass: string, pname: string) {
        const ud = await this.getUserData(name);
        if(ud.playlists == undefined) ud.playlists = {};
        if(Object.keys(ud.playlists).includes(pname)) return null;
        let p = {
            songs: [],
            name: pname
        } as Playlist
        ud.playlists[pname] = p;
        await this.auth.setUserData(name, pass, "music", ud);
        return p;
    }
    async updatePlaylist(name: string, pass: string, pname: string, playlist: Playlist) {
        const ud = await this.getUserData(name);
        if(ud.playlists == undefined) ud.playlists = {};
        ud.playlists[pname] = playlist;
        await this.auth.setUserData(name, pass, "music", ud);
    }
    async deletePlaylist(name: string, pass: string, pname: string) {
        const ud = await this.getUserData(name);
        if(ud.playlists == undefined) return;
        delete ud.playlists[pname];
        await this.auth.setUserData(name, pass, "music", ud);
    }
    async renamePlaylist(name: string, pass: string, pname: string, new_name: string) {
        const ud = await this.getUserData(name);
        if(ud.playlists == undefined) return;
        const playlist = ud.playlists[pname];
        playlist.name = new_name;
        ud.playlists[new_name] = playlist;
        delete ud.playlists[pname];
        await this.auth.setUserData(name, pass, "music", ud);
    }

    async appendSongToPlaylist(playlist: Playlist, song: string) {
        playlist.songs.push([song, await MusicWizard.urlToTitle(song)]);
    }
    removeSongFromPlaylist(playlist: Playlist, song: string) {
        if(!playlist.songs.map(s => s[0]).includes(song)) return;
        playlist.songs.splice(playlist.songs.indexOf(song), 1);
    }
}