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

// ── Types ─────────────────────────────────────────────────────────────────

export interface PipelineSource {
  /** Unique name (used for dedup and stats). */
  name: string
  /**
   * Priority (lower = higher priority).
   * High-priority sources are injected first and trimmed last.
   * Recommended: 1=repo-map, 2=dep-context, 3=provider-guidance, 4=context-files
   */
  priority: number
  /**
   * Produce the content to inject. Return null/empty to skip.
   * Called once per `build()` invocation.
   */
  produce(): string | null
}

export interface PipelineOptions {
  /**
   * Maximum estimated tokens for the combined output.
   * Default: 12000 (repo-map + injection budgets combined).
   */
  maxTokens?: number
}

export interface PipelineBuildResult {
  /** Combined injection content (empty if nothing to inject). */
  content: string
  /** Per-source stats. */
  sources: Array<{
    name: string
    injected: boolean
    tokens: number
    trimmed: boolean
  }>
  /** Total estimated tokens of the combined content. */
  totalTokens: number
}

// ── Pipeline ──────────────────────────────────────────────────────────────

export class InjectionPipeline {
  private sources: PipelineSource[] = []

  // ── Registration ─────────────────────────────────────────────────────

  /**
   * Register an injection source. Sources are de-duplicated by name —
   * registering a source with the same name as an existing one overwrites it.
   */
  register(source: PipelineSource): void {
    const existing = this.sources.findIndex(s => s.name === source.name)
    if (existing >= 0) {
      this.sources[existing] = source
    } else {
      this.sources.push(source)
    }
  }

  /**
   * Remove a registered source by name.
   */
  unregister(name: string): void {
    this.sources = this.sources.filter(s => s.name !== name)
  }

  /**
   * Check if all registered sources have been produced (isEmpty check).
   */
  isEmpty(): boolean {
    return this.sources.length === 0
  }

  /**
   * Clear all registered sources.
   */
  clear(): void {
    this.sources = []
  }

  // ── Build ────────────────────────────────────────────────────────────

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
  build(maxTokens?: number): PipelineBuildResult {
    if (this.sources.length === 0) {
      return { content: '', sources: [], totalTokens: 0 }
    }

    // ── Step 1: Probe all sources ──────────────────────────────────────
    const entries: Array<{
      source: PipelineSource
      content: string
      tokens: number
    }> = []

    for (const source of this.sources) {
      const content = source.produce()
      if (!content) continue
      entries.push({
        source,
        content,
        tokens: estimateTokens(content),
      })
    }

    if (entries.length === 0) {
      return { content: '', sources: [], totalTokens: 0 }
    }

    // ── Step 2: Sort by priority (ascending) ───────────────────────────
    entries.sort((a, b) => a.source.priority - b.source.priority)

    // ── Step 3 & 4: Concatenate, trimming if over budget ──────────────
    const budget = maxTokens ?? Number.POSITIVE_INFINITY
    const parts: string[] = []
    let totalTokens = 0
    const sourceStats: Array<{
      name: string
      injected: boolean
      tokens: number
      trimmed: boolean
    }> = []

    for (const entry of entries) {
      const wouldBe = totalTokens + entry.tokens

      if (wouldBe > budget && parts.length > 0) {
        // Over budget — trim this and all lower-priority sources
        sourceStats.push({
          name: entry.source.name,
          injected: false,
          tokens: entry.tokens,
          trimmed: true,
        })
        continue
      }

      parts.push(entry.content)
      totalTokens = wouldBe
      sourceStats.push({
        name: entry.source.name,
        injected: true,
        tokens: entry.tokens,
        trimmed: false,
      })
    }

    return {
      content: parts.join('\n\n'),
      sources: sourceStats,
      totalTokens,
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
