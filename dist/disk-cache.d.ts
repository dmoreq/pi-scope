import type { FileIndex } from './types.js';
export declare class DiskCache {
    private readonly cachePath;
    private entries;
    constructor(projectRoot: string);
    load(): Promise<void>;
    save(): Promise<void>;
    get(path: string): FileIndex | undefined;
    set(index: FileIndex): void;
    delete(path: string): void;
}
