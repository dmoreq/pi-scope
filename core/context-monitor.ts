/**
 * ContextMonitor — Single source of truth for session activity.
 *
 * Tracks message count, tool calls, file modifications, token usage,
 * pruning stats, and session metadata through a unified interface.
 *
 * Satisfies SRP: tracking session state is a single responsibility,
 * separate from lifecycle management (SessionManager) or UI (notifications).
 *
 * Usage:
 * ```typescript
 * const monitor = new ContextMonitor();
 * monitor.reset('session-abc', '/project');
 * monitor.recordMessage();
 * monitor.recordToolCall('bash');
 * monitor.recordFileWrite('src/index.ts');
 * const stats = monitor.getStats();
 * console.log(stats.messageCount, stats.toolCallCount);
 * ```
 */

import type { TokenUsage, SessionStats } from '../shared/types.js';

export class ContextMonitor {
  private _messageCount = 0;
  private _turnCount = 0;
  private _toolCallCount = 0;
  private _bashCallCount = 0;
  private _touchedFiles = new Set<string>();
  private _tokenUsage: TokenUsage | null = null;
  private _prunedCount = 0;
  private _totalProcessed = 0;
  private _lastRecapAt = 0;
  private _sessionId = '';
  private _cwd = '';
  private _startedAt = 0;

  /**
   * Reset all counters for a new session.
   */
  reset(sessionId: string, cwd: string): void {
    this._messageCount = 0;
    this._turnCount = 0;
    this._toolCallCount = 0;
    this._bashCallCount = 0;
    this._touchedFiles.clear();
    this._tokenUsage = null;
    this._prunedCount = 0;
    this._totalProcessed = 0;
    this._lastRecapAt = Date.now();
    this._sessionId = sessionId;
    this._cwd = cwd;
    this._startedAt = Date.now();
  }

  /**
   * Record a user/assistant message in the session.
   */
  recordMessage(): void {
    this._messageCount++;
  }

  /**
   * Record an LLM turn (corresponds to before_agent_start event).
   */
  recordTurn(): void {
    this._turnCount++;
  }

  /**
   * Record a tool call invocation.
   * @param name - The tool name (e.g. 'bash', 'write', 'edit')
   */
  recordToolCall(name: string): void {
    this._toolCallCount++;
    if (name === 'bash') this._bashCallCount++;
  }

  /**
   * Record a file that was written/modified during the session.
   * @param path - Absolute file path
   */
  recordFileWrite(path: string): void {
    this._touchedFiles.add(path);
  }

  /**
   * Update the current token usage snapshot.
   */
  updateTokenUsage(usage: TokenUsage): void {
    this._tokenUsage = usage;
  }

  /**
   * Record pruning statistics.
   * @param pruned - Number of messages removed
   * @param total  - Total messages before pruning
   */
  recordPruning(pruned: number, total: number): void {
    this._prunedCount += pruned;
    this._totalProcessed += total;
  }

  /**
   * Mark that a recap was generated (resets recap timer).
   */
  markRecap(): void {
    this._lastRecapAt = Date.now();
  }

  // ── Getters ─────────────────────────────────────────────────────────

  /** Number of messages in the session. */
  get messageCount(): number {
    return this._messageCount;
  }

  /** Number of LLM turns completed. */
  get turnCount(): number {
    return this._turnCount;
  }

  /** Number of tool calls made. */
  get toolCallCount(): number {
    return this._toolCallCount;
  }

  /** Number of unique files written. */
  get fileCount(): number {
    return this._touchedFiles.size;
  }

  /** Number of messages pruned this session. */
  get prunedCount(): number {
    return this._prunedCount;
  }

  /** When the last recap was generated (epoch ms). */
  get lastRecapAt(): number {
    return this._lastRecapAt;
  }

  /** Current token usage snapshot. */
  get tokenUsage(): TokenUsage | null {
    return this._tokenUsage;
  }

  /** Set of touched file paths. */
  get touchedFiles(): Set<string> {
    return this._touchedFiles;
  }

  /**
   * Get a comprehensive snapshot of current session stats.
   */
  getStats(): SessionStats {
    return {
      sessionId: this._sessionId,
      cwd: this._cwd,
      startedAt: this._startedAt,
      messageCount: this._messageCount,
      turnCount: this._turnCount,
      toolCallCount: this._toolCallCount,
      bashCallCount: this._bashCallCount,
      prunedCount: this._prunedCount,
      totalProcessed: this._totalProcessed,
      touchedFiles: Array.from(this._touchedFiles).sort(),
      tokenUsage: this._tokenUsage ? { ...this._tokenUsage } : null,
    };
  }

  /**
   * Get the current context usage ratio (0.0 - 1.0).
   * Returns null if token usage hasn't been set or context window is 0.
   */
  getContextUsageRatio(): number | null {
    if (!this._tokenUsage) return null;
    if (!this._tokenUsage.contextWindow || this._tokenUsage.contextWindow === 0) return null;
    return this._tokenUsage.total / this._tokenUsage.contextWindow;
  }

  /**
   * Get a compaction suggestion based on context window pressure.
   * - 'critical' when > 90% full
   * - 'warn' when > 80% full
   * - null otherwise
   */
  getCompactSuggestion(): 'critical' | 'warn' | null {
    const ratio = this.getContextUsageRatio();
    if (ratio === null) return null;
    if (ratio >= 0.9) return 'critical';
    if (ratio >= 0.8) return 'warn';
    return null;
  }

  /**
   * Check if the session is eligible for a recap suggestion.
   * True when messageCount > 20 AND last recap was more than 10 minutes ago.
   */
  getRecapEligible(): boolean {
    return this._messageCount > 20 && Date.now() - this._lastRecapAt > 10 * 60 * 1000;
  }
}
