import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BUILT_IN_TRIGGERS } from '../../automation/triggers.js';
import type { ExtensionContext } from '../../extension.js';

const mockCtx = {} as ExtensionContext;

describe('BUILT_IN_TRIGGERS', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recap-hint', () => {
    const trigger = BUILT_IN_TRIGGERS.find(t => t.id === 'recap-hint')!;

    it('suggests recap when message count > 20 and last recap > 10 min ago', () => {
      const result = trigger.check(
        { messageCount: 25, lastRecapAt: Date.now() - 11 * 60 * 1000 },
        mockCtx,
      );
      expect(result).toContain('recap');
      expect(result).toContain('25');
    });

    it('returns null when message count <= 20', () => {
      const result = trigger.check(
        { messageCount: 15, lastRecapAt: Date.now() - 20 * 60 * 1000 },
        mockCtx,
      );
      expect(result).toBeNull();
    });

    it('returns null when recap was recent (< 10 min)', () => {
      const result = trigger.check(
        { messageCount: 25, lastRecapAt: Date.now() - 5 * 60 * 1000 },
        mockCtx,
      );
      expect(result).toBeNull();
    });

    it('has cooldown of 5 minutes', () => {
      expect(trigger.cooldownMs).toBe(5 * 60 * 1000);
    });
  });

  describe('context-warning', () => {
    const trigger = BUILT_IN_TRIGGERS.find(t => t.id === 'context-warning')!;

    it('returns critical when ratio >= 90%', () => {
      const result = trigger.check(
        { tokenUsage: { total: 9000, contextWindow: 10000 } },
        mockCtx,
      );
      expect(result).toContain('90%');
      expect(result).toContain('compact');
    });

    it('returns warning when ratio >= 80%', () => {
      const result = trigger.check(
        { tokenUsage: { total: 8000, contextWindow: 10000 } },
        mockCtx,
      );
      expect(result).toContain('80%');
      expect(result).toContain('compact');
    });

    it('returns null when below 80%', () => {
      const result = trigger.check(
        { tokenUsage: { total: 7000, contextWindow: 10000 } },
        mockCtx,
      );
      expect(result).toBeNull();
    });

    it('returns null when no token usage', () => {
      const result = trigger.check({}, mockCtx);
      expect(result).toBeNull();
    });

    it('returns null when context window is 0', () => {
      const result = trigger.check(
        { tokenUsage: { total: 9000, contextWindow: 0 } },
        mockCtx,
      );
      expect(result).toBeNull();
    });

    it('has cooldown of 2 minutes', () => {
      expect(trigger.cooldownMs).toBe(2 * 60 * 1000);
    });
  });

  describe('file-tracking', () => {
    const trigger = BUILT_IN_TRIGGERS.find(t => t.id === 'file-tracking')!;

    it('suggests handoff when > 10 files modified', () => {
      const files = Array.from({ length: 15 }, (_, i) => `file-${i}.ts`);
      const result = trigger.check(
        { touchedFiles: files },
        mockCtx,
      );
      expect(result).toContain('15');
      expect(result).toContain('handoff');
    });

    it('returns null when <= 10 files', () => {
      const result = trigger.check(
        { touchedFiles: ['a.ts', 'b.ts'] },
        mockCtx,
      );
      expect(result).toBeNull();
    });

    it('returns null when no touchedFiles', () => {
      const result = trigger.check({}, mockCtx);
      expect(result).toBeNull();
    });

    it('has cooldown of 10 minutes', () => {
      expect(trigger.cooldownMs).toBe(10 * 60 * 1000);
    });
  });

  describe('high-activity', () => {
    const trigger = BUILT_IN_TRIGGERS.find(t => t.id === 'high-activity')!;

    it('suggests recap when tool calls > 50', () => {
      const result = trigger.check(
        { toolCallCount: 60, bashCallCount: 20 },
        mockCtx,
      );
      expect(result).toContain('60');
      expect(result).toContain('recap');
    });

    it('returns null when <= 50 tool calls', () => {
      const result = trigger.check(
        { toolCallCount: 30, bashCallCount: 5 },
        mockCtx,
      );
      expect(result).toBeNull();
    });

    it('has cooldown of 5 minutes', () => {
      expect(trigger.cooldownMs).toBe(5 * 60 * 1000);
    });
  });

  describe('all triggers', () => {
    it('have unique IDs', () => {
      const ids = BUILT_IN_TRIGGERS.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('have positive cooldowns', () => {
      for (const t of BUILT_IN_TRIGGERS) {
        expect(t.cooldownMs).toBeGreaterThan(0);
      }
    });

    it('have valid check functions', () => {
      for (const t of BUILT_IN_TRIGGERS) {
        expect(typeof t.check).toBe('function');
        // Should not throw with empty stats
        expect(() => t.check({}, mockCtx)).not.toThrow();
      }
    });
  });
});
