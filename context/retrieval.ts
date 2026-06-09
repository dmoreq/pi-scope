/**
 * Retrieval Engine — scored file retrieval for context injection.
 *
 * Replaces regex-based file detection with multi-signal scoring:
 *   - Symbol match (3x) — agent mentions a symbol, file exports it
 *   - Filename match (2x) — agent mentions the filename
 *   - Dependency proximity (1x) — file is imported by an active file
 *
 * Pure functions on RepoIndex — no side effects.
 * @module
 */

import { relative } from 'node:path'
import { godNodeMatchesFilePath } from './graph-node-id.js'
import { godNodeMatchesSymbol } from './god-node-match.js'
import type { GraphAnalysis } from './graph-types.js'
import { fileInCommunity } from './graph-community-files.js'
import { buildGraphLookupIndex } from './graph-lookup-index.js'
import type { RepoIndex } from '../shared/types.js'

export interface RetrievalGraphOptions {
  graph?: GraphAnalysis | null
  activeCommunityId?: string | null
  boostGodNodes?: boolean
  boostActiveCommunity?: boolean
  projectRoot?: string
}

export interface ScoredFile {
  file: string
  score: number
  signals: string[]
}

interface SymbolLookupEntry {
  symbol: string
  file: string
}

interface RetrievalLookups {
  exactSymbols: Map<string, SymbolLookupEntry[]>
  partialSymbols: Map<string, SymbolLookupEntry[]>
  filenames: Map<string, Set<string>>
  exactPaths: Map<string, Set<string>>
  suffixPaths: Map<string, Set<string>>
}

interface QueryMatches {
  exactSymbolTokensByFile: Map<string, Set<string>>
  partialSymbolByFile: Map<string, string>
  filenameByFile: Map<string, string>
  candidateFiles: Set<string>
}

export class RetrievalEngine {
  private readonly lookups: RetrievalLookups

  constructor(private index: RepoIndex) {
    this.lookups = this.buildLookups(index)
  }

