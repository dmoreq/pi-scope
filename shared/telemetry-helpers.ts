/**
 * Telemetry helpers — thin wrappers around pi-telemetry.
 *
 * All functions in this file are DEPRECATED in favor of TelemetryService.
 * Keep for backward compatibility with existing code until full migration.
 *
 * @deprecated Use `TelemetryService` from `services/telemetry-service.ts`
 */

import { getTelemetry } from 'pi-telemetry'

export function recordInjection(source: string, tokens: number, _files?: string[]): void {
  try {
    getTelemetry()?.recordMetric('pi-scope', `${source}-tokens`, tokens)
  } catch {}
}

export function recordPruning(_rulesApplied: string[], _removed: number, _total: number): void {
  try {
    getTelemetry()?.recordEvent('pi-scope', 'pruning', { removed: _removed, total: _total })
  } catch {}
}

export function recordContextUsage(messageCount: number, toolCalls: number, filesTouched: number): void {
  try {
    getTelemetry()?.recordMetric('pi-scope', 'context-messages', messageCount)
    getTelemetry()?.recordMetric('pi-scope', 'context-tool-calls', toolCalls)
  } catch {}
}

export function recordSessionError(type: string, message: string): void {
  try {
    getTelemetry()?.recordError('pi-scope', type, message)
  } catch {}
}

export function recordHeartbeat(status: 'healthy' | 'degraded' | 'error' | 'stale', error?: string): void {
  try {
    getTelemetry()?.heartbeat('pi-scope', error ? `${status}: ${error}` : status)
  } catch {}
}
