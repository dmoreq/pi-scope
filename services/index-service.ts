/**
 * IndexService — owns the index lifecycle: build, cache, load, freshness.
 *
 * SRP: Only responsible for creating and managing the RepoIndex.
 * All other concerns (context, graph, telemetry) belong in other services.
 */

import type { RepoIndex, SlimConfig } from '../shared/types.js'
import { IndexEngine } from '../indexer/engine.js'
import { RepoMapGenerator } from '../context/repo-map.js'
import { storeExists, saveStore, loadStore } from '../indexer/index-store.js'
import { collectMetadata } from '../indexer/metadata.js'
import { type StoredIndexV2, extractMetadata, type IndexMetadata } from '../shared/schema-v2.js'

export interface IndexResult {
  index: RepoIndex
  repoMap: string
  metadata: IndexMetadata
  builtAt: number
  fileCount: number
  buildTimeMs: number
}

export class IndexService {
  private _index: RepoIndex | null = null
  private _repoMap: string | null = null
  private _metadata: IndexMetadata | null = null

  get index(): RepoIndex | null { return this._index }
  get repoMap(): string | null { return this._repoMap }
  get metadata(): IndexMetadata | null { return this._metadata }

  /**
   * Try loading index from cache. Returns true if cache hit.
   */
  async loadFromCache(projectRoot: string): Promise<boolean> {
    if (!await storeExists(projectRoot)) return false
    try {
      const result = await loadStore(projectRoot)
      this._index = result.index
      this._repoMap = result.repoMap
      this._metadata = extractMetadata(result.metadata)
      return true
    } catch {
      return false
    }
  }

  /**
   * Build fresh index from scratch.
   */
  async buildFresh(projectRoot: string, config: SlimConfig): Promise<IndexResult> {
    const engine = new IndexEngine(projectRoot, config)
    const buildStartTime = Date.now()

    await engine.build()
    const index = engine.getRepoIndex()

    const repoMap = new RepoMapGenerator(projectRoot, config.maxRepoMapTokens).generate(index)
    const rawMetadata = collectMetadata(projectRoot, index, config, buildStartTime) as any

    // Save to cache
    await saveStore(projectRoot, index, repoMap, rawMetadata)

    this._index = index
    this._repoMap = repoMap
    this._metadata = extractMetadata(rawMetadata)

    return {
      index,
      repoMap,
      metadata: this._metadata!,
      builtAt: buildStartTime,
      fileCount: index.skeletons.size,
      buildTimeMs: Date.now() - buildStartTime,
    }
  }
}
