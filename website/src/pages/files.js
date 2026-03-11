const { getApiLink, setCookie, getCookie, refreshAccount, getAccountCredentials } = await import('./common.js');

const contextMenu = document.getElementById("context");
let con_x, con_y;

const renameOverlay = document.getElementById("rename-overlay");
const renameInput = document.getElementById("rename-input");
let renameTargetPath = null;

const file_size_p = document.getElementById("file-size")

let current_dir = "/";
let dirInput = document.getElementById("dir-input")

const container = document.getElementById("file-container")
const protect_check_div = document.getElementById("protected-div");
const protect_check = document.getElementById("protected");
protect_check_div.style.display = "none";
const host_check = document.getElementById("host");
const host_check_div = document.getElementById("host-div");
host_check_div.style.display = "none";

const banned_click_extensions = [".rar", ".zip", ".gzip", ".7z"]

if(window.localStorage.getItem("user") == null) {
    alert("make an account")
    window.location.href = `${location.protocol}//${location.host}/?account`;
}

function showMenu(x, y, file_size) {
    con_x = x-1;
    con_y = y-1;
    file_size_p.textContent = file_size;
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

document.getElementById("delete").addEventListener("click", () => { menuAction("delete"); })
document.getElementById("rename").addEventListener("click", () => { menuAction("rename"); })
document.getElementById("link").addEventListener("click", () => { menuAction("link"); })
document.getElementById("download").addEventListener("click", () => { menuAction("download"); })

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

async function confirmPassword() {
    let response = await fetch(getApiLink("/file/unprotect"), {
        method: "POST",
        headers: {
          "Content-Disposition": `attachment; filepath=/${current_dir.slice(0, -1)};password=${passwordInput.value.trim()}`
        }
    });
    if(response.status == 200) {
        cancelPassword();
        await fetchDataFromServer(); 
        return;
    } else {
        passwordInput.value = "";
        alert("incorrect password");
    }
}

function cancelPassword() {
    passwordOverlay.style.display = "none";
    passwordInput.value = "";
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
        url_path
        await navigator.clipboard.writeText(url_path);
    }
    hideMenu();
}

async function fetchDataFromServer() {
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    current_dir = dirInput.value.trim() + "/";
    if(dirInput.value.trim() != "") protect_check_div.style.display = "block";
    else protect_check_div.style.display = "none";
    host_check_div.style.display = "none";
    protect_check.checked = false;
    const response = await fetch(getApiLink("/file/query"), {
        method: "POST",
        body: JSON.stringify({
            "name": saved_data["account"]["name"],
            "pass": saved_data["account"]["pass"],
            "folder": current_dir.slice(0, -1),
        })
    });
    fetch(getApiLink("/file/protected"), {
        method: "POST",
        body: JSON.stringify({
            "folder": current_dir.slice(0, -1)
        })
    }).then((response) => {
        if(response.status == 200) protect_check.checked = true;
        else {
            protect_check.checked = false;
        }
    });
    
    fetch(getApiLink("/hosting/query"), {
        method: "GET",
        headers: {
          "Content-Disposition": `attachment; filepath=${current_dir.slice(0, -1)}`
        }
    }).then((response) => {
        if(response.status == 200) host_check.checked = true;
        else host_check.checked = false;
    });

    if((protect_check.checked && !saved_data["ownedFolders"].includes(current_dir.slice(0, -1))) || response.status == 401) {
        container.innerHTML = `<p class="basic-text unselectable">PROTECTED DIRECTORY</p>`
        return;
    }
    const data = await response.json();
    
    container.innerHTML = ""
    if(data.length == 0) container.innerHTML += `<p class="basic-text unselectable">no files found :(</p>`
    for(let i = 0; i < data.length; i++) {
        let file_name = data[i][0].split("/").at(-1);
        if(file_name == "index.html") { 
            host_check_div.style.display = "block";
        }
        let file_size = data[i][1];
        let file_size_text = `${file_size}b`;
        let element;
        element = document.createElement("p")
        element.classList.add("link", "unselectable")
        let file_path = current_dir + file_name
        if(file_path[0] == "/") file_path = file_path.slice(1)
        if(file_size >= 1000) { // kb
            file_size_text = `${(file_size/1024).toFixed(2)}kb`;
        } if(file_size >= 1000000) { //mb
            file_size_text = `${((file_size/1024)/1024).toFixed(2)}mb`;
        } if(file_size >= 1000000000) { //gb
            file_size_text = `${(((file_size/1024)/1024)/1024).toFixed(2)}gb`;
        }
        element.dataset.size = file_size_text;
        element.textContent = `${file_name}`
        container.appendChild(element)
        if(!banned_click_extensions.some(v => file_name.includes(v))) {
            element.addEventListener("click", async (e) => {
                let password = getCookie(`/${current_dir.slice(0, -1)}`) || ""
                let url_path = `${location.protocol}//api.${location.host}/file/fetch/${file_path}`
                url_path = url_path.replace("fetch//", "fetch/")
                window.open(url_path);
            })
        }
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
            file_name.replaceAll(" ", "_");
            if(file.name.includes(".big")) {
                file_name = file.name.replace(".big", "").split(".").slice(0, -1).join(".");
            } else if(file.size > 50000000) {
                alert(`${file.name.replaceAll(" ", "_")} is too big (50mb max)`)
                continue;
            }
           
            const res = await fetch(getApiLink("/file/upload"), {
                method: "POST",
                headers: {
                    "Content-Disposition": `attachment; filename=${current_dir + file_name};password=${getCookie(`/${current_dir.slice(0, -1)}`) || ""}`,
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

dirInput.addEventListener("change", () => { 
    dirInput.value = dirInput.value.replaceAll(".", "").replaceAll("/", "");
    fetchDataFromServer();
})

protect_check.addEventListener("change", async (e) => {
    e.preventDefault();
    let saved_data = JSON.parse(window.localStorage.getItem("user"));
    let creds = JSON.stringify({"name": saved_data["account"]["name"], "pass": saved_data["account"]["pass"], "folder": current_dir.slice(0, -1)});
    let response = await fetch(getApiLink("/file/protect"), {
        method: "POST",
        body: creds
    });
    if(response.status == 200) {
        //alert(`protected folder "${current_dir.slice(0, -1)}"`);
        protect_check.checked = true;
    } else if(response.status == 400) {
        response = await fetch(getApiLink("/file/unprotect"), {
            method: "POST",
            body: creds
        });
        if(response.status == 200) {
            //alert(`unprotected folder "${current_dir.slice(0, -1)}"`);
            protect_check.checked = false;
        } else {
            protect_check.checked = true;
            return;
        }
    }
    refreshAccount();
})

host_check.addEventListener("change", async (e) => {
    await fetch(getApiLink("/hosting/toggle"), {
        method: "POST",
        headers: {
          "Content-Disposition": `attachment; filepath=/${current_dir.slice(0, -1)}`
        }
    });
})

fetchDataFromServer();
hideMenu();