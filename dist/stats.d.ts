/**
 * Session-scoped usage statistics for the smart-context extension.
 *
 * Tracks every injection and persists a summary to
 * .pi/smart-context/stats.jsonl (one JSON line per session) so you can
 * review historical usage across sessions.
 */
export interface SessionRecord {
    sessionId: string;
    startedAt: string;
    endedAt: string;
    indexSource: 'cache' | 'fresh';
    indexedFiles: number;
    depEdges: number;
    repoMapTokens: number;
    depContextTriggers: number;
    depContextTotalTokens: number;
    uniqueFilesInjected: number;
    topFiles: {
        file: string;
        mentions: number;
    }[];
    contextFilesTokens: number;
    contextFilesCount: number;
    providerGuidanceTokens: number;
    providerGuidanceCount: number;
}
export declare class SessionStats {
    readonly sessionId: string;
    readonly startedAt: number;
    indexSource: 'cache' | 'fresh';
    indexedFiles: number;
    depEdges: number;
    repoMapTokens: number;
    contextFilesTokens: number;
    contextFilesCount: number;
    providerGuidanceTokens: number;
    providerGuidanceCount: number;
    depContextTriggers: number;
    depContextTotalTokens: number;
    private mentionCounts;
    private injectedFiles;
    constructor(sessionId: string);
    /** Call when the repo map is injected into the system prompt. */
    recordRepoMapInjection(tokens: number): void;
    /**
     * Call each time dep-context is injected before an LLM call.
     * @param injectedFilePaths  Absolute or relative paths of files in the block.
     * @param tokens             Estimated token count of the injected block.
     */
    recordDepContextInjection(injectedFilePaths: string[], tokens: number): void;
    /**
     * Call when context files (AGENTS.local.md, CLAUDE.md) are injected
     * into the system prompt.
     * @param tokens  Estimated token count of the injected block.
     * @param count   Number of context files loaded.
     */
    recordContextFilesInjection(tokens: number, count: number): void;
    /**
     * Call when provider-specific guidance files (CLAUDE.md, CODEX.md,
     * GEMINI.md) are injected into the system prompt.
     * @param tokens  Estimated token count of the injected block.
     * @param count   Number of provider guidance files loaded.
     */
    recordProviderGuidanceInjection(tokens: number, count: number): void;
    /** Returns a one-line human-readable summary of the current session. */
    summary(): string;
    /** Returns a multi-line formatted report for display. */
    report(): string;
    /** Serialise to a StoredRecord for persistence. */
    toRecord(): SessionRecord;
    /**
     * Append this session's record to .pi/smart-context/stats.jsonl and
     * save the latest session state to state.json for cross-session access.
     */
    persist(projectRoot: string): Promise<void>;
}
