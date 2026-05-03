import type { RepoIndex, SmartContextConfig } from './types.js';
export declare class IndexEngine {
    private readonly projectRoot;
    private readonly config;
    private readonly parsers;
    private readonly cache;
    private repoIndex;
    constructor(projectRoot: string, config: SmartContextConfig);
    build(): Promise<void>;
    private buildGraph;
    getRepoIndex(): RepoIndex;
}
