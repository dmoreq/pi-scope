import type { RepoIndex } from './types.js';
export declare class RepoMapGenerator {
    private readonly projectRoot;
    private readonly maxTokens;
    constructor(projectRoot: string, maxTokens: number);
    generate(index: RepoIndex): string;
}
