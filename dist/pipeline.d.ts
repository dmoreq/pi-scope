/**
 * Injection Pipeline — orchestrates all context injection sources.
 *
 * Collects multiple sources (repo-map, context-files, provider-guidance,
 * dep-context), orders by priority, trims to a shared token budget,
 * and produces a single combined block for system prompt injection.
 *
 * Usage:
 *   const pipeline = new InjectionPipeline()
 *   pipeline.register({ name: 'repo-map', priority: 1, produce: () => repoMap })
 *   pipeline.register({ name: 'context-files', priority: 4, produce: () => section })
 *   const block = pipeline.build(12000)  // total token budget
 *   // → 'repo-map content\n\ncontext-files content' (trimmed if over budget)
 */
export interface PipelineSource {
    /** Unique name (used for dedup and stats). */
    name: string;
    /**
     * Priority (lower = higher priority).
     * High-priority sources are injected first and trimmed last.
     * Recommended: 1=repo-map, 2=dep-context, 3=provider-guidance, 4=context-files
     */
    priority: number;
    /**
     * Produce the content to inject. Return null/empty to skip.
     * Called once per `build()` invocation.
     */
    produce(): string | null;
}
export interface PipelineOptions {
    /**
     * Maximum estimated tokens for the combined output.
     * Default: 12000 (repo-map + injection budgets combined).
     */
    maxTokens?: number;
}
export interface PipelineBuildResult {
    /** Combined injection content (empty if nothing to inject). */
    content: string;
    /** Per-source stats. */
    sources: Array<{
        name: string;
        injected: boolean;
        tokens: number;
        trimmed: boolean;
    }>;
    /** Total estimated tokens of the combined content. */
    totalTokens: number;
}
export declare class InjectionPipeline {
    private sources;
    /**
     * Register an injection source. Sources are de-duplicated by name —
     * registering a source with the same name as an existing one overwrites it.
     */
    register(source: PipelineSource): void;
    /**
     * Remove a registered source by name.
     */
    unregister(name: string): void;
    /**
     * Check if all registered sources have been produced (isEmpty check).
     */
    isEmpty(): boolean;
    /**
     * Clear all registered sources.
     */
    clear(): void;
    /**
     * Build the combined injection content.
     *
     * 1. Probes all sources (calls `produce()` on each)
     * 2. Sorts by priority ascending
     * 3. Concatenates in priority order
     * 4. Trims lowest-priority content if over `maxTokens`
     *
     * @param maxTokens  Token budget for the combined output.
     *                   If omitted, no trimming is applied.
     * @returns Build result with content, per-source stats, and total token count.
     */
    build(maxTokens?: number): PipelineBuildResult;
}
