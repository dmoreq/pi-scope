import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AutomationManager, type AutomationTrigger } from '../../automation/automation-manager.js';
import type { ExtensionContext } from '../../extension.js';

// ── Mock Context ───────────────────────────────────────────────────────────

const mockCtx = {} as ExtensionContext;
const mockStats = { messageCount: 25, toolCallCount: 10, bashCallCount: 3 };

// ── Create a simple test trigger ───────────────────────────────────────────

const createTrigger = (
  id: string,
  suggestion: string | null,
  cooldownMs = 1000,
): AutomationTrigger => ({
  id,
  check: () => suggestion,
  cooldownMs,
});

describe('AutomationManager', () => {
  let manager: AutomationManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new AutomationManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registration', () => {
    it('registers a trigger', () => {
      const trigger = createTrigger('test', 'Hello');
      manager.register(trigger);
      expect(manager.get('test')).toBe(trigger);
      expect(manager.count).toBe(1);
    });

    it('prevents duplicate registration', () => {
      manager.register(createTrigger('dup', 'a'));
      expect(() => manager.register(createTrigger('dup', 'b'))).toThrow();
    });

    it('unregisters a trigger', () => {
      manager.register(createTrigger('t', 'test'));
      expect(manager.unregister('t')).toBe(true);
      expect(manager.get('t')).toBeUndefined();
    });

    it('lists all triggers', () => {
      manager.register(createTrigger('a', 'a'));
      manager.register(createTrigger('b', 'b'));
      expect(manager.getAll()).toHaveLength(2);
    });

    it('clears triggers', () => {
      manager.register(createTrigger('a', 'a'));
      manager.clear();
      expect(manager.count).toBe(0);
    });
  });

  describe('evaluate', () => {
    it('returns suggestions from firing triggers', async () => {
      manager.register(createTrigger('t1', 'Suggestion 1'));
      manager.register(createTrigger('t2', 'Suggestion 2'));

      const suggestions = await manager.evaluate(mockStats, mockCtx);
      expect(suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
    });

    it('returns empty array when no triggers fire', async () => {
      manager.register(createTrigger('t1', null));
      const suggestions = await manager.evaluate(mockStats, mockCtx);
      expect(suggestions).toEqual([]);
    });

    it('returns empty array when no triggers registered', async () => {
      const suggestions = await manager.evaluate(mockStats, mockCtx);
      expect(suggestions).toEqual([]);
    });

    it('respects cooldown', async () => {
      manager.register(createTrigger('cooldown', 'Fire!', 5000));

      // First fire
      const first = await manager.evaluate(mockStats, mockCtx);
      expect(first).toEqual(['Fire!']);

      // Immediate re-evaluate — still in cooldown
      const second = await manager.evaluate(mockStats, mockCtx);
      expect(second).toEqual([]);

      // Advance past cooldown
      vi.advanceTimersByTime(5001);

      // Should fire again
      const third = await manager.evaluate(mockStats, mockCtx);
      expect(third).toEqual(['Fire!']);
    });

    it('skips triggers on error', async () => {
      const errorTrigger: AutomationTrigger = {
        id: 'broken',
        check: () => { throw new Error('Oops'); },
        cooldownMs: 1000,
      };
      manager.register(errorTrigger);
      manager.register(createTrigger('good', 'Working'));

      const suggestions = await manager.evaluate(mockStats, mockCtx);
      expect(suggestions).toEqual(['Working']);
    });

    it('returns empty array when disabled', async () => {
      manager.enabled = false;
      manager.register(createTrigger('t', 'Should not fire'));

      const suggestions = await manager.evaluate(mockStats, mockCtx);
      expect(suggestions).toEqual([]);
    });

    it('executes trigger action', async () => {
      const action = vi.fn().mockResolvedValue(undefined);
      manager.register({
        id: 'with-action',
        check: () => 'Action!',
        action,
        cooldownMs: 1000,
      });

      await manager.evaluate(mockStats, mockCtx);

      expect(action).toHaveBeenCalledOnce();
      expect(action).toHaveBeenCalledWith(mockStats, mockCtx);
    });
  });

  describe('enabled/disabled', () => {
    it('is enabled by default', () => {
      expect(manager.enabled).toBe(true);
    });

    it('can be toggled', () => {
      manager.enabled = false;
      expect(manager.enabled).toBe(false);
      manager.enabled = true;
      expect(manager.enabled).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('resets cooldowns', async () => {
      manager.register(createTrigger('t', 'Fire!', 60000));

      await manager.evaluate(mockStats, mockCtx);
      // Still in cooldown
      expect(await manager.evaluate(mockStats, mockCtx)).toEqual([]);

      manager.clearHistory();

      // Should fire again immediately
      expect(await manager.evaluate(mockStats, mockCtx)).toEqual(['Fire!']);
    });
  });
});
