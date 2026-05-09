// session/state/state-manager.ts
import type { SessionState, StateManager as IStateManager } from '../interfaces/state-manager.interface.js'

export class StateManager implements IStateManager {
  private currentState: SessionState | null = null

  getState(): SessionState | null {
    return this.currentState
  }

  async updateState(state: Partial<SessionState>): Promise<void> {
    if (this.currentState === null) {
      this.currentState = state as SessionState
    } else {
      this.currentState = { ...this.currentState, ...state }
    }
  }

  async clearState(): Promise<void> {
    this.currentState = null
  }
}
