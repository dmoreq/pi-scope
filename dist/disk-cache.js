import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { CACHE_VERSION } from './types.js';
export class DiskCache {
    cachePath;
    entries = new Map();
    constructor(projectRoot) {
        this.cachePath = join(projectRoot, '.pi-cache', 'smart-context.json');
    }
    async load() {
        try {
            const raw = await readFile(this.cachePath, 'utf-8');
            const data = JSON.parse(raw);
            if (data.version !== CACHE_VERSION) {
                this.entries = new Map();
                return;
            }
            this.entries = new Map(Object.entries(data.entries));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('[DiskCache] Failed to load cache, starting fresh:', err);
            }
            this.entries = new Map();
        }
    }
    async save() {
        await mkdir(dirname(this.cachePath), { recursive: true });
        const data = {
            version: CACHE_VERSION,
            entries: Object.fromEntries(this.entries),
        };
        const tmp = this.cachePath + '.tmp';
        try {
            await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
            await rename(tmp, this.cachePath);
        }
        catch (err) {
            await unlink(tmp).catch(() => { });
            throw err;
        }
    }
    get(path) {
        return this.entries.get(path);
    }
    set(index) {
        this.entries.set(index.path, index);
    }
    delete(path) {
        this.entries.delete(path);
    }
}
