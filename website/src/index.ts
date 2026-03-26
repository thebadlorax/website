/* LONGER TERM PLANS
 *    forum page
 *        incremental game for points
 *    user generated ads
 * chat ui rework w/ embedding support
 * move server into a server class (or api)
 * finish gambling ring (roulette, poker, etc.), and abstract away everything possible from blackjack like cards and turns w/ a gameinstance
 *        visual update on things like ui elements and upscale things like the bg
 *        phone support / cooked sizing support
 *    status/update bar like a news ticker
 * simplify paramaters to not take a full user type and just the id or whatever it needs
 * refactor all clientside js to not make 1000000 requests and also look nicer w switches and classes
 * slim down css files and use more styles instead of one off classes
 *    admin panel/privilages
 * context menu on chats in the chat picker (leave, ephemeral chats)
 *        more user to user interaction (friends, online dates, etc)
 * make the snail races be the same for every viewer (and sync up start times)
 *    meowl shrine
 * finish webring
 *    make an actual dev portfolio on professional.thebadlorax.dev
 * improve website hosting experience
 *      run a newspaper 
 *      FISHING MULTIPLAYER GAME
*/

import { Glob, $, type ServerWebSocket } from "bun";
import { resolve } from 'node:path';

import { generateRandomString, clamp, getSubdomain, streamToBlob } from "./backend/utils";
import { deleteFile, renameFile } from "./backend/file";
import { Database } from "./backend/db"
import { BlackjackInstance, Deck } from "./backend/games";
import { corsResponse, CORS_HEADERS } from "./backend/connectivity";
import { ChatWizard } from "./backend/chat";
import { CacheWizard } from "./backend/cache";
import { LogWizard } from "./backend/logging";
import { AuthorizationWizard, userToJSON } from "./backend/auth";
import { TimeWizard } from "./backend/time";
import { GameWizard } from "./backend/game";

let log = new LogWizard();
await log.init();
log.log("starting server :3", "SERVER")
const db = new Database("database.json");
await db.init();
const auth = new AuthorizationWizard(db);
await auth.init();
const cache = new CacheWizard();
cache.addRoot("src/res")
cache.addRoot("src/pages")
const chat = new ChatWizard(db);
const game = new GameWizard(db);
/*let main_chat;
if(!await db.exists("main_chat")) {
  // @ts-expect-error
  await db.modify("main_chat", await chat.create())
} else {
  chat.publicize(chat.fromID(await chat.createInheritance(await db.fetch("main_chat")))!)
}
main_chat = chat.fromID(await db.fetch("main_chat"))!;
main_chat.display_name = "main";
main_chat.immutable = true;*/
const time = new TimeWizard();

// TODO: move these to different files/structures
async function serveStaticIfAllowed(url: string) {
  if(url.includes("/res/")) url = url.replace("/res", "");
  for (const root of cache.getRoots()) {
    const resolvedPath = resolve(root, "." + url);

    if (!resolvedPath.startsWith(root)) continue;

    if (cache.fileInCache(resolvedPath)) {
      const cached = cache.getCachedFile(resolvedPath)!;
      return corsResponse(cached.content, {
        headers: {
          "Content-Type": cached.type,
          "Cache-Control": "public, max-age=3600", 
          "Last-Modified": cached.lastModified,
          "ETag": cached.etag,
        },
      });
    }

    // Read file from disk
    const file = Bun.file(resolvedPath);
    if (await file.exists()) {
      const stats = await file.stat();
      const content = new Uint8Array(await file.arrayBuffer());
      const lastModified = stats.mtime.toUTCString();
      const etag = `${file.size}-${Date.parse(lastModified)}`;
      const type = file.type || "application/octet-stream";

      // Cache it
      cache.addToCache(resolvedPath, { content, type, etag, lastModified });

      return corsResponse(content, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "public, max-age=3600",
          "Last-Modified": lastModified,
          "ETag": etag,
        },
      });
    }
  }
  return null;
}
async function directoryIsProtected(directory: string) {
  let is_protected = await db.fetch(directory);
  return is_protected;
}
let visitor_count = parseInt(await db.fetch("visitors")) || 0;
let websockets = new Array();
let voice_websockets = new Array();
const clientIds = new Map<ServerWebSocket<{source: string}>, string>();
const starting_time = new Date();
const latest_commit = await $`git log -1 --pretty=format:"%s" `.text();
let key = await db.fetch("key")
if(!key) {
  key = generateRandomString(5);
  await db.modify("key", key);
}
// end

