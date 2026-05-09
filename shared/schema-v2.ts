/**
 * StoredIndexV2 — Enhanced index schema with rich metadata
 *
 * Replaces StoredIndex v3 with v2 that includes:
 * - Build metadata (duration, timestamp, mode)
 * - Project metadata (git commit, branch, name)
 * - Coverage statistics (languages, symbols, edges)
 * - Configuration snapshot (scan/ignore patterns)
 * - File validation (checksums for staleness detection)
 * - Graph data (nodes, edges, communities, god nodes) [future]
 */

export const STORE_VERSION_V2 = 2

export interface LanguageCoverage {
  fileCount: number
  symbolCount: number
  edgeCount: number
}

export interface StoredIndexV2 {
  // ── Schema versioning ──────────────────────────────────────
  version: number // STORE_VERSION_V2 = 2
  schemaVersion: string // "2.0"

  // ── Build metadata ─────────────────────────────────────────
  builtAt: string // ISO timestamp
  builtIn: number // milliseconds (how long build took)
  buildMode: 'fresh' | 'incremental' // future: incremental support

  // ── Project metadata ───────────────────────────────────────
  projectRoot: string
  projectName: string // derived from basename
  gitCommit?: string // git rev-parse HEAD (optional)
  gitBranch?: string // git rev-parse --abbrev-ref HEAD

  // ── Index statistics ───────────────────────────────────────
  fileCount: number
  symbolCount: number // total unique symbols across all files
  edgeCount: number // total dependencies

  // ── Coverage ───────────────────────────────────────────────
  languages: Record<string, LanguageCoverage>
  // Example:
  // {
  //   "typescript": { fileCount: 45, symbolCount: 320, edgeCount: 180 },
  //   "python": { fileCount: 12, symbolCount: 89, edgeCount: 45 }
  // }

  // ── Configuration snapshot ─────────────────────────────────
  config: {
    scanPatterns: string[] // what patterns were scanned
    ignorePatterns: string[] // what was ignored
    languages: string[] // what languages included
    maxDepth?: number // recursion depth limit
  }

  // ── Index data ─────────────────────────────────────────────
  skeletons: Record<string, string>
  deps: Record<string, string[]>
  reverseDeps: Record<string, string[]>
  symbolIndex: Record<string, string[]>

  // ── Validation checksums ───────────────────────────────────
  checksums: {
    files: Record<string, string> // file path → SHA256 hash (optional, for incremental)
    timestamp: number // mtime check
  }

  // ── Optional graph data (for native implementation) ────────
  graph?: {
    nodes: Array<{ id: string; label: string; community: number }>
    edges: Array<{ source: string; target: string; confidence: 'EXTRACTED' | 'INFERRED' }>
    communities: number
    godNodes: string[]
    maxComponentSize: number
    circularDependencies: number
  }
}

/**
 * Migration helper: convert v3 (old) to v2 (new)
 *
 * Old StoredIndex had minimal fields; v2 adds metadata.
 * This function converts old format to new by inferring defaults.
 */
export function migrateToV2(oldIndex: any): StoredIndexV2 {
  const projectName = oldIndex.projectRoot?.split('/').pop() || 'unknown'
  const buildStart = new Date(oldIndex.builtAt || Date.now()).getTime()
  const buildEnd = Date.now()

  // Calculate symbol count from symbolIndex
  const symbolCount = Object.values(oldIndex.symbolIndex || {})
    .reduce((sum: number, files: any) => sum + (Array.isArray(files) ? files.length : 0), 0)

  // Calculate edge count from deps
  const edgeCount = Object.values(oldIndex.deps || {})
    .reduce((sum: number, targets: any) => sum + (Array.isArray(targets) ? targets.length : 0), 0)

  return {
    version: STORE_VERSION_V2,
    schemaVersion: '2.0',
    builtAt: oldIndex.builtAt || new Date().toISOString(),
    builtIn: buildEnd - buildStart,
    buildMode: 'fresh',
    projectRoot: oldIndex.projectRoot || '',
    projectName,
    languages: {}, // Will be populated during actual build
    config: {
      scanPatterns: ['src/**', 'lib/**', 'index.ts'],
      ignorePatterns: ['node_modules', 'dist', 'build', '.git'],
      languages: ['typescript'],
    },
    fileCount: oldIndex.fileCount || 0,
    symbolCount,
    edgeCount,
    skeletons: oldIndex.skeletons || {},
    deps: oldIndex.deps || {},
    reverseDeps: oldIndex.reverseDeps || {},
    symbolIndex: oldIndex.symbolIndex || {},
    checksums: {
      files: {},
      timestamp: buildStart,
    },
  }
}

/**
 * Helper: Extract just the essential data for fast comparison
 */
export interface IndexMetadata {
  version: number
  builtAt: string
  buildDuration: number
  projectName: string
  fileCount: number
  symbolCount: number
  edgeCount: number
  languages: string[]
  gitCommit?: string
  gitBranch?: string
  godNodesCount?: number
  communityCount?: number
}

export function extractMetadata(index: StoredIndexV2): IndexMetadata {
  return {
    version: index.version,
    builtAt: index.builtAt,
    buildDuration: index.builtIn,
    projectName: index.projectName,
    fileCount: index.fileCount,
    symbolCount: index.symbolCount,
    edgeCount: index.edgeCount,
    languages: Object.keys(index.languages),
    gitCommit: index.gitCommit,
    gitBranch: index.gitBranch,
    godNodesCount: index.graph?.godNodes.length,
    communityCount: index.graph?.communities,
  }
}