  /**
   * Extract potential symbol names from query text.
   * Looks for camelCase, snake_case, and kebab-case identifiers.
   */
  private extractQueryTokens(query: string): Set<string> {
    const tokens = new Set<string>()
    // Split on whitespace and common delimiters, then extract identifiers
    const words = query.split(/[\s.,;:(){}[\]"'`/\\<>|+=*&^%$#@!?~-]+/)

    for (const word of words) {
      if (word.length > 1) {
        tokens.add(word.toLowerCase())

        // Extract camelCase components (e.g., "getUserData" → ["get", "user", "data"])
        // Look for capital letters to split on
        const camelParts = word.split(/(?=[A-Z])/).filter(s => s.length > 1)
        for (const part of camelParts) {
          tokens.add(part.toLowerCase())
        }

        // Also try to split on common word boundaries
        const underscoreParts = word.split('_').filter(s => s.length > 1)
        for (const part of underscoreParts) {
          tokens.add(part.toLowerCase())
        }
      }
    }

    return tokens
  }

  private tokenizeIdentifier(value: string): Set<string> {
    const tokens = new Set<string>()
    const lower = value.toLowerCase()
    if (lower.length > 1) tokens.add(lower)

    for (const part of value.split(/(?=[A-Z])/)) {
      const normalized = part.toLowerCase()
      if (normalized.length > 1) tokens.add(normalized)
    }

    for (const part of value.split(/[_\-.]+/)) {
      const normalized = part.toLowerCase()
      if (normalized.length > 1) tokens.add(normalized)
    }

    return tokens
  }

  private buildLookups(index: RepoIndex): RetrievalLookups {
    const lookups: RetrievalLookups = {
      exactSymbols: new Map(),
      partialSymbols: new Map(),
      filenames: new Map(),
      exactPaths: new Map(),
      suffixPaths: new Map(),
    }

    for (const [symbol, files] of index.symbolIndex) {
      const symbolLower = symbol.toLowerCase()
      for (const file of files) {
        this.addSymbolLookup(lookups.exactSymbols, symbolLower, { symbol, file })
        for (const token of this.tokenizeIdentifier(symbol)) {
          this.addSymbolLookup(lookups.partialSymbols, token, { symbol, file })
        }
      }
    }

    for (const file of index.skeletons.keys()) {
      const normalizedPath = this.normalizePath(file)
      this.addPathLookup(lookups.exactPaths, normalizedPath, file)

      const parts = normalizedPath.split('/').filter(Boolean)
      for (let i = 0; i < parts.length; i++) {
        this.addPathLookup(lookups.suffixPaths, parts.slice(i).join('/'), file)
      }

      const name =
        normalizedPath
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '') ?? ''
      for (const token of this.tokenizeIdentifier(name)) {
        this.addPathLookup(lookups.filenames, token, file)
      }
      for (const gram of this.bigrams(name.toLowerCase())) {
        this.addPathLookup(lookups.filenames, gram, file)
      }
      for (const gram of this.trigrams(name.toLowerCase())) {
        this.addPathLookup(lookups.filenames, gram, file)
      }
    }

    return lookups
  }

  private addSymbolLookup(map: Map<string, SymbolLookupEntry[]>, key: string, entry: SymbolLookupEntry): void {
    const existing = map.get(key)
    if (existing) {
      if (!existing.some(e => e.symbol === entry.symbol && e.file === entry.file)) existing.push(entry)
      return
    }
    map.set(key, [entry])
  }

  private addPathLookup(map: Map<string, Set<string>>, key: string, file: string): void {
    if (key.length === 0) return
    const existing = map.get(key)
    if (existing) {
      existing.add(file)
      return
    }
    map.set(key, new Set([file]))
  }

  private trigrams(value: string): Set<string> {
    return this.ngrams(value, 3)
  }

  private bigrams(value: string): Set<string> {
    return this.ngrams(value, 2)
  }

  private ngrams(value: string, length: number): Set<string> {
    const grams = new Set<string>()
    if (value.length < length) return grams
    for (let i = 0; i <= value.length - length; i++) {
      grams.add(value.slice(i, i + length))
    }
    return grams
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\.\//, '')
  }

  private candidateEntriesForPartialToken(token: string): SymbolLookupEntry[] {
    if (token.length <= 2) return []
    return this.lookups.partialSymbols.get(token) ?? []
  }

  private candidateFilesForFilenameToken(token: string): Set<string> {
    const files = new Set<string>(this.lookups.filenames.get(token) ?? [])
    if (token.length <= 2) return files

    for (const gram of this.trigrams(token)) {
      for (const file of this.lookups.filenames.get(gram) ?? []) files.add(file)
    }
    return files
  }

  private basenameWithoutExtension(file: string): string {
    return (
      this.normalizePath(file)
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') ?? ''
    )
  }

  private buildQueryMatches(queryTokens: Set<string>): QueryMatches {
    const matches: QueryMatches = {
      exactSymbolTokensByFile: new Map(),
      partialSymbolByFile: new Map(),
      filenameByFile: new Map(),
      candidateFiles: new Set(),
    }

    for (const token of queryTokens) {
      for (const entry of this.lookups.exactSymbols.get(token) ?? []) {
        let tokens = matches.exactSymbolTokensByFile.get(entry.file)
        if (!tokens) {
          tokens = new Set()
          matches.exactSymbolTokensByFile.set(entry.file, tokens)
        }
        tokens.add(token)
        matches.candidateFiles.add(entry.file)
      }

      for (const entry of this.candidateEntriesForPartialToken(token)) {
        if (!entry.symbol.toLowerCase().includes(token)) continue
        if (!matches.partialSymbolByFile.has(entry.file)) {
          matches.partialSymbolByFile.set(entry.file, entry.symbol)
        }
        matches.candidateFiles.add(entry.file)
      }

      for (const file of this.candidateFilesForFilenameToken(token)) {
        const name = this.basenameWithoutExtension(file)
        if (name.length > 1 && name.toLowerCase().includes(token)) {
          if (!matches.filenameByFile.has(file)) matches.filenameByFile.set(file, name)
          matches.candidateFiles.add(file)
        }
      }
    }

    return matches
  }

  private scoreFileFromMatches(file: string, activeDeps: Set<string>, matches: QueryMatches): ScoredFile {
    const signals: string[] = []
    let score = 0

    const exactTokens = matches.exactSymbolTokensByFile.get(file)
    if (exactTokens) {
      for (const token of exactTokens) {
        score += 3
        signals.push(`symbol:${token}`)
      }
    } else {
      const partial = matches.partialSymbolByFile.get(file)
      if (partial) {
        score += 2
        signals.push(`partial-symbol:${partial}`)
      }
    }

    const filename = matches.filenameByFile.get(file)
    if (filename) {
      score += 2
      signals.push(`filename:${filename}`)
    }

    if (activeDeps.has(file)) {
      score += 1
      signals.push('dep-proximity')
    }

    return { file, score, signals }
  }

  /**
   * Retrieve top-K files by relevance score.
   * Optimized to avoid O(files × symbols) complexity.
   *
   * @param query - User message or combined context text
   * @param k - Maximum files to return
   * @param activeDeps - Set of files currently in focus (for proximity scoring)
   * @returns Ranked file paths, highest score first
   */
  retrieveTopK(
    query: string,
    k = 20,
    activeDeps: Set<string> = new Set(),
    graphOpts?: RetrievalGraphOptions
  ): ScoredFile[] {
    const candidates = new Map<string, ScoredFile>()
    const queryTokens = this.extractQueryTokens(query)
    const queryMatches = this.buildQueryMatches(queryTokens)

    const addCandidate = (file: string) => {
      if (candidates.has(file) || !this.index.skeletons.has(file)) return
      const scored = this.scoreFileFromMatches(file, activeDeps, queryMatches)
      if (scored.score > 0) {
        candidates.set(file, scored)
      }
    }

    for (const file of queryMatches.candidateFiles) addCandidate(file)
    for (const file of activeDeps) addCandidate(file)

    let results = Array.from(candidates.values()).sort((a, b) => b.score - a.score)

    if (graphOpts?.graph && graphOpts.projectRoot) {
      results = this.applyGraphBoosts(results, graphOpts)
    }

    return results.slice(0, k)
  }

  private applyGraphBoosts(files: ScoredFile[], opts: RetrievalGraphOptions): ScoredFile[] {
    const graph = opts.graph
    const root = opts.projectRoot
    if (!graph || !root) return files
    const graphLookupIndex = buildGraphLookupIndex(graph)

    const boosted = files.map(f => {
      let score = f.score
      const signals = [...f.signals]
      const rel = relative(root, f.file).replace(/\\/g, '/')

      if (opts.boostGodNodes && graph.godNodes.length > 0) {
        const matchesGod = graph.godNodes.some(gn => godNodeMatchesFilePath(rel, gn))
        if (matchesGod) {
          score += 2
          signals.push('graph:god-node')
        }
        for (const gn of graph.godNodes) {
          if (godNodeMatchesSymbol(gn, rel.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '')) {
            score += 2
            signals.push('graph:god-symbol')
            break
          }
        }
      }

      if (opts.boostActiveCommunity && opts.activeCommunityId) {
        if (fileInCommunity(f.file, opts.activeCommunityId, graph, root, graphLookupIndex)) {
          score += 1
          signals.push('graph:community')
        }
      }

      return { file: f.file, score, signals }
    })

    return boosted.sort((a, b) => b.score - a.score)
  }

  /**
   * Search by symbol name — find all files exporting a given symbol.
   */
  findBySymbol(name: string): string[] {
    return this.index.symbolIndex.get(name) ?? []
  }

  /**
   * Resolve a mentioned path using exact, relative, and suffix path indexes.
   */
  findByPathMention(path: string): string[] {
    const normalized = this.normalizePath(path)
    const withoutDotSlash = normalized.replace(/^\.\//, '')
    const candidates = new Set<string>()

    for (const file of this.lookups.exactPaths.get(normalized) ?? []) candidates.add(file)
    for (const file of this.lookups.exactPaths.get(withoutDotSlash) ?? []) candidates.add(file)
    for (const file of this.lookups.suffixPaths.get(withoutDotSlash) ?? []) candidates.add(file)

    return [...candidates]
  }
}