let blackjack: BlackjackInstance = new BlackjackInstance();
let decks = new Map<string, Deck>();

log.log("server initalized >:3", "SERVER")
const server = Bun.serve({
  port: 8081,
  /*tls: {
    cert: Bun.file("/home/thebadlorax/certs/fullchain.pem"),
    key: Bun.file("/home/thebadlorax/certs/privkey.pem"),
  },*/
  async fetch(req) { // api
    const req_url = new URL(req.url);
    let url = req_url.pathname;
    let subdomain = req_url.hostname;
    const protocol = req_url.protocol;
    if(protocol == "http:") subdomain += ".dev"
    let cd, filePath, cdFileName;

    if(url.includes("/subdomain=")) {
      let found_subdomain = url.split("/subdomain=")[1]?.split("/")[0]
      if(found_subdomain) {
        subdomain = found_subdomain
        url = url.replace(`/subdomain=${found_subdomain}`, "")
      }
    } else {
      subdomain = getSubdomain(subdomain);
    };

    if (req.method === "OPTIONS") {
      return corsResponse(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }; // cors shit

    switch(subdomain) {
      case "api":
        switch(url) {
          case "/file/download":
            if (req.method !== "GET") return corsResponse(null, { status: 405 });
        
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
          
            filePath = cd.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });
            filePath = filePath.replaceAll("../", "")
          
            const file = Bun.file(filePath);
            if (!(await file.exists())) return corsResponse("no file", { status: 404 });
          
            const filename = filePath.split("/").pop();
          
            return corsResponse(file, {
              headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(file.size),
              },
            });
          case "/file/query":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let req_json_9 = await req.json();
            let folder_2 = req_json_9["folder"];
            let name_2 = req_json_9["name"];
            let pass_2 = req_json_9["pass"];

            let user_2 = await auth.fetchAccount(name_2, pass_2);
            if(!user_2) return corsResponse(null, { status: 401 });

            let is_protected_4 = await auth.folderIsOwned(folder_2);
            if(is_protected_4 && !user_2.ownedFolders.includes(folder_2)) return corsResponse(null, { status: 401 });
      
            const glob = new Glob(`public/${folder_2}/*`);
            var data = [];
      
            for (const file of glob.scanSync(".")) {
              data.push(new Array(file, `${Bun.file(file).size}`))
            }
      
            data.sort();
      
            return corsResponse(JSON.stringify(data), {
              headers: { "Content-Type": "application/json" },
            });
          case "/file/upload":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            if (!req.body) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            let fileName = cdFileName.split("=")[1];
            if (!fileName) return corsResponse(null, { status: 400 });
            let password_3 = cd.split(";")[2];
            let password_3_string = password_3?.split("=")[1];

            // TODO: add who uploaded and time to context menu
            let is_protected_3 = await db.fetch(`/${fileName.split("/").at(0)}`)

            if(is_protected_3) {
              if(!password_3_string || !password_3_string === is_protected_3.split(";")[1]) {
                return corsResponse(null, { status: 403 })
              }
            }

            filePath = `public/${fileName}`;
            if(filePath == `public/tutorial.txt`) return corsResponse(null, { status: 403 }); 
            await Bun.write(filePath.replaceAll(" ", ""), await streamToBlob(req.body));
            log.log(`User uploaded file: ${filePath}`, "API");
            return corsResponse(null, { status: 201 });
          case "/file/delete":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });
            filePath = filePath.replaceAll("../", "")
            if(filePath.includes("tutorial.txt")) return corsResponse(null, { status: 403 }); 
            await deleteFile(filePath);
            log.log(`User deleted file: ${filePath}`, "API");
            return corsResponse(null, { status: 201 });
          case "/file/rename":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });
            filePath = filePath.replaceAll("../", "")
            if(filePath.includes("tutorial.txt")) return corsResponse(null, { status: 403 }); 
            const newNamecd = cd.split(";")[2];
            let newName = newNamecd?.split("=")[1];
            if (!newName) return corsResponse(null, { status: 400 });
            await renameFile(filePath, newName);
            log.log(`User renamed file ${filePath} to ${newName}`, "API");
            return corsResponse(null, { status: 201 });
          case "/file/protect":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let req_json_7;
            try { req_json_7 = await req.json(); }
            catch { return corsResponse(null, { status: 400 }); }

            let protected_2 = await auth.ownFolder(req_json_7["name"], req_json_7["pass"], req_json_7["folder"]);
            if(protected_2) {
              log.log(`Protected directory ${req_json_7["folder"]}`, "API");
              return corsResponse(null, { status: 200 });
            } else {
              return corsResponse(null, { status: 400 });
            };
          case "/file/protected":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let req_json_8 = await req.json();
            let folder = req_json_8["folder"];

            let is_protected_2 = await auth.folderIsOwned(folder);
            return corsResponse(null, { status: is_protected_2 ? 200 : 400 });
          case "/file/unprotect":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let rec_3;
            try { rec_3 = await req.json(); }
            catch { return corsResponse(null, { status: 400 }); }
            let user2 = await auth.fetchAccount(rec_3["name"], rec_3["pass"])
            if(!user2) return corsResponse(null, { status: 401 });
            let folder2 = rec_3["folder"];

            let already_protected_2 = await auth.folderIsOwned(folder2);
            if(!already_protected_2) return corsResponse(null, { status: 404 });

            if(user2.ownedFolders.includes(folder2)) {
              if(!await auth.releaseFolder(rec_3["name"], rec_3["pass"], folder2)) return corsResponse(null, { status: 400 });
              log.log(`Unprotected directory: ${filePath}`, "API");
              return corsResponse(null, {status: 200})
            }

            return corsResponse(null, { status: 400 });
          case "/hosting/toggle":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });
            if(filePath[0] != "/") return corsResponse(null, { status: 400 });

            let is_hosting = await db.fetch(filePath + "_hosting");
            // @ts-expect-error
            if(!is_hosting) await db.modify(filePath + "_hosting", "true")
            // @ts-expect-error
            else await db.modify(filePath + "_hosting", "")
            log.log(`Hosting toggled on directory: ${filePath}`, "API");
            return corsResponse(null, { status: 200 });
          case "/hosting/query":
            if(req.method != "GET") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });

            let is_hosting_2 = await db.fetch(`/${filePath}_hosting`);
            if(is_hosting_2) return corsResponse(null, { status: 200 })
            return corsResponse(null, { status: 400 });
          case "/gambling/cards/create":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let instance_id = generateRandomString(5);
            decks.set(instance_id, new Deck());
            return corsResponse(JSON.stringify({"id": instance_id}), { status: 201});
          case "/gambling/cards/draw":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let json = await req.json()
            let deck_id = json["id"];
            let deck = decks.get(deck_id);
            if(!deck) return corsResponse(null, { status: 404 });
            return corsResponse(JSON.stringify({"card": deck.draw()}), { status: 201});
          case "/gambling/snail/bet":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let rec_json = await req.json();
            let bet_snail = rec_json["bet"];
            let wager = rec_json["wager"]
            let user_name = rec_json["name"];
            let user_pass = rec_json["pass"]
            let user = await auth.fetchAccount(user_name, user_pass);
            let user_points;
            if(!user) { wager = 0; user_points = 0;}
            else user_points = user.statistics.points;
            let speed_division = Math.floor((Math.random() * 3)+1);
            let speed_multipler = (Math.random()*0.5) + 0.5;
            const fps = 60;
            const time = 15;
            let historical_speeds: Array<Array<number>> = []
            let speeds = [0, 0, 0, 0]
            let positions = [6, 6, 6, 6]
            const finish = 87;
            let winner = null;
            let frame_won = -1;
            let frame_count = -1;
            wager = clamp(wager, 0, user_points); // maximum and minimum bet serverside

            for(let x = 0; x < time*speed_division; x++) { // simulate
              historical_speeds.push(speeds);
              speeds = [
                ((Math.random() * 4)+1)*speed_multipler, 
                ((Math.random() * 4)+1)*speed_multipler, 
                ((Math.random() * 4)+1)*speed_multipler, 
                ((Math.random() * 4)+1)*speed_multipler,
              ] // refresh speeds
              for(let y = 0; y < fps/speed_division; y++) {
                frame_count += 1;
                positions[0]! += (.07*speeds[0]!)
                positions[1]! += (.07*speeds[1]!)
                positions[2]! += (.07*speeds[2]!)
                positions[3]! += (.07*speeds[3]!)

                if(winner == null) {
                  for(let z = 0; z < positions.length; z++) {
                    if(positions[z]! >= finish) {
                      winner = z; frame_won = frame_count;
                    }
                  }
                }
              }
            }
            historical_speeds.push(speeds); historical_speeds.shift(); // first speeds are [0, 0, 0, 0]

            if(winner == bet_snail && user_points && user) {
              auth.changePoints(user_name, user_pass, wager);
            } else if(winner != bet_snail && bet_snail != null && user) {
              auth.changePoints(user_name, user_pass, -wager);
            }

            return corsResponse(JSON.stringify({
              "speed-division": speed_division,
              "time": time,
              "fps": fps,
              "speeds": historical_speeds, 
              "winner": winner,
              "frame-won": frame_won
            }), { status: 200 });
          case "/gambling/blackjack/join":
            const success_2 = server.upgrade(req, {
              data: { source: "/gambling/blackjack/join" }, // Attach per-socket data
            });
            if(success_2) return undefined;
            return corsResponse("WebSocket upgrade failed", { status: 400 });
          case "/chat/live":
            const success = server.upgrade(req, {
              data: { source: "/chat/live" }, // Attach per-socket data
            });
            if(success) return undefined;
            return corsResponse("WebSocket upgrade failed", { status: 400 });
          case "/chat/emojis":
            try {
              const emojis = Bun.file("src/res/emojis.json"); // path to your JSON
              return corsResponse(emojis, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (err) {
              return corsResponse(JSON.stringify({ error: "Could not load emojis" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            };
          case "/stats":
            if(req.method != "GET") return corsResponse(null, { status: 405 });
            let visitor_count_2 = await db.fetch("visitors") || 0;
            return corsResponse(JSON.stringify({
              "key": key, 
              "visitor-count": visitor_count_2, 
              "uptime": Math.floor((new Date().getTime() - starting_time.getTime())/ 1000),
              "latest-commit": latest_commit
            }), { status: 200});
          case "/user/init":
            let id = generateRandomString(10);
            visitor_count += 1;
            // @ts-expect-error
            await db.modify("visitors", visitor_count.toString())
            return corsResponse(JSON.stringify({"id": `${key}-${id}`}), { status: 200});
          case "/user/account/create":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let req_json;
            try { req_json = await req.json(); }
            catch { return corsResponse(null, { status: 401 }); }
            if(req_json["name"].trim() == ""/* || req_json["name"].trim().length < 4*/) return corsResponse(null, { status: 401 });
            if(await auth.fetchAccount(req_json["name"], req_json["pass"])) return corsResponse(null, { status: 400 });
            let acc = await auth.createAccount(req_json["name"], req_json["pass"]);
            if(!acc) return corsResponse(null, { status: 401 });
            return corsResponse(JSON.stringify(userToJSON(acc)), { status: 201 });
          case "/user/account/fetch":
              if(req.method != "POST") return corsResponse(null, { status: 405 });
              let req_json_2;
              try { req_json_2 = await req.json(); }
              catch { return corsResponse(null, { status: 404 }); }
              let acc_2 = await auth.fetchAccount(req_json_2["name"], req_json_2["pass"]);
              if(!acc_2) return corsResponse(null, { status: 404 });
              return corsResponse(JSON.stringify(userToJSON(acc_2)), { status: 200 });
          case "/user/account/rename":
              if(req.method != "POST") return corsResponse(null, { status: 405 });
              let req_json_4;
              try { req_json_4 = await req.json(); }
              catch { return corsResponse(null, { status: 404 }); }
              await auth.renameAccount(req_json_4["name"], req_json_4["pass"], req_json_4["new_name"]);
              return corsResponse(null, { status: 200 });
          case "/user/account/exists":
              if(req.method != "POST") return corsResponse(null, { status: 405 });
              let req_json_5; try { req_json_5 = await req.json(); }
              catch { return corsResponse(null, { status: 404 }); }
              let acc_5 = await auth.exists(req_json_5["name"]);
              if(acc_5) return corsResponse(null, { status: 200 });
              else return corsResponse(null, { status: 404 });
          case "/user/account/delete":
              if(req.method != "POST") return corsResponse(null, { status: 405 });
              let req_json_3;
              try { req_json_3 = await req.json(); }
              catch { return corsResponse(null, { status: 404 }); }
              if(!await auth.exists(req_json_3["name"])) return corsResponse(null, { status: 404 });
              await auth.deleteAccount(req_json_3["name"], req_json_3["pass"]);
              return corsResponse(null, { status: 200 });
          case "/user/account/update":
              if(req.method != "POST") return corsResponse(null, { status: 405 });
              let req_json_6;
              try { req_json_6 = await req.json(); }
              catch { return corsResponse(null, { status: 404 }); }
              if(!await auth.exists(req_json_6["name"])) return corsResponse(null, { status: 404 });
              let acc_6 = await auth.updateAccount(req_json_6["name"], req_json_6["pass"], req_json_6["updated"]);
              if(!acc_6) return corsResponse(null, { status: 400 });
              return corsResponse(JSON.stringify(userToJSON(acc_6)), { status: 200 });
          case "/user/account/changePoints":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let req_json2 = await req.json(); 
            await auth.changePoints(req_json2["name"], req_json2["pass"], parseInt(req_json2["amt"]))
            return corsResponse(null, { status: 200 });
          case "/game/live":
            const success2 = server.upgrade(req, {
              data: { source: "/game/live" }, // Attach per-socket data
            });
            if(success2) return undefined;
            return corsResponse("WebSocket upgrade failed", { status: 400 });
          case "/game/files":
            const glob2 = new Glob(`src/res/game/**/**.png`);
            var data = [];
      
            for (const file of glob2.scanSync(".")) {
              data.push(file.replace("src/", ""));
            }

            return corsResponse(JSON.stringify(data), {
              headers: { "Content-Type": "application/json" },
            });
          case "/health":
            return corsResponse("OK"); 
          default: // dynamic route endpoints
            if(url.startsWith("/file/fetch/")) {
              let file_name = "public/" + url.split("fetch/")[1]
              let is_protected = await directoryIsProtected(`/${file_name.split("/")[1]}`);
              let pass = req.url.split("?")[1]?.split("password=")[1] || "";
              if(is_protected) {
                if(pass !== is_protected.split(";")[1]) return corsResponse(null, { status: 403 })
              }
                
              let file = Bun.file(file_name)
              if(await file.exists()) return corsResponse(file);
              else return corsResponse(null, { status: 400 });
            } else return corsResponse("endpoint not found", { status: 404 }); // serve error page
        };
      case "":
        let staticResponse = await serveStaticIfAllowed(url);
        if (staticResponse) return staticResponse;
        switch (url) {
          case "/":
            return corsResponse(Bun.file("src/pages/index.html"), { headers: { "Content-Type": "text/html" } });
      
          case "/files":
            return corsResponse(Bun.file("src/pages/files.html"), { headers: { "Content-Type": "text/html" } });
      
          case "/chat":
            return corsResponse(Bun.file("src/pages/chat.html"), { headers: { "Content-Type": "text/html" } });

          case "/gambling":
            return corsResponse(Bun.file("src/pages/gambling.html"), { headers: { "Content-Type": "text/html" } });

          case "/game":
            return corsResponse(Bun.file("src/pages/game.html"), { headers: { "Content-Type": "text/html" } });
      
          default:
            return corsResponse(Bun.file("src/pages/error.html"), {
              status: 404,
              headers: { "Content-Type": "text/html" },
            });
        };
      case "professional": 
        let staticResponse_2 = await serveStaticIfAllowed(url);
        if (staticResponse_2) return staticResponse_2;
        return corsResponse("really professional website", {
          headers: { "Content-Type": "text/html" },
        });
      default: // hosted websites & errors
        let index = Bun.file(`public/${subdomain}/index.html`);
        if(await index.exists() && await db.fetch(`/${subdomain}_hosting`)) {
          if(url == "/") {
            return corsResponse(index, {
              headers: { "Content-Type": "text/html" },
            });
          } else {
            let file = Bun.file(`public/${subdomain}/${url}`);
            if(await file.exists()) {
              return corsResponse(file);
            } else {
              return corsResponse(Bun.file("src/pages/error.html"), {
                headers: { "Content-Type": "text/html" },
              });
            }
          }
        } else {
          const staticResponse = await serveStaticIfAllowed(url);
          if (staticResponse) return staticResponse;
          return corsResponse(Bun.file("src/pages/error.html"), {
            headers: { "Content-Type": "text/html" },
          });
        };
    };
  },
  maxRequestBodySize: 500000000, // 500mb hard upload limit (limited to 50mb clientside)

websocket: {
  data: {} as { source: string },

  open(ws) {
    switch (ws.data.source) {
      case "/chat/live": break;

      case "/chat/voice":
        voice_websockets.push(ws);

        const id = `user_${crypto.randomUUID()}`;
        clientIds.set(ws, id);

        const msg = JSON.stringify({ type: "voice-connect", clientId: id });
        ws.send(JSON.stringify({type: "info", clientId: id}));
        for (const client of voice_websockets) {
          if (client.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "voice-connect", clientId: clientIds.get(client) }))
            client.send(msg);
          }
        }
        break;
      
      case "/gambling/blackjack/join": blackjack.handleConnection(ws); break;
      
      case "/game/live": break;

      default:
        websockets.push(ws);
    }
  },

  message(ws, message) {
    switch (ws.data.source) {
      case "/chat/live": chat.pipe(JSON.parse(message).id, ws, message); break;

      case "/chat/voice":
        const senderId = clientIds.get(ws);
        if (!senderId) return;

        // Encode senderId into 36 bytes header
        const encoder = new TextEncoder();
        const idBytes = encoder.encode(senderId);
        const header = new Uint8Array(36);
        header.set(idBytes.slice(0, 36));

        const audioBytes = new Uint8Array(message);

        const packet = new Uint8Array(header.length + audioBytes.length);
        packet.set(header, 0);
        packet.set(audioBytes, header.length);

        // Broadcast to all clients
        for (const client of voice_websockets) {
          if (client.readyState === WebSocket.OPEN) {
            if(client == ws) continue;
            client.send(packet.buffer);
          }
        }
        break;

      case "/gambling/blackjack/join": blackjack.handleRecieved(ws, message); break;

      case "/game/live": game.handleMessage(ws, message); break;

      default:
        ws.send("where u come from :-(");
    }
  },

  close(ws) {
    switch (ws.data.source) {
      case "/chat/live": chat.deregister(ws); break;

      case "/chat/voice": {
        const id = clientIds.get(ws);
        clientIds.delete(ws);
      
        const index = voice_websockets.indexOf(ws);
        if (index !== -1) voice_websockets.splice(index, 1);
      
        const msg = JSON.stringify({ type: "voice-disconnect", clientId: id });
        for (const client of voice_websockets) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
          }
        }
        break;
      }

      case "/gambling/blackjack/join":
        blackjack.deregisterPlayer(ws);
        break;
    
      case "/game/live": game.deregisterPlayer(ws); break;
    }
  },

  drain(ws) {
    // optional backpressure handling
  },
} as const
});

log.log("server started :33", "SERVER")