// @ts-nocheck
/**
 * author thebadlorax
 * created on 24-02-2026-16h-49m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { corsResponse } from "./connectivity";

export const generateRandomString = (length: number) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
    return result;
}

export function* range(start: number, end: number, step = 1) { for (let i = start; i < end; i += step) { yield i; } } 

export function sanitize(str: string) { return str.replaceAll("\\", "").replaceAll(":", "").replaceAll("#", "")}

export function isValidJSON(str: string) {
    if (typeof str !== 'string' || str.trim() === '') {
      return false;
    }
  
    try {
      JSON.parse(str);
      return true;
    } catch (error) {
      return false; // invalid
    }
}

export async function streamToBlob(stream: ReadableStream, mimeType?: string) {
    const response = corsResponse(stream, {
      headers: {
        'Content-Type': mimeType || 'application/octet-stream'
      }
    });
  
    const blob = await response.blob();
    return blob;
}

export const getSubdomain = (hostname: string) => {
    const parts = hostname.split('.');
  
    if(hostname.includes("66.65.25.15")) {
      if (parts.length > 2) {
        return parts.slice(0, -5).join('.');
      }
    } else {
      if (parts.length > 2) {
        return parts.slice(0, -2).join('.');
      }
    }
  
    return ''; 
};

export const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

export async function getImageSize(url: string) {
  const file = Bun.file(url);
  const buffer = new Uint8Array(await file.arrayBuffer());

  // --- PNG ---
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width =
      (buffer[16] << 24) |
      (buffer[17] << 16) |
      (buffer[18] << 8) |
      buffer[19];

    const height =
      (buffer[20] << 24) |
      (buffer[21] << 16) |
      (buffer[22] << 8) |
      buffer[23];

    return { width, height, type: "png" };
  }

  // --- JPEG ---
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;

    while (i < buffer.length) {
      if (buffer[i] !== 0xff) {
        i++;
        continue;
      }

      const marker = buffer[i + 1];
      const length = (buffer[i + 2] << 8) + buffer[i + 3];

      // SOF markers (where dimensions are stored)
      if (
        marker === 0xc0 ||
        marker === 0xc2 ||
        marker === 0xc1
      ) {
        const height = (buffer[i + 5] << 8) + buffer[i + 6];
        const width = (buffer[i + 7] << 8) + buffer[i + 8];

        return { width, height, type: "jpeg" };
      }

      i += 2 + length;
    }
  }

  throw new Error("Unsupported image format");
}