import { Glob, $, type ServerWebSocket } from "bun";
import { resolve } from 'node:path';

import { generateRandomString, clamp, getSubdomain, streamToBlob } from "./backend/utils";
import { deleteFile, renameFile } from "./backend/file";
import { Database } from "./backend/db"
import { BlackjackInstance, Deck } from "./backend/games";
import { corsResponse, CORS_HEADERS } from "./backend/connectivity";
import { ChatInstance } from "./backend/chat";
import { CacheWizard } from "./backend/cache";
import { LogWizard } from "./backend/logging";
import { AuthorizationWizard, userToJSON } from "./backend/auth";
import { TimeWizard } from "./backend/time";

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
// TODO: multiple chats, like dms
const chat = new ChatInstance(db);
await chat.init();
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
let chat_websockets = new Array();
let voice_websockets = new Array();
const clientIds = new Map<ServerWebSocket<{source: string}>, string>();
let chat_names = new Array();
let chat_ids = new Array();
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
            if(req.method != "GET") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });
            filePath = filePath.replaceAll(".", "")
            let password_2 = cd.split(";")[2];
            let password_2_string = password_2?.split("=")[1];

            let is_protected = await db.fetch(`/${filePath}`.slice(0, -1))

            if(is_protected) {
              if(!password_2_string || !password_2_string === is_protected.split(";")[1]) {
                return corsResponse(null, { status: 403 })
              }
            }
      
            const glob = new Glob(`public/${filePath}*`);
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

            // add who uploaded and time to context menu

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
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });

            if(filePath[0] != "/") return corsResponse(null, { status: 404 });
            if(filePath == "/") return corsResponse(null, { status: 403 });
            
            let already_protected = await db.fetch(filePath);
            if(already_protected) return corsResponse(null, { status: 403 });
            let password = generateRandomString(5);
            await db.modify(filePath, `true;${password}`);

            log.log(`Protected directory ${filePath}, password: ${password}`, "API");

            return corsResponse(JSON.stringify({"password": password}), { status: 200 });
          case "/file/protected":
            if(req.method != "GET") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });

            let is_protected_2 = await db.fetch(`/${filePath}`);
            if(!is_protected_2) return corsResponse(null, { status: 400 })
            if(is_protected_2 && is_protected_2.includes("true")) return corsResponse(null, { status: 200 })
            return corsResponse(null, { status: 400 });
          case "/file/unprotect":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });
            let rec_password = cd.split(";")[2];
            let rec_password_string = rec_password?.split("=")[1];
            if(!rec_password_string) return corsResponse(null, { status: 400 }); 

            if(filePath[0] != "/") return corsResponse(null, { status: 400 });

            let already_protected_2 = await db.fetch(filePath);
            if(!already_protected_2) return corsResponse(null, { status: 404 });
            let true_pass = already_protected_2.split(";")[1]

            if(rec_password_string === true_pass) {
              await db.modify(filePath, "")
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
            if(!is_hosting) await db.modify(filePath + "_hosting", "true")
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
          case "/chat/history":
            let rec_json2 = await req.json();
            let amt = rec_json2["amount"];
            let con_msgs = rec_json2["connection_messages"];
            let history = await chat.fetchMessagesFromHistory(amt, con_msgs);
            return corsResponse(JSON.stringify(history), { status: 200 });
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
          case "/chat/voice":
            const success2 = server.upgrade(req, {
              data: { source: "/chat/voice" }, // Attach per-socket data
            });
            if(success2) return undefined;
            return corsResponse("WebSocket upgrade failed", { status: 400 });
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
            await db.modify("visitors", visitor_count.toString())
            return corsResponse(JSON.stringify({"id": `${key}-${id}`}), { status: 200});
          case "/user/account/create":
            if(req.method != "POST") return corsResponse(null, { status: 405 });
            let req_json;
            try { req_json = await req.json(); }
            catch { return corsResponse(null, { status: 401 }); }
            if(req_json["name"].trim() == "") return corsResponse(null, { status: 404 });
            if(await auth.fetchAccount(req_json["name"], req_json["pass"])) return corsResponse(null, { status: 400 });
            let acc = await auth.createAccount(req_json["name"], req_json["pass"]);
            if(!acc) return corsResponse(null, { status: 401 });
            return corsResponse(userToJSON(acc), { status: 201 });
          case "/user/account/fetch":
              if(req.method != "POST") return corsResponse(null, { status: 405 });
              let req_json_2;
              try { req_json_2 = await req.json(); }
              catch { return corsResponse(null, { status: 404 }); }
              let acc_2 = await auth.fetchAccount(req_json_2["name"], req_json_2["pass"]);
              if(!acc_2) return corsResponse(null, { status: 404 });
              return corsResponse(userToJSON(acc_2), { status: 200 });
          case "/user/account/rename":
              if(req.method != "POST") return corsResponse(null, { status: 405 });
              let req_json_4;
              try { req_json_4 = await req.json(); }
              catch { return corsResponse(null, { status: 404 }); }
              let acc_4 = await auth.renameAccount(req_json_4["name"], req_json_4["pass"], req_json_4["new_name"]);
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
              let acc_3 = await auth.deleteAccount(req_json_3["name"], req_json_3["pass"]);
              return corsResponse(null, { status: 200 });
          case "/user/account/update":
              if(req.method != "POST") return corsResponse(null, { status: 405 });
              let req_json_6;
              try { req_json_6 = await req.json(); }
              catch { return corsResponse(null, { status: 404 }); }
              if(!await auth.exists(req_json_6["name"])) return corsResponse(null, { status: 404 });
              let acc_6 = await auth.updateAccount(req_json_6["name"], req_json_6["pass"], req_json_6["updated"]);
              if(!acc_6) return corsResponse(null, { status: 400 });
              return corsResponse(userToJSON(acc_6), { status: 200 });
          case "/health":
            return corsResponse("OK"); 
          default:
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
            } else return corsResponse("endpoint not found", { status: 404 });
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
      case "/chat/live":
        chat_websockets.push(ws);
        chat_names.push("_UNREGISTERED");
        chat_ids[chat_websockets.indexOf(ws)] = "No ID";
        break;

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
      
      default:
        websockets.push(ws);
    }
  },

  message(ws, message) {
    switch (ws.data.source) {
      case "/chat/live":
        if (message[0] === "_") {
          const method = message.slice(1, message.indexOf("="));
          const value = message.slice(message.indexOf("=") + 1);

          switch (method) {
            case "NAME":
              chat_names[chat_websockets.indexOf(ws)] = value;
              break;
            case "ID":
              chat_ids[chat_websockets.indexOf(ws)] = value;
              break;
            case "CONNECT":
              const msg = `${chat_names[chat_websockets.indexOf(ws)]} has connected`;
              chat.appendMessageToHistory({
                type: "connection",
                content: msg,
                timestamp: Date.now()
              });
              chat_websockets.forEach((socket) => {
                socket.send(msg);
                socket.send(`_SETCHATTERS=${chat_websockets.length}`);
              });
          }
        } else {
          chat.appendMessageToHistory({
            type: "message",
            content: message,
            timestamp: Date.now()
          });
          chat_websockets.forEach((socket) => socket.send(message));
        }
        break;

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

      default:
        ws.send("where u come from :-(");
    }
  },

  close(ws) {
    switch (ws.data.source) {
      case "/chat/live":
        const index = chat_websockets.indexOf(ws);
        chat_websockets.splice(index, 1);
        if (chat_names[index] !== "_UNREGISTERED") {
          const msg = `${chat_names[index]} has disconnected`;
          chat.appendMessageToHistory({
            type: "connection",
            content: msg,
            timestamp: Date.now()
          });
          chat_websockets.forEach((socket) => {
            socket.send(`_SETCHATTERS=${chat_websockets.length}`);
            socket.send(msg);
          });
        }
        chat_names.splice(index, 1);
        chat_ids.splice(index, 1);
        break;

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
    }
  },

  drain(ws) {
    // optional backpressure handling
  },
} as const
});

log.log("server started :33", "SERVER")