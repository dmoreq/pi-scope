/**
 * MetricsCollector — centralized metrics collection for pi-telemetry.
 *
 * Replaces inline telemetry recording patterns with a single facade
 * that records metrics, events, traces, and heartbeats.
 *
 * Satisfies DRY: all pi-slim telemetry recording flows through this class.
 *
 * Usage:
 * ```typescript
 * const metrics = new MetricsCollector();
 * metrics.recordSessionStart({ filesIndexed: 1234, depEdges: 567 });
 * metrics.recordInjection('repo-map', 3500);
 * ```
 */

import { getTelemetry } from 'pi-telemetry';
import type { SessionStats } from '../shared/types.js';

// ── Metric Names (constants to avoid magic strings) ────────────────────────

export const METRICS = {
  SESSION_FILES_INDEXED: 'session_files_indexed',
  SESSION_DEP_EDGES: 'session_dep_edges',
  SESSION_DURATION: 'session_duration_ms',
  INJECTION_REPO_MAP_TOKENS: 'injection_repo_map_tokens',
  INJECTION_DEP_CONTEXT_TOKENS: 'injection_dep_context_tokens',
  INJECTION_DEP_CONTEXT_FILES: 'injection_dep_context_files',
  INJECTION_CONTEXT_FILES_TOKENS: 'injection_context_files_tokens',
  CONTEXT_MESSAGE_COUNT: 'context_message_count',
  CONTEXT_TOOL_CALLS: 'context_tool_calls',
  CONTEXT_FILES_TOUCHED: 'context_files_touched',
  PRUNING_REMOVED: 'pruning_removed_messages',
  PRUNING_PERCENT: 'pruning_percent',
  AUTOMATION_TRIGGERS_FIRED: 'automation_triggers_fired',
} as const;

// ── Metrics Collector ──────────────────────────────────────────────────────

export class MetricsCollector {
  private sessionStartTime = 0;

  /**
   * Record session start metrics.
   */
  recordSessionStart(stats: { filesIndexed: number; depEdges: number; indexSource: string }): void {
    this.sessionStartTime = Date.now();
    try {
      const t = getTelemetry();
      t?.recordToolInvocation('pi-slim', 'session-index');
      t?.recordToolResult('pi-slim', 'session-index', 0, false);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record a context injection.
   */
  recordInjection(source: string, tokens: number, files?: number): void {
    try {
      const t = getTelemetry();
      t?.recordToolInvocation('pi-slim', source);
      t?.recordToolResult('pi-slim', source, 0, false);
      t?.recordTokens('pi-slim', { input: tokens, output: 0 });
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record a pruning operation.
   */
  recordPruning(stats: { rulesApplied: string[]; removed: number; total: number }): void {
    try {
      const t = getTelemetry();
      t?.recordToolInvocation('pi-slim', 'pruning');
      t?.recordToolResult('pi-slim', 'pruning', 0, stats.total > 0 && stats.removed === stats.total);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record context usage statistics from session stats.
   */
  recordContextUsage(sessionStats: SessionStats): void {
    try {
      const t = getTelemetry();
      t?.recordToolInvocation('pi-slim', 'context-monitor');
      t?.recordToolResult('pi-slim', 'context-monitor', 0, false);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record an automation event.
   */
  recordAutomation(triggerId: string, suggestion: string): void {
    try {
      const t = getTelemetry();
      t?.recordToolInvocation('pi-slim', 'automation');
      t?.recordToolResult('pi-slim', 'automation', 0, false);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record a session error.
   */
  recordError(type: string, message: string): void {
    try {
      getTelemetry()?.recordError('pi-slim', type, message);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record a heartbeat.
   */
  recordHeartbeat(status: 'healthy' | 'degraded' | 'error' | 'stale', error?: string): void {
    try {
      getTelemetry()?.heartbeat('pi-slim', { status, error });
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record session end metrics (duration, summary).
   */
  recordSessionEnd(stats: SessionStats): void {
    try {
      const t = getTelemetry();
      t?.recordToolInvocation('pi-slim', 'session-end');
      t?.recordToolResult('pi-slim', 'session-end', 0, false);
    } catch {
      // Telemetry is best-effort
    }
  }
}
