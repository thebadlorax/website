/**
 * author thebadlorax
 * created on 02-07-2026-20h-40m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { getApiLink, downloadBlob } from "./common.js";

// music player
class MusicPlayer {
    constructor() {
        this.queue = []
        this.playing = false;
        this.vol = 1;
    }

    setVolume(vol) {
        this.vol = vol;
        this.queue[0].audio.volume = this.vol;
    }

    stop() {
        if(this.queue.length == 0) return;
        this.queue[0].audio.pause();
        this.playing = false;
        this._stop()
    };
    
    resume() {
        if(this.queue.length == 0) return;
        this.queue[0].audio.play();
        this.queue[0].audio.volume = this.vol;
        this.playing = true;
        this._start();
    }

    queueSong(songData) {
        let a = this.getYoutubeAudio(songData.url);
        a.addEventListener("ended", () => {
            this.queue.shift();
            if(this.queue.length == 0) {
                this.playing = false;
                this._stop();
                return;
            }
            this.resume();
        })
        this.queue.push({...songData, "audio": a})
        if(this.queue.length == 1) {
            this.resume();
        }
    }

    _stop() {
        global_play.textContent = "▶︎"
    }
    _start() {
        global_play.textContent = "⏸"
    }

    getYoutubeAudio(url) {
        const audio = new Audio(`${getApiLink("/music/streamAudio")}?url=${url}`);
        audio.addEventListener("play", () => { this._start() })
        audio.addEventListener("pause", () => { this.stop() })
        return audio
    }
}
const mp = new MusicPlayer();

global_play.addEventListener("click", () => {
    console.log(mp.queue)
    if(mp.playing) mp.stop()
    else mp.resume()
})

// search
const update_search = async () => {
    let req = await fetch(getApiLink("/music/getDataFromURL"), {
        method: "POST",
        body: JSON.stringify({
            "song": song_search.value
        })
    });
    if(req.status == 400) return;
    let json = await req.json();
    main_view_data.song_data = {...json, "url": song_search.value};
    main_view_data.type = "song"
    for(const child of playlist_div.children) {
        child.classList.remove("highlighted");
    }
    selected_playlist = null;
    refreshMainView();
}
song_search.addEventListener("input", async () => {
    await update_search()
})
song_search.addEventListener("keydown", async e => {
    if(e.key == "Enter") await update_search();
})

document.getElementById("add_to_playlist").addEventListener("click", async () => {
    main_view_data.type = "choose_playlist";
    main_view_data.onclick = async (name) => { 
        await append_to_playlist(name, main_view_data.song_data.url);
        selected_playlist = name;
        await refreshPlaylistForMainView();
        main_view_data.type = "playlist";
        await refresh_playlist_buttons();
        await refreshMainView();
     }
    await refreshMainView();
})

document.getElementById("song_play").addEventListener("click", async () => {
    mp.queueSong(main_view_data.song_data);
});

document.getElementById("song_download").addEventListener("click", async () => {
    const r = await fetch(getApiLink("/music/downloadMp3") + `?url=${main_view_data.song_data.url}`);
    downloadBlob(await r.blob(), `${main_view_data.song_data.title}.mp3`, "audio/mp3");
});

// main view
let main_view_data = {
    "type": null
}
const main_view_divs = {
    "none": document.getElementById(`main_view_none`),
    "playlist": document.getElementById(`main_view_playlist`),
    "playlist_choice": document.getElementById(`main_view_playlist_choice`),
    "song": document.getElementById(`main_view_song`),
}
async function refreshMainView() {
    Object.values(main_view_divs).forEach(d => d.style.display = "none");
    switch(main_view_data.type) {
        case "playlist": {
            main_view_divs.playlist.replaceChildren();
            if(main_view_data.playlist.songs.length == 0) {
                const ele = document.createElement("p");
                ele.textContent = "literally no songs";
                main_view_divs.playlist.appendChild(ele);
            }
            main_view_data.playlist.songs.forEach(s => {
                const ele = document.createElement("div");
                ele.classList.add("song");
                ele.dataset.data = s;
                const text = document.createElement("p");
                text.textContent = s[1];
                ele.appendChild(text);

                const view_button = document.createElement("button");
                view_button.classList.add("song-button");
                view_button.textContent = "view";
                view_button.addEventListener("click", async () => {
                    song_search.value = s[0];
                    await update_search()
                })
                ele.appendChild(view_button)

                const remove_button = document.createElement("button");
                remove_button.classList.add("song-button");
                remove_button.textContent = "remove";
                remove_button.addEventListener("click", async () => {
                    await remove_from_playlist(selected_playlist, s[0]);
                    await refreshPlaylistForMainView()
                    await refresh_playlist_buttons();
                    refreshMainView();
                })
                ele.appendChild(remove_button)
                main_view_divs.playlist.appendChild(ele);
            })
            main_view_divs.playlist.style.display = "flex";
            break;
        }
        case "song": {
            const info_div = document.getElementById(`main_view_song_info`);
            info_div.replaceChildren();
            
            const thumbnail = document.createElement("img");
            thumbnail.src = main_view_data.song_data.thumbnail.url;
            thumbnail.style.width =  `${main_view_data.song_data.thumbnail.width}px`;
            thumbnail.style.height = `${main_view_data.song_data.thumbnail.height}px`;
            
            const title_text = document.createElement("p");
            title_text.textContent = main_view_data.song_data.title;
            title_text.style.fontSize = "2vw";
            title_text.style.marginBottom = "0px";

            const author_text = document.createElement("a");
            author_text.textContent = main_view_data.song_data.author.name;
            author_text.href = main_view_data.song_data.author.url;
            author_text.target = "_blank"

            info_div.appendChild(thumbnail);
            info_div.appendChild(title_text);
            info_div.appendChild(author_text);
            main_view_divs.song.style.display = "flex";
            break;
        }
        case "choose_playlist": {
            main_view_divs.playlist_choice.replaceChildren();
            const playlists = await getPlaylists();
            Object.keys(playlists).forEach(key => {
                const p = playlists[key];
                const ele = document.createElement("button");
                ele.classList.add("playlist-button");
                ele.textContent = p.name;
                ele.addEventListener("click", () => {
                    main_view_data.onclick(p.name);
                    main_view_data.type = null;
                    refreshMainView();
                })
                main_view_divs.playlist_choice.appendChild(ele);
            });
            const ele = document.createElement("button");
            ele.classList.add("playlist-button");
            ele.textContent = "cancel";
            ele.addEventListener("click", async () => {
                await update_search();
            })
            main_view_divs.playlist_choice.appendChild(ele);
            main_view_divs.playlist_choice.style.display = "flex";
            break;
        }
        default: {
            main_view_divs.none.style.display = "flex";
            break;
        }
    }
}
refreshMainView();

// playlists
let selected_playlist = null;
async function refreshPlaylistForMainView() {
    const p = await getPlaylists();
    main_view_data.playlist = {
        "name": selected_playlist,
        "songs": p[selected_playlist].songs
    };
}
const setPlaylist = (name, songs) => {
    selected_playlist = name;
    for(const child of playlist_div.children) {
        child.classList.remove("highlighted");
    }
    main_view_data.type = "playlist";
    main_view_data.playlist = {
        "name": name,
        "songs": songs
    };
    refreshMainView()
}
async function getPlaylists() {
    let user = JSON.parse(window.localStorage.getItem("user"));
    let r = await fetch(getApiLink("/music/getPlaylists"), {
        method: "POST",
        body: JSON.stringify({
            "name": user.account.name
        })
    });
    return await r.json();
}
async function refresh_playlist_buttons() {
    const playlists = await getPlaylists();
    playlist_div.replaceChildren();
    Object.keys(playlists).forEach(key => {
        const p = playlists[key];
        const ele = document.createElement("button");
        ele.classList.add("playlist-button");
        ele.textContent = p.name;
        ele.addEventListener("contextmenu", e => { e.preventDefault(); showMenu(e.pageX, e.pageY, ["delete", "download", "rename"]); con_data = {"type": "playlist", "pname": p.name}})
        ele.addEventListener("click", () => {
            if(selected_playlist == p.name) {
                main_view_data.type = "none";
                refreshMainView()
                selected_playlist = ""
                ele.classList.remove("highlighted");
                return;
            }
            setPlaylist(p.name, p.songs);
            ele.classList.add("highlighted");
        })
        if(p.name == selected_playlist) ele.classList.add("highlighted");
        playlist_div.appendChild(ele);
    })
    const create_playlist_button = document.createElement("button");
    create_playlist_button.classList.add("playlist-button");
    create_playlist_button.textContent = "+"
    create_playlist_button.addEventListener("click", async () => {
        let user = JSON.parse(window.localStorage.getItem("user"));
        let name = prompt("playlist name (10 character limit)").slice(0, 10);
        if(!name) return;
        let p = await fetch(getApiLink("/music/createPlaylist"), {
            method: "POST",
            body: JSON.stringify({
                "name": user.account.name,
                "pass": user.account.pass,
                "pname": name
            })
        });
        if(p.status == 400) {
            alert(`playlist ${name} exists already`)
        }
        
        await refresh_playlist_buttons();
    });
    playlist_div.appendChild(create_playlist_button);
}

async function append_to_playlist(name, song) {
    let user = JSON.parse(window.localStorage.getItem("user"));
    let r = await fetch(getApiLink("/music/appendSongToPlaylist"), {
        method: "POST",
        body: JSON.stringify({
            "name": user.account.name,
            "pass": user.account.pass,
            "pname": name,
            "song": song
        })
    });
}
async function remove_from_playlist(name, song) {
    let user = JSON.parse(window.localStorage.getItem("user"));
    let r = await fetch(getApiLink("/music/removeSongFromPlaylist"), {
        method: "POST",
        body: JSON.stringify({
            "name": user.account.name,
            "pass": user.account.pass,
            "pname": name,
            "song": song
        })
    });
}

// context menu
let con_x = 0; let con_y = 0; let con_data = null;
function showMenu(x, y, buttons) {
    con_x = x-1;
    con_y = y-1;
    context.style.display = 'block';
    context.style.left = `${x}px`;
    context.style.top = `${y}px`;

    for(let x = 0; x < buttons.length; x++) {
        const button = buttons[x];
        document.getElementById(button).style.display = "block";
    }
}; function hideMenu() {
    context.style.display = 'none';
    document.getElementById("delete").style.display = "none"
    document.getElementById("download").style.display = "none"
    document.getElementById("rename").style.display = "none"
}; 
hideMenu();
window.addEventListener("mouseup", e => { if (e.button === 0) hideMenu(); });
async function menuAction(type) {
    switch(con_data.type) {
        case "playlist": {
            switch(type) {
                case "delete": {
                    let user = JSON.parse(window.localStorage.getItem("user"));
                    if(con_data.pname == selected_playlist) {
                        main_view_data.type = null;
                        refreshMainView();
                    }
                    await fetch(getApiLink("/music/deletePlaylist"), {
                        method: "POST",
                        body: JSON.stringify({
                            "name": user.account.name,
                            "pass": user.account.pass,
                            "pname": con_data.pname
                        })
                    })
                    await refresh_playlist_buttons();
                    break;
                }
                case "rename": {
                    let user = JSON.parse(window.localStorage.getItem("user"));
                    console.log(con_data);
                    await fetch(getApiLink("/music/renamePlaylist"), {
                        method: "POST",
                        body: JSON.stringify({
                            "name": user.account.name,
                            "pass": user.account.pass,
                            "pname": con_data.pname,
                            "nname": prompt("new name (10 character limit)").slice(0, 10)
                        })
                    })
                    await refresh_playlist_buttons();
                    break;
                }
            } break;
        }
    }
}
document.getElementById("delete").addEventListener("click", async () => { await menuAction("delete") })
document.getElementById("download").addEventListener("click", async () => { await menuAction("download") })
document.getElementById("rename").addEventListener("click", async () => { await menuAction("rename") })

song_search.value = ""
await refresh_playlist_buttons();