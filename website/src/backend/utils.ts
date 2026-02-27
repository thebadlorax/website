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