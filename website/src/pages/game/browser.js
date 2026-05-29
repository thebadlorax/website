/**
 * author thebadlorax
 * created on 06-05-2026-22h-35m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

export function downloadBlob(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    document.body.appendChild(link);
    link.click();
    
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
}

export async function pickFile() {
    const input = document.createElement("input");

    input.type = "file";

    return new Promise((resolve, reject) => {
        input.onchange = () => {
            const file = input.files?.[0];

            if (!file) {
                reject(new Error("No file selected"));
                return;
            }

            resolve(file); // File is a Blob subclass
        };

        input.click();
    });
}

export async function setValueInStorage(name, val) { window.localStorage.setItem(name, val); };
export async function getValueInStorage(val) { return window.localStorage.getItem(val); };
export async function deleteValueInStorage(val) { return window.localStorage.removeItem(val); };