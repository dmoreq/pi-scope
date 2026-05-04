import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContextMonitor } from '../../core/context-monitor.js';
import type { TokenUsage } from '../../shared/types.js';

describe('ContextMonitor', () => {
  let monitor: ContextMonitor;

  const mockTokenUsage: TokenUsage = {
    total: 5000,
    input: 4000,
    output: 1000,
    cacheRead: 500,
    cacheWrite: 200,
    contextWindow: 10000,
  };

  beforeEach(() => {
    monitor = new ContextMonitor();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Reset ───────────────────────────────────────────────────────────

  describe('reset', () => {
    it('initializes all counters to zero', () => {
      monitor.recordMessage();
      monitor.recordToolCall('bash');
      expect(monitor.messageCount).toBe(1);
      expect(monitor.toolCallCount).toBe(1);

      monitor.reset('session-new', '/new-project');

      expect(monitor.messageCount).toBe(0);
      expect(monitor.turnCount).toBe(0);
      expect(monitor.toolCallCount).toBe(0);
      expect(monitor.fileCount).toBe(0);
      expect(monitor.prunedCount).toBe(0);
      expect(monitor.tokenUsage).toBeNull();
    });

    it('sets session ID and CWD', () => {
      monitor.reset('abc-123', '/my-project');
      const stats = monitor.getStats();
      expect(stats.sessionId).toBe('abc-123');
      expect(stats.cwd).toBe('/my-project');
    });
  });

  // ── Recording ───────────────────────────────────────────────────────

  describe('recordMessage', () => {
    it('increments message count', () => {
      expect(monitor.messageCount).toBe(0);
      monitor.recordMessage();
      expect(monitor.messageCount).toBe(1);
      monitor.recordMessage();
      expect(monitor.messageCount).toBe(2);
    });
  });

  describe('recordTurn', () => {
    it('increments turn count', () => {
      expect(monitor.turnCount).toBe(0);
      monitor.recordTurn();
      expect(monitor.turnCount).toBe(1);
    });
  });

  describe('recordToolCall', () => {
    it('increments tool call count', () => {
      monitor.recordToolCall('read');
      expect(monitor.toolCallCount).toBe(1);
    });

    it('counts bash tool calls separately', () => {
      monitor.recordToolCall('bash');
      monitor.recordToolCall('bash');
      monitor.recordToolCall('write');
      expect(monitor.toolCallCount).toBe(3);
    });
  });

  describe('recordFileWrite', () => {
    it('tracks unique file paths', () => {
      monitor.recordFileWrite('src/index.ts');
      monitor.recordFileWrite('src/auth.ts');
      expect(monitor.fileCount).toBe(2);
    });

    it('deduplicates file paths', () => {
      monitor.recordFileWrite('src/index.ts');
      monitor.recordFileWrite('src/index.ts');
      expect(monitor.fileCount).toBe(1);
    });
  });

  describe('updateTokenUsage', () => {
    it('stores token usage snapshot', () => {
      monitor.updateTokenUsage(mockTokenUsage);
      expect(monitor.tokenUsage).toEqual(mockTokenUsage);
    });

    it('overwrites previous usage', () => {
      monitor.updateTokenUsage(mockTokenUsage);
      const updated: TokenUsage = { ...mockTokenUsage, total: 8000 };
      monitor.updateTokenUsage(updated);
      expect(monitor.tokenUsage?.total).toBe(8000);
    });
  });

  describe('recordPruning', () => {
    it('accumulates pruned and processed counts', () => {
      monitor.recordPruning(5, 20);
      expect(monitor.prunedCount).toBe(5);
      monitor.recordPruning(3, 15);
      expect(monitor.prunedCount).toBe(8);
    });
  });

  describe('markRecap', () => {
    it('resets the recap timer', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      // After reset, recap is recent
      monitor.reset('session-id', '/project');
      expect(monitor.getRecapEligible()).toBe(false);

      // After markRecap, timer resets again
      vi.advanceTimersByTime(5 * 60 * 1000);
      monitor.markRecap();
      expect(monitor.getRecapEligible()).toBe(false);
    });
  });

  // ── Session Stats ───────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns a complete snapshot of current state', () => {
      monitor.reset('sess-1', '/proj');
      monitor.recordMessage();
      monitor.recordTurn();
      monitor.recordToolCall('bash');
      monitor.recordFileWrite('file.ts');
      monitor.updateTokenUsage(mockTokenUsage);
      monitor.recordPruning(3, 10);

      const stats = monitor.getStats();

      expect(stats.sessionId).toBe('sess-1');
      expect(stats.cwd).toBe('/proj');
      expect(stats.messageCount).toBe(1);
      expect(stats.turnCount).toBe(1);
      expect(stats.toolCallCount).toBe(1);
      expect(stats.bashCallCount).toBe(1);
      expect(stats.prunedCount).toBe(3);
      expect(stats.totalProcessed).toBe(10);
      expect(stats.touchedFiles).toEqual(['file.ts']);
      expect(stats.tokenUsage).toEqual(mockTokenUsage);
      expect(stats.startedAt).toBeGreaterThan(0);
    });

    it('returns null tokenUsage when not set', () => {
      const stats = monitor.getStats();
      expect(stats.tokenUsage).toBeNull();
    });
  });

  // ── Context Usage ───────────────────────────────────────────────────

  describe('getContextUsageRatio', () => {
    it('returns ratio when token usage is set', () => {
      monitor.updateTokenUsage(mockTokenUsage);
      expect(monitor.getContextUsageRatio()).toBe(0.5);
    });

    it('returns null when token usage is not set', () => {
      expect(monitor.getContextUsageRatio()).toBeNull();
    });

    it('returns null when context window is 0', () => {
      monitor.updateTokenUsage({ ...mockTokenUsage, contextWindow: 0 });
      expect(monitor.getContextUsageRatio()).toBeNull();
    });

    it('handles > 100% usage', () => {
      monitor.updateTokenUsage({
        ...mockTokenUsage,
        total: 15000,
        contextWindow: 10000,
      });
      expect(monitor.getContextUsageRatio()).toBe(1.5);
    });
  });

  // ── Compact Suggestion ──────────────────────────────────────────────

  describe('getCompactSuggestion', () => {
    it('returns null when token usage is not set', () => {
      expect(monitor.getCompactSuggestion()).toBeNull();
    });

    it('returns null when usage is below 80%', () => {
      monitor.updateTokenUsage({ ...mockTokenUsage, total: 7000 });
      expect(monitor.getCompactSuggestion()).toBeNull();
    });

    it('returns warn when usage is >= 80%', () => {
      monitor.updateTokenUsage({ ...mockTokenUsage, total: 8000 });
      expect(monitor.getCompactSuggestion()).toBe('warn');
    });

    it('returns critical when usage is >= 90%', () => {
      monitor.updateTokenUsage({ ...mockTokenUsage, total: 9000 });
      expect(monitor.getCompactSuggestion()).toBe('critical');
    });

    it('returns critical at exactly 100%', () => {
      monitor.updateTokenUsage({ ...mockTokenUsage, total: 10000 });
      expect(monitor.getCompactSuggestion()).toBe('critical');
    });
  });

  // ── Recap Eligibility ───────────────────────────────────────────────

  describe('getRecapEligible', () => {
    it('returns false when message count is low', () => {
      monitor.reset('s-1', '/p');
      // 15 messages is under the threshold
      for (let i = 0; i < 15; i++) monitor.recordMessage();
      expect(monitor.getRecapEligible()).toBe(false);
    });

    it('returns false when recap was recent', () => {
      monitor.reset('s-1', '/p');
      for (let i = 0; i < 25; i++) monitor.recordMessage();
      // Recap was just done by reset
      expect(monitor.getRecapEligible()).toBe(false);
    });

    it('returns true when eligible', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      monitor.reset('s-1', '/p');
      for (let i = 0; i < 25; i++) monitor.recordMessage();

      // Advance time past the 10-minute cooldown
      vi.advanceTimersByTime(11 * 60 * 1000);

      expect(monitor.getRecapEligible()).toBe(true);
    });

    it('returns false after markRecap within cooldown', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      monitor.reset('s-1', '/p');
      for (let i = 0; i < 25; i++) monitor.recordMessage();

      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(monitor.getRecapEligible()).toBe(true);

      // After markRecap, timer resets
      monitor.markRecap();
      expect(monitor.getRecapEligible()).toBe(false);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles zero messages gracefully', () => {
      const stats = monitor.getStats();
      expect(stats.messageCount).toBe(0);
      expect(stats.toolCallCount).toBe(0);
      expect(stats.touchedFiles).toEqual([]);
    });

    it('handles many file writes', () => {
      const files = Array.from({ length: 100 }, (_, i) => `file-${i}.ts`);
      for (const f of files) monitor.recordFileWrite(f);
      expect(monitor.fileCount).toBe(100);
    });

    it('file writes are sorted in stats', () => {
      monitor.recordFileWrite('z.ts');
      monitor.recordFileWrite('a.ts');
      const stats = monitor.getStats();
      expect(stats.touchedFiles).toEqual(['a.ts', 'z.ts']);
    });
  });
});
