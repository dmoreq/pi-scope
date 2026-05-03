import type { RepoIndex } from './types.js';
interface Message {
    role: string;
    content: string | Array<{
        type: string;
        text?: string;
    }>;
}
export declare class ContextInjector {
    private readonly projectRoot;
    private readonly maxTokens;
    private readonly scanLastN;
    constructor(projectRoot: string, maxTokens: number, scanLastN: number);
    buildInjection(index: RepoIndex, messages: Message[], extraPaths?: Set<string>): string;
    private detectInFocusFiles;
}
export {};
