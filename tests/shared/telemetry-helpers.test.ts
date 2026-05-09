/**
 * Tests for shared/telemetry-helpers.ts — wraps pi-telemetry via getTelemetry().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  getTelemetryMock,
  mockRecordMetric,
  mockRecordEvent,
  mockRecordError,
  mockHeartbeat,
  mockTelemetry,
} = vi.hoisted(() => {
  const mockRecordMetric = vi.fn()
  const mockRecordEvent = vi.fn()
  const mockRecordError = vi.fn()
  const mockHeartbeat = vi.fn()

  const mockTelemetry = {
    recordMetric: mockRecordMetric,
    recordEvent: mockRecordEvent,
    recordError: mockRecordError,
    heartbeat: mockHeartbeat,
  }

  const getTelemetryMock = vi.fn(() => mockTelemetry)

  return {
    getTelemetryMock,
    mockRecordMetric,
    mockRecordEvent,
    mockRecordError,
    mockHeartbeat,
    mockTelemetry,
  }
})

vi.mock('pi-telemetry', () => ({
  getTelemetry: () => getTelemetryMock(),
}))

const {
  recordInjection,
  recordPruning,
  recordContextUsage,
  recordSessionError,
  recordHeartbeat,
} = await import('../../shared/telemetry-helpers.js')

describe('telemetry-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTelemetryMock.mockImplementation(() => mockTelemetry)
  })

  describe('recordInjection', () => {
    it('records a token metric', () => {
      recordInjection('repo-map', 3500)

      expect(mockRecordMetric).toHaveBeenCalledWith('pi-scope', 'repo-map-tokens', 3500)
    })

    it('is safe when getTelemetry returns undefined', () => {
      getTelemetryMock.mockReturnValue(undefined)
      expect(() => recordInjection('test', 100)).not.toThrow()
    })
  })

  describe('recordPruning', () => {
    it('records pruning event with counts', () => {
      recordPruning(['dedup', 'error-purge'], 5, 20)

      expect(mockRecordEvent).toHaveBeenCalledWith('pi-scope', 'pruning', {
        removed: 5,
        total: 20,
      })
    })
  })

  describe('recordContextUsage', () => {
    it('records context metrics', () => {
      recordContextUsage(50, 20, 10)

      expect(mockRecordMetric).toHaveBeenCalledWith('pi-scope', 'context-messages', 50)
      expect(mockRecordMetric).toHaveBeenCalledWith('pi-scope', 'context-tool-calls', 20)
    })
  })

  describe('recordSessionError', () => {
    it('records error events', () => {
      recordSessionError('cache_corrupt', 'Store corrupted')

      expect(mockRecordError).toHaveBeenCalledWith(
        'pi-scope',
        'cache_corrupt',
        'Store corrupted',
      )
    })
  })

  describe('recordHeartbeat', () => {
    it('records healthy heartbeats', () => {
      recordHeartbeat('healthy')

      expect(mockHeartbeat).toHaveBeenCalledWith('pi-scope', 'healthy')
    })

    it('records error heartbeats with message', () => {
      recordHeartbeat('error', 'Indexing failed')

      expect(mockHeartbeat).toHaveBeenCalledWith('pi-scope', 'error: Indexing failed')
    })
  })
})
