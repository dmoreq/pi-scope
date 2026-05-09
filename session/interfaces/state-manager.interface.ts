// session/interfaces/state-manager.interface.ts
export interface SessionConfig {
  projectRoot: string
  enabled: boolean
  maxTokens: number
  plugins?: string[]
  excludePatterns?: string[]
}

export interface SessionState {
  projectRoot: string
  config: SessionConfig
  initialized: boolean
  stats?: {
    indexedFiles: number
    lastIndexTime: Date
  }
}

export interface StateManager {
  getState(): SessionState | null
  updateState(state: Partial<SessionState>): Promise<void>
  clearState(): Promise<void>
}
