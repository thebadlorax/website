/**
 * author thebadlorax
 * created on 24-02-2026-16h-51m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { watch, type FSWatcher } from 'fs';
import { resolve } from 'node:path';

import { LogWizard } from './logging';

export class CacheWizard {
    private fileCache: Map<string, { content: Uint8Array, type: string, etag: string, lastModified: string }>
    private roots: Map<string, FSWatcher>
    private log: LogWizard

    constructor() {
        this.fileCache = new Map();
        this.roots = new Map();
        this.log = new LogWizard();
        this.log.log("Initialized", "CACHEWIZARD")
    }

    fileInCache(path: string) { return this.fileCache.has(path); }
    getCachedFile(path: string) { return this.fileCache.get(path); }

    getRoots() { return this.roots.keys(); }

    addToCache(path: string, file: { content: Uint8Array, type: string, etag: string, lastModified: string }) { /*this.fileCache.set(path, file);*/ }

    addRoot(root: string) {
        try {
            root = resolve(root);
            this.log.log(`Adding root to cache: ${root}`, "CACHEWIZARD");
            let watcher = watch(root, { recursive: true }, (filename) => {
                if (!filename) return;
                const path = resolve(root, filename);
                if (this.fileCache.has(path)) {
                  this.fileCache.delete(path);
                  this.log.log(`Cleared cache for ${path}`, "CACHEWIZARD")
                }
            });
            this.roots.set(root, watcher);
        } catch (error) {
            this.log.error("cache reload failed: " + error, "CACHEWIZARD", "CACHING")
        }
    }

    removeRoot(root: string) { this.roots.get(root)?.close(); }
}

