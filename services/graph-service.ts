/**
 * GraphService — owns all graph analysis: loading, algorithms, caching, metadata.
 *
 * SRP: Only responsible for graph analysis.
 * OCP: Adding new algorithms doesn't require editing this service — algorithms
 * are standalone modules imported here.
 *
 * Algorithm pipeline (runs at startup when graph data is available):
 *   1. Load graph.json via graph-loader
 *   2. Degree Centrality + PageRank → god nodes
 *   3. Louvain → communities
 *   4. DFS + Tarjan SCC → cycles
 *   5. Surprise detection → cross-community edges
 *   6. Cache results for fast reload
 */

import type { RepoIndex } from '../shared/types.js'
import type { GraphifyGraph, GraphifyAnalysis } from '../context/graph-types.js'
import { loadGraphifyJson, type LoadResult } from '../context/graph-loader.js'
import { saveGraphCache, loadGraphCache } from '../persistence/graph-cache.js'
import { repoIndexToGraphifyGraph } from '../graph/bridge.js'
import { assembleGraphifyAnalysis } from '../graph/analyzers/compute-graphify-analysis.js'
import { GraphAnalyzer } from '../graph/analyzers/graph-analyzer.js'
import { InMemoryAnalysisCache } from '../graph/cache/analysis-cache.js'
import type { Graph as AnalysisGraph } from '../graph/interfaces/analyzer.interface.js'
import { PathUtils } from '../shared/utils/path-utils.js'

export interface GraphResult {
  graph: GraphifyGraph
  analysis: GraphifyAnalysis
}

/**
 * Compute a fingerprint of the RepoIndex to use as cache key.
 * Changes when files/symbols/deps change, so cached analysis invalidates properly.
 */
function indexFingerprint(index: RepoIndex): string {
  const parts: string[] = []
  parts.push(`files:${index.skeletons.size}`)
  parts.push(`symbols:${index.symbolIndex.size}`)
  // Sum of dep edges as a quick checksum
  let depSum = 0
  for (const deps of index.deps.values()) depSum += deps.size
  parts.push(`deps:${depSum}`)
  return parts.join('|')
}

function graphifyStructureCacheKey(graph: GraphifyGraph): string {
  const content = JSON.stringify({
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodeIds: graph.nodes.map(n => n.id).sort(),
    edges: graph.edges.map(e => `${e.source}|${e.target}|${e.type}`).sort(),
  })
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `graphify-${Math.abs(hash)}`
}

export class GraphService {
  private _analysis: GraphifyAnalysis | null = null
  private _graph: GraphifyGraph | null = null
  private _source: 'external' | 'native' | null = null
  private readonly sessionAnalysisCache = new InMemoryAnalysisCache()
  private readonly graphAnalyzer: GraphAnalyzer

  constructor() {
    this.graphAnalyzer = new GraphAnalyzer(new InMemoryAnalysisCache())
  }

  get analysis(): GraphifyAnalysis | null { return this._analysis }
  get graph(): GraphifyGraph | null { return this._graph }
  get source(): 'external' | 'native' | null { return this._source }

  /**
   * Try loading from cache first, then fall back to full analysis.
   */
  async load(projectRoot: string, cacheDir: string): Promise<boolean> {
    // Load the raw graph from disk
    const graph = await this.loadGraphJson(projectRoot)
    if (!graph) return false

    this._graph = graph

    // Try cache
    const cached = await loadGraphCache(cacheDir, graph)
    if (cached) {
      this._analysis = cached
      return true
    }
    return false
  }

  /**
   * Run full graph analysis from graph.json (external graphify tool).
   */
  async analyze(projectRoot: string, cacheDir: string): Promise<GraphResult | null> {
    const graph = await this.loadGraphJson(projectRoot)
    if (!graph) return null

    const result = await this.runAlgorithms(graph)
    this._graph = graph
    this._analysis = result.analysis
    this._source = 'external'

    // Cache for next session
    await saveGraphCache(cacheDir, result.analysis, graph).catch(() => {})

    return result
  }

  /**
   * Run graph analysis natively from a RepoIndex (no external graphify needed).
   * Converts the index into a GraphifyGraph on the fly, runs all 5 algorithms,
   * and caches the result.
   */
  async analyzeFromIndex(
    index: RepoIndex,
    projectRoot: string,
    cacheDir: string,
  ): Promise<GraphResult> {
    const fp = indexFingerprint(index)

    // Try cache with index-fingerprinted key
    const cached = await loadGraphCache(cacheDir, undefined, fp)
    if (cached) {
      const cachedWithGraph = cached as GraphifyAnalysis & { _restoredGraph?: GraphifyGraph }
      this._graph = cachedWithGraph._restoredGraph ?? null
      this._analysis = cached
      this._source = 'native'
      return { graph: this._graph!, analysis: cached }
    }

    // Build GraphifyGraph from RepoIndex
    const graph = repoIndexToGraphifyGraph(index, projectRoot)
    this._graph = graph

    const result = await this.runAlgorithms(graph)
    this._analysis = result.analysis
    this._source = 'native'

    // Cache with fingerprint so it invalidates when index changes
    await saveGraphCache(cacheDir, result.analysis, graph, fp).catch(() => {})

    return result
  }

  /**
   * Load graph from multiple possible locations (external graphify tool output).
   */
  private async loadGraphJson(projectRoot: string): Promise<GraphifyGraph | null> {
    const paths = [
      PathUtils.joinSafe(projectRoot, 'graph-out', 'graph.json'),     // Prefer new naming
      PathUtils.joinSafe(projectRoot, 'graphify-out', 'graph.json'),  // Backward compatibility
      PathUtils.joinSafe(projectRoot, 'graph.json'),
      'graph-out/graph.json',
      'graphify-out/graph.json',
      './graph-out/graph.json',
      './graphify-out/graph.json',
    ]

    for (const path of paths) {
      const result: LoadResult = await loadGraphifyJson(path).catch(() => ({
        success: false, error: '', warnings: [],
      }))
      if (result.success && result.graph) {
        return result.graph
      }
    }
    return null
  }

  /**
   * Run all algorithms on the graph.
   */
  private async runAlgorithms(graph: GraphifyGraph): Promise<GraphResult> {
    const key = graphifyStructureCacheKey(graph)
    const cached = this.sessionAnalysisCache.get(key) as GraphifyAnalysis | null
    if (cached) {
      return { graph, analysis: cached }
    }
    const analyzerResult = await this.graphAnalyzer.analyze(this.toAnalysisGraph(graph))
    const analysis = assembleGraphifyAnalysis(graph, analyzerResult)
    this.sessionAnalysisCache.set(key, analysis)
    return { graph, analysis }
  }

  private toAnalysisGraph(graph: GraphifyGraph): AnalysisGraph {
    return {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        type: n.type,
        properties: n.metadata,
      })),
      edges: graph.edges.map(e => ({
        from: e.source,
        to: e.target,
        type: e.type,
        weight: e.weight,
      })),
    }
  }
}
