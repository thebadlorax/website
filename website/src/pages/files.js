const { getApiLink } = await import('./common.js');

const contextMenu = document.getElementById("context");
let con_x, con_y;

const renameOverlay = document.getElementById("rename-overlay");
const renameInput = document.getElementById("rename-input");
let renameTargetPath = null;

const file_size_p = document.getElementById("file-size")

let current_dir = "/";
let dirInput = document.getElementById("dir-input")

const container = document.getElementById("file-container")

const banned_click_extensions = [".rar", ".zip", ".gzip", ".7z"]//[".html"]

function showMenu(x, y, file_size) {
    con_x = x-1;
    con_y = y-1;
    file_size_p.textContent = file_size;
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

// Function to hide the menu
function hideMenu() {
    contextMenu.style.display = 'none';
}

async function confirmRename() {
    if (!renameTargetPath) return;

    const newName = renameInput.value.trim();
    if (!newName) return;

    try {
        const res = await fetch(getApiLink("/file/rename"), {
            method: "POST",
            headers: {
                "Content-Disposition": `attachment; old=${renameTargetPath}; new=public/${current_dir}${newName}`
            }
        });

        if (res.ok) fetchDataFromServer();
    } catch {}

    cancelRename();
}

function cancelRename() {
    renameOverlay.style.display = "none";
    renameTargetPath = null;
}

async function menuAction(action) {
    let e = document.elementFromPoint(con_x, con_y)
    if(!e) return;
    let file_path = `public/${current_dir}${e.textContent}`.split(" -")[0]

    if(action === "delete") {
        try {
            const res = await fetch(getApiLink("/file/delete"), {
            method: "POST",
            headers: {
                "Content-Disposition": `attachment; filepath=${file_path}`
            }
            });

            if (!res.ok) return;
            fetchDataFromServer();
        }  
        catch (err) {
            return;
        }
    } else if (action === "download") {
        try {
          const res = await fetch(getApiLink("/file/download"), {
            method: "GET",
            headers: {
              "Content-Disposition": `attachment; filepath=${file_path}`
            }
          });
      
          if (!res.ok || !res.body) return;
      
          const total = Number(res.headers.get("Content-Length"));
          let received = 0;
      
          const reader = res.body.getReader();
          const chunks = [];
      
          const progressEl = document.getElementById("downloadProgress");
          const progressElContainer = document.getElementById("downloadProgressContainer");
          if (progressEl) progressEl.value = 0;
          progressElContainer.style.display = "block";
      
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
      
            chunks.push(value);
            received += value.length;
      
            if (progressEl && total) {
              progressEl.value = Math.round((received / total) * 100);
              console.log(progressEl)
            }
          }
      
          const blob = new Blob(chunks);
          const url = URL.createObjectURL(blob);
      
          const a = document.createElement("a");
          a.href = url;
          a.download = file_path.split("/").pop();
          document.body.appendChild(a);
          a.click();
      
          URL.revokeObjectURL(url);
          a.remove();
          progressElContainer.style.display = "none";
        } catch (err) {
          console.error("Download failed", err);
          return;
        }
    } else if (action === "rename") {
        renameTargetPath = `public/${current_dir}${e.textContent}`.split(" -")[0];
        renameInput.value = renameTargetPath.split("/").pop();

        renameOverlay.style.display = "flex";
        renameInput.focus();
    } else if(action === "link") {
        let url_path = `${location.protocol}//api.${location.host}` + "/file/fetch/" + file_path.split("public/")[1]
        url_path = url_path.replace("fetch//", "fetch/")
        await navigator.clipboard.writeText(url_path);
    }
    hideMenu();
}

async function fetchDataFromServer() {
    current_dir = dirInput.value.trim() + "/";
    const response = await fetch(getApiLink("/file/query"), {
        method: "GET",
        headers: {
          "Content-Disposition": `attachment; filepath=${current_dir}`
        }
      });
    const data = await response.json();
    
    
    container.innerHTML = ""
    if(data.length == 0) container.innerHTML += `<p class="basic-text unselectable">no files found :(</p>`
    for(let i = 0; i < data.length; i++) {
        let file_name = data[i][0].split("/").at(-1);
        let file_size = data[i][1];
        let file_size_text = `${file_size}b`;
        let element;
        if(banned_click_extensions.some(v => file_name.includes(v))) {
            element = document.createElement("p")
        } else {
            element = document.createElement("a")
        }
        element.classList.add("link", "unselectable")
        let file_path = current_dir + file_name
        if(file_path[0] == "/") file_path = file_path.slice(1)
        element.href = getApiLink(`/file/fetch/${file_path}`)
        if(file_size >= 1000) { // kb
            file_size_text = `${(file_size/1024).toFixed(2)}kb`;
        } if(file_size >= 1000000) { //mb
            file_size_text = `${((file_size/1024)/1024).toFixed(2)}mb`;
        } if(file_size >= 1000000000) {
            file_size_text = `${(((file_size/1024)/1024)/1024).toFixed(2)}gb`;
        }
        element.dataset.size = file_size_text;
        element.textContent = `${file_name}`
        container.appendChild(element)
        element.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            
            showMenu(e.pageX, e.pageY, file_size_text);
        })
    }
}

document.addEventListener("click", function(e) {
    if (e.button === 0) { // Check for left mouse button click
        hideMenu();
    }
});

document.addEventListener("dragover", (e) => {
    e.preventDefault();
});

document.addEventListener("drop", async (e) => {
    e.preventDefault();

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    try {
        for (const file of files) {
            let file_name = file.name;
            if(file.name.includes(".big")) {
                file_name = file.name.replace(".big", "").split(".").slice(0, -1).join(".");
            } else if(file.size > 25000000) {
                alert(`${file.name.replaceAll(" ", "_")} is too big (25mb max)`)
                continue;
            }
           
            const res = await fetch(getApiLink("/file/upload"), {
                method: "POST",
                headers: {
                    "Content-Disposition": `attachment; filename=${current_dir + file_name}`,
                    "Content-Type": "application/octet-stream"
                },
                body: file
            });

            if (!res.ok) {
                console.error(`Upload failed for ${file.name}`);
            }
        }

        fetchDataFromServer();
    } catch (err) {
        console.error(err);
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        cancelRename();
    }
    if (e.key === "Enter") {
        confirmRename();
    }
});

document.getElementById("download").addEventListener("click", () => { menuAction("download") });
document.getElementById("delete").addEventListener("click", () => { menuAction("delete") });
document.getElementById("rename").addEventListener("click", () => { menuAction("rename") });
document.getElementById("link").addEventListener("click", () => { menuAction("link") });
document.getElementById("close").addEventListener("click", () => { menuAction("close") });

document.getElementById("confirmRename").addEventListener("click", () => { confirmRename() });
document.getElementById("cancelRename").addEventListener("click", () => { cancelRename() });

dirInput.addEventListener("change", () => { 
    dirInput.value = dirInput.value.replaceAll(".", "").replaceAll("/", "");
    fetchDataFromServer();
})

fetchDataFromServer();
hideMenu();