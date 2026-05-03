export interface FileIndex {
    path: string;
    skeleton: string;
    imports: string[];
    contentHash: string;
}
export interface RepoIndex {
    skeletons: Map<string, string>;
    deps: Map<string, Set<string>>;
    reverseDeps: Map<string, Set<string>>;
}
export interface SmartContextConfig {
    enabled: boolean;
    maxRepoMapTokens: number;
    maxInjectionTokens: number;
    scanLastNMessages: number;
    exclude: string[];
    /** Context files (AGENTS.local.md, CLAUDE.md, etc.) injected into system prompt. */
    contextFiles: {
        enabled: boolean;
        /** Filenames to search for at every ancestor directory level. */
        filenames: string[];
        /** Section title in the injected block. */
        sectionTitle: string;
    };
    /**
     * Provider-specific guidance files (CLAUDE.md, CODEX.md, GEMINI.md)
     * injected based on the active model provider.
     */
    providerGuidance: {
        enabled: boolean;
    };
}
export declare const DEFAULT_CONFIG: SmartContextConfig;
export interface CacheFile {
    version: number;
    entries: Record<string, FileIndex>;
}
export declare const CACHE_VERSION = 1;
