console.log("starting server :3")

import { Glob, $, type ServerWebSocket } from "bun";
import { rename, watch } from 'fs';
import { rm, stat } from "node:fs/promises";
import { resolve } from 'node:path';

let STATIC_ROOTS = [
  resolve("src/res"),
  resolve("src/pages")
];
const DB_PATH = "database.json"
if(!await Bun.file(DB_PATH).exists()) {
  await Bun.file(DB_PATH).write(`{"nothing":"wow"}`);
}
const starting_time = new Date();
const latest_commit = await $`git log -1 --pretty=format:"%s" `.text();
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Content-Disposition",
  "Access-Control-Max-Age": "86400",
} satisfies HeadersInit;

function generateRandomString(length: number) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
}

async function streamToBlob(stream: ReadableStream, mimeType?: string) {
  // Create a corsResponse object with the stream as the body.
  const response = corsResponse(stream, {
    headers: {
      'Content-Type': mimeType || 'application/octet-stream' // Set an appropriate default MIME type if none is provided
    }
  });

  // Consume the response as a blob.
  const blob = await response.blob();
  return blob;
}

async function isDirectory(path: string) {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (error) {
    // Handle error if the path does not exist or other issues occur
    throw(error);
  }
}

/*async function getDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory())
      // Use join to get the full path, as readdir returns only the name
      .map(entry => join(dirPath, entry.name));
    return directories;
  } catch (error) {
    return [];
  }
}

async function createDirectory(dirPath: string) {
  try {
    // The recursive: true option ensures parent directories are created if they don't exist
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw error;
  }
}*/

async function deleteFile(filePath: string) {
  let is_dir = await isDirectory(filePath);
  if(is_dir) {
    try {
      await rm(filePath, {
        recursive: true, // Required for deleting subdirectories and files
        force: true,     // Prevents errors if the directory doesn't exist
      });
      console.log(`Directory ${filePath} has been deleted.`);
    } catch (error) {
      throw(error);
    }
  } else {
    try {
      const file = Bun.file(filePath);
      await file.delete(); // The delete() method removes the file from the filesystem
  
    } catch (error) {
      console.error(`Error deleting file: ${error}`);
    }
  }
}

async function renameFile(filePath: string, newName: string) {
  rename(filePath, newName, (err) => {
    if (err) throw err;
  });
}

async function changeElementInDB(jsonElement: string, newData: string) {
  try {
    const file = Bun.file(DB_PATH)
    if(!await file.exists()) await file.write(`{"nothing":"wow"}`)
    const json = await file.json();

    if(newData == "") {
      delete json.jsonElement
    }

    json[jsonElement] = newData

    await Bun.write(file, JSON.stringify(json));
  } catch (error) {
    console.log(`[ERROR] - ${jsonElement}, fuckkkk the database is cooked 🥀:\n${error}`)
  }
}

