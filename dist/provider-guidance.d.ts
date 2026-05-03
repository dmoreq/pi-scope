/**
 * Provider Guidance — load provider-specific guidance files (CLAUDE.md,
 * CODEX.md, GEMINI.md) based on the active model provider, for injection
 * into the system prompt.
 *
 * Ported from pi-me session-lifecycle/agent-guidance/agent-guidance.ts
 * ──────────────────────────────────────────────────────────────────────
 * Maps the model provider → filename(s), walks ancestor directories
 * (including the global agent dir) to discover matching files, and
 * deduplicates against AGENTS.md.
 *
 * Config overrides via ~/.pi/agent/agent-guidance.json:
 *   { "providers": { "anthropic": ["CUSTOM.md"] },
 *     "models": { "claude-sonnet-*": ["SONNET.md"] } }
 */
export interface ProviderGuidanceOptions {
    /** Whether to inject provider-specific guidance. */
    enabled: boolean;
}
export interface ProviderGuidanceFile {
    /** Absolute path of the discovered file. */
    path: string;
    /** File contents. */
    content: string;
}
export declare const DEFAULT_PROVIDER_GUIDANCE_OPTIONS: ProviderGuidanceOptions;
/**
 * Load provider guidance files for the given model provider.
 *
 * @param cwd      Current working directory
 * @param provider Model provider string (e.g. "anthropic", "openai")
 * @param modelId  Model ID (for glob-matching config overrides)
 * @returns Array of loaded files (path + content)
 */
export declare function loadProviderGuidance(cwd: string, provider: string, modelId?: string): ProviderGuidanceFile[];
/**
 * Format loaded provider guidance files into a section suitable for
 * system prompt injection.
 */
export declare function formatProviderGuidanceSection(files: ProviderGuidanceFile[]): string;
/**
 * Build a startup notification message listing loaded provider guidance files.
 */
export declare function buildGuidanceNotification(files: ProviderGuidanceFile[], cwd: string): string;
