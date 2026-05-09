// tests/session/state/state-manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StateManager } from '../../../session/state/state-manager.js'
import type { SessionState } from '../../../session/interfaces/state-manager.interface.js'

describe('StateManager', () => {
  let stateManager: StateManager

  beforeEach(() => {
    stateManager = new StateManager()
  })

  it('should initialize with null state', () => {
    const state = stateManager.getState()
    expect(state).toBe(null)
  })

  it('should update state correctly', async () => {
    const newState: SessionState = {
      projectRoot: '/test',
      config: { projectRoot: '/test' },
      initialized: true,
    }

    await stateManager.updateState(newState)
    const state = stateManager.getState()

    expect(state).toEqual(newState)
  })

  it('should clear state', async () => {
    const newState: SessionState = {
      projectRoot: '/test',
      config: { projectRoot: '/test' },
      initialized: true,
    }

    await stateManager.updateState(newState)
    await stateManager.clearState()

    expect(stateManager.getState()).toBe(null)
  })

  it('should merge partial state updates', async () => {
    const initialState: SessionState = {
      projectRoot: '/test',
      config: { enabled: true },
      initialized: false,
    }

    await stateManager.updateState(initialState)
    await stateManager.updateState({ initialized: true })

    const state = stateManager.getState()
    expect(state).toEqual({
      projectRoot: '/test',
      config: { enabled: true },
      initialized: true,
    })
  })

  it('should handle stats updates', async () => {
    const initialState: SessionState = {
      projectRoot: '/test',
      config: {},
      initialized: true,
    }

    await stateManager.updateState(initialState)
    await stateManager.updateState({
      stats: {
        indexedFiles: 100,
        lastIndexTime: new Date('2026-01-01'),
      },
    })

    const state = stateManager.getState()
    expect(state?.stats?.indexedFiles).toBe(100)
    expect(state?.stats?.lastIndexTime).toEqual(new Date('2026-01-01'))
  })

  it('should return null after multiple clear operations', async () => {
    const newState: SessionState = {
      projectRoot: '/test',
      config: {},
      initialized: true,
    }

    await stateManager.updateState(newState)
    await stateManager.clearState()
    await stateManager.clearState() // Multiple clears should be safe

    expect(stateManager.getState()).toBe(null)
  })
})
