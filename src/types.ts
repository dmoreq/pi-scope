export interface FileIndex {
  path: string
  skeleton: string
  imports: string[]
  contentHash: string
}

export interface RepoIndex {
  skeletons: Map<string, string>
  deps: Map<string, Set<string>>
  reverseDeps: Map<string, Set<string>>
}

export interface SmartContextConfig {
  enabled: boolean
  maxRepoMapTokens: number
  maxInjectionTokens: number
  scanLastNMessages: number
  exclude: string[]

  /** Context files (AGENTS.local.md, CLAUDE.md, etc.) injected into system prompt. */
  contextFiles: {
    enabled: boolean
    /** Filenames to search for at every ancestor directory level. */
    filenames: string[]
    /** Section title in the injected block. */
    sectionTitle: string
  }

  /**
   * Provider-specific guidance files (CLAUDE.md, CODEX.md, GEMINI.md)
   * injected based on the active model provider.
   */
  providerGuidance: {
    enabled: boolean
  }
}

export const DEFAULT_CONFIG: SmartContextConfig = {
  enabled: true,
  maxRepoMapTokens: 4000,
  maxInjectionTokens: 8000,
  scanLastNMessages: 10,
  exclude: ['**/node_modules/**', '**/.git/**', '**/.pi-cache/**', '**/dist/**'],
  contextFiles: {
    enabled: true,
    filenames: ['AGENTS.local.md', 'CLAUDE.local.md'],
    sectionTitle: 'Extra Context Files',
  },
  providerGuidance: {
    enabled: true,
  },
}

export interface CacheFile {
  version: number
  entries: Record<string, FileIndex>
}

export const CACHE_VERSION = 1
