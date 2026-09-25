/**
 * author thebadlorax
 * created on 12-06-2026-15h-41m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

export class Loader {
    images;

    constructor() { this.images = {}; }; 

    loadImage(key, src) {
        var img = new Image();
    
        var d = new Promise(function (resolve, reject) {
            img.onload = function () {
                this.images[key] = img;
                resolve(img);
            }.bind(this);
    
            img.onerror = function () {
                reject('Could not load image: ' + src);
            };
        }.bind(this));
    
        img.src = src;
        return d;
    };

    getImage(key) { return (key in this.images) ? this.images[key] : null; };

    imageSet(...images) {
        let a = [];
        images.forEach(i => {
            a.push(this.getImage(i))
        })
        return a;
    }
};

export const generateRandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
    return result;
}

export const getRandomFromList = (list) => {
    return list[Math.floor(Math.random()*list.length)]
}

export const getRandomName = () => {
    const prefix = [
        "immediate",
        "careless",
        "female",
        "eminent",
        "psychotic",
        "perpetual",
        "abrupt",
        "dispensable",
        "hospitable",
        "standing",
        "living",
        "probable",
        "mighty",
        "guttural",
        "kaput",
        "empty",
        "unarmed",
        "swift",
        "ceaseless",
        "bad",
        "painstaking",
        "puzzling",
        "acid",
        "loose",
        "eager",
        "oceanic",
        "rigid",
        "frightening",
        "like",
        "spotless"
    ]
    const suffix = [
        "meaning",
        "role",
        "version",
        "hair",
        "mud",
        "speech",
        "politics",
        "poetry",
        "speaker",
        "patience",
        "elevator",
        "university",
        "measurement",
        "trainer",
        "editor",
        "policy",
        "actor",
        "decision",
        "industry",
        "requirement",
        "operation",
        "transportation",
        "teacher",
        "energy",
        "attention",
        "extent",
        "procedure",
        "meat",
        "writing",
        "internet"
    ]

    let pre = getRandomFromList(prefix);
    let suf = getRandomFromList(suffix);
    return `${pre.charAt(0).toUpperCase() + pre.slice(1)}${suf.charAt(0).toUpperCase() + suf.slice(1)}`
}

export function drawRotatedImage(ctx, img, x, y, width, height, degrees) {
    const radians = degrees * Math.PI / 180;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
  
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(radians);
    ctx.drawImage(img, -width / 2, -height / 2, width, height); // big geep told me this was the method
    ctx.restore();
}

export const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;

    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const easeInBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;

    return c3 * t * t * t - c1 * t * t;
}

export async function gzipCompressString(str) {
    const input = new TextEncoder().encode(str);
    const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("gzip"));
    const compressedBuffer = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(compressedBuffer);

    // b64
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}; 
export async function gzipDecompressString(base64) {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
};

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

            resolve(file);
        };

        input.click();
    });
}