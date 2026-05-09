// session/interfaces/state-manager.interface.ts
export interface SessionState {
  projectRoot: string
  config: any
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
