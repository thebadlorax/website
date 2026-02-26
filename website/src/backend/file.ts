/**
 * author thebadlorax
 * created on 24-02-2026-16h-53m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { rename } from 'fs';
import { rm, stat, mkdir } from "node:fs/promises";

export async function isDirectory(path: string) {
    try {
      const stats = await stat(path);
      return stats.isDirectory();
    } catch (error) {
      // Handle error if the path does not exist or other issues occur
      throw(error);
    }
}
  
export async function createDirectory(dirPath: string) {
    try {
      // The recursive: true option ensures parent directories are created if they don't exist
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw error;
    }
}
  
export async function deleteFile(filePath: string) {
    let is_dir = await isDirectory(filePath);
    if(is_dir) {
      try {
        await rm(filePath, {
          recursive: true, // Required for deleting subdirectories and files
          force: true,     // Prevents errors if the directory doesn't exist
        });
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
  
export async function renameFile(filePath: string, newName: string) {
    rename(filePath, newName, (err) => {
      if (err) throw err;
    });
}

export async function createFile(filePath: string, content: string = "") { if(!await Bun.file(filePath).exists()) { await Bun.file(filePath).write(`${content}`); return true;} return false;}