async function getElementInDB(jsonElement: string) {
  if(!await Bun.file(DB_PATH).exists()) {
    await Bun.file(DB_PATH).write(`{"nothing":"wow"}`);
  }
  try {
    const file = Bun.file(DB_PATH)
    let json = await file.json();
    let layers = new Array();
    jsonElement.split(".").forEach(element => {
      layers.push(element)
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
    console.log(`[ERROR] - yo theres acc nothing in here :(:\n${error}`)
  }
}

const getSubdomain = (hostname: string) => {
  // Split the hostname by dots
  const parts = hostname.split('.');

  // A simple approach: assume the last two parts are the domain and TLD (e.g., domain.com)
  // Everything before that is the subdomain(s)
  if(hostname.includes("66.65.25.15")) {
    if (parts.length > 2) {
      return parts.slice(0, -5).join('.');
    }
  } else {
    if (parts.length > 2) {
      // Slice off the last two parts and join the rest
      return parts.slice(0, -2).join('.');
    }
  }
  
  // If only two parts (e.g., example.com), there is no subdomain (or www is considered none)
  return ''; 
};

function corsResponse(
  body: BodyInit | null,
  init: ResponseInit = {}
): Response {
  return new Response(body, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

const fileCache: Map<string, { content: Uint8Array, type: string, etag: string, lastModified: string }> = new Map();

try {
  for (const root of STATIC_ROOTS) {
    watch(root, { recursive: true }, (filename) => {
      if (!filename) return;
      const path = resolve(root, filename);
      if (fileCache.has(path)) {
        fileCache.delete(path);
        console.log(`[CACHE] Cleared cache for ${path}`);
      }
    });
  }
} catch (error) {
  console.log("cache reload failed: " + error)
}

async function serveStaticIfAllowed(url: string) {
  if(url.includes("/res/")) url = url.replace("/res", "");
  for (const root of STATIC_ROOTS) {
    const resolvedPath = resolve(root, "." + url);

    if (!resolvedPath.startsWith(root)) continue;

    if (fileCache.has(resolvedPath)) {
      const cached = fileCache.get(resolvedPath)!;
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
      fileCache.set(resolvedPath, { content, type, etag, lastModified });

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
  let is_protected = await getElementInDB(directory);
  return is_protected;
}

let visitor_count = parseInt(await getElementInDB("visitors")) || 0;

let websockets = new Array();
let chat_websockets = new Array();
let voice_websockets = new Array();
const clientIds = new Map<ServerWebSocket<{source: string}>, string>();
let chat_names = new Array();
let chat_history = new Array();
let chat_ids = new Array();

let key = await getElementInDB("key")
if(!key) {
  key = generateRandomString(5);
  await changeElementInDB("key", key);
}

const server = Bun.serve({
  port: 8081,
  /*tls: {
    cert: Bun.file("/etc/letsencrypt/live/thebadlorax.dev-0001/fullchain.pem"),
    key: Bun.file("/etc/letsencrypt/live/thebadlorax.dev-0001/privkey.pem"),
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

            let is_protected = await getElementInDB(`/${filePath}`.slice(0, -1))

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

            let is_protected_3 = await getElementInDB(`/${fileName.split("/").at(0)}`)

            if(is_protected_3) {
              if(!password_3_string || !password_3_string === is_protected_3.split(";")[1]) {
                return corsResponse(null, { status: 403 })
              }
            }

            filePath = `public/${fileName}`;
            if(filePath == `public/tutorial.txt`) return corsResponse(null, { status: 403 }); 
            await Bun.write(filePath.replaceAll(" ", ""), await streamToBlob(req.body));
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
            
            let already_protected = await getElementInDB(filePath);
            if(already_protected) return corsResponse(null, { status: 403 });
            let password = generateRandomString(5);
            await changeElementInDB(filePath, `true;${password}`);

            return corsResponse(JSON.stringify({"password": password}), { status: 200 });
          case "/file/protected":
            if(req.method != "GET") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });

            let is_protected_2 = await getElementInDB(`/${filePath}`);
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

            let already_protected_2 = await getElementInDB(filePath);
            if(!already_protected_2) return corsResponse(null, { status: 404 });
            let true_pass = already_protected_2.split(";")[1]

            if(rec_password_string === true_pass) {
              await changeElementInDB(filePath, "")
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

            let is_hosting = await getElementInDB(filePath + "_hosting");
            if(!is_hosting) await changeElementInDB(filePath + "_hosting", "true")
            else await changeElementInDB(filePath + "_hosting", "")
            return corsResponse(null, { status: 200 });
          case "/hosting/query":
            if(req.method != "GET") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });

            let is_hosting_2 = await getElementInDB(`/${filePath}_hosting`);
            if(is_hosting_2) return corsResponse(null, { status: 200 })
            return corsResponse(null, { status: 400 });
          case "/chat/live":
            const success = server.upgrade(req, {
              data: { source: "/chat/live" }, // Attach per-socket data
            });
            if(success) return undefined;
            return corsResponse("WebSocket upgrade failed", { status: 400 });
          case "/chat/history":
            if(req.method != "GET") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });
            return corsResponse(JSON.stringify(chat_history.slice(-parseInt(filePath))), { status: 200 });
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
            let visitor_count_2 = await getElementInDB("visitors") || 0;
            return corsResponse(JSON.stringify({
              "key": key, 
              "visitor-count": visitor_count_2, 
              "uptime": Math.floor((new Date().getTime() - starting_time.getTime())/ 1000),
              "latest-commit": latest_commit
            }), { status: 200});
          case "/user/init":
            let id = generateRandomString(10);
            visitor_count += 1;
            await changeElementInDB("visitors", visitor_count.toString())
            await changeElementInDB(id, "0");
            return corsResponse(JSON.stringify({"id": `${key}-${id}`}), { status: 201});
          case "/user/points/query":
            if(req.method != "GET") return corsResponse(null, { status: 405 });
            cd = req.headers.get("content-disposition");
            if (!cd) return corsResponse(null, { status: 400 });
            cdFileName = cd.split(";")[1];
            if (!cdFileName) return corsResponse(null, { status: 400 });
            filePath = cdFileName.split("=")[1];
            if (!filePath) return corsResponse(null, { status: 400 });
      
            let db_data = await getElementInDB(filePath);
      
            if(db_data == undefined) return corsResponse(null, { status: 404})
      
            return corsResponse(JSON.stringify({"points": db_data}), { status: 200 });
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

          /*case "/seeburg":
            return corsResponse(Bun.file("src/pages/seeburg.html"), { headers: { "Content-Type": "text/html" } });

          case "/meowl":
            return corsResponse(Bun.file("src/pages/meowl.html"), { headers: { "Content-Type": "text/html" } });

          case "/test":
            return corsResponse(Bun.file("src/pages/test.html"), { headers: { "Content-Type": "text/html" } });*/
      
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
        if(await index.exists() && await getElementInDB(`/${subdomain}_hosting`)) {
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
              chat_history.push(msg);
              chat_websockets.forEach((socket) => {
                socket.send(msg);
                socket.send(`_SETCHATTERS=${chat_websockets.length}`);
              });
          }
        } else {
          chat_history.push(message);
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
          chat_history.push(msg);
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
    }
  },

  drain(ws) {
    // optional backpressure handling
  },
} as const
});

console.log("server initalized >:3")

console.log("server started :33")