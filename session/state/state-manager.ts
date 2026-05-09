// session/state/state-manager.ts
import type { SessionState, StateManager as IStateManager } from '../interfaces/state-manager.interface.js'

export class StateManager implements IStateManager {
  private currentState: SessionState | null = null

  getState(): SessionState | null {
    return this.currentState
  }

  async updateState(state: Partial<SessionState>): Promise<void> {
    if (this.currentState === null) {
      if (!state.projectRoot || !state.config || state.initialized === undefined) {
        throw new Error('First state update must include projectRoot, config, and initialized')
      }
      this.currentState = {
        projectRoot: state.projectRoot,
        config: state.config,
        initialized: state.initialized,
        stats: state.stats,
      }
    } else {
      this.currentState = { ...this.currentState, ...state }
    }
  }

  async clearState(): Promise<void> {
    this.currentState = null
  }
}
