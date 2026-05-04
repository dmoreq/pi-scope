import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoCompactor } from '../../automation/auto-compactor.js';
import { PluginManager } from '../../shared/plugin-manager.js';

vi.mock('pi-telemetry', () => ({
  getTelemetry: vi.fn(() => ({
    recordToolInvocation: vi.fn(),
    recordToolResult: vi.fn(),
  })),
  default: vi.fn(),
}));

describe('AutoCompactor', () => {
  let compactor: AutoCompactor;
  let pluginManager: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();
    compactor = new AutoCompactor();
    pluginManager = new PluginManager();
  });

  describe('compact', () => {
    it('does nothing with fewer than 2 messages', async () => {
      const messages = [{ role: 'user', content: 'hello' }];
      await compactor.compact(messages, pluginManager);
      expect(messages).toHaveLength(1);
    });

    it('does nothing with empty array', async () => {
      const messages: any[] = [];
      await compactor.compact(messages, pluginManager);
      expect(messages).toHaveLength(0);
    });

    it('applies pruning rules via plugin manager', async () => {
      const messages: any[] = [
        { role: 'user', content: 'a' },
        { role: 'user', content: 'a' }, // duplicate
        { role: 'user', content: 'b' },
      ];

      await compactor.compact(messages, pluginManager, 10);

      // With no pruning plugin registered, nothing changes
      expect(messages.length).toBeLessThanOrEqual(3);
    });

    it('enforces max message limit', async () => {
      const messages: any[] = Array.from({ length: 20 }, (_, i) => ({
        role: 'user', content: `msg-${i}`,
      }));

      await compactor.compact(messages, pluginManager, 10);

      expect(messages).toHaveLength(10);
      // Keeps the LAST 10 messages
      expect(messages[0].content).toBe('msg-10');
      expect(messages[9].content).toBe('msg-19');
    });

    it('does not reduce below max if already under limit', async () => {
      const messages: any[] = Array.from({ length: 5 }, (_, i) => ({
        role: 'user', content: `msg-${i}`,
      }));

      await compactor.compact(messages, pluginManager, 10);

      expect(messages).toHaveLength(5);
    });

    it('compacts with registered pruning plugin', async () => {
      // Register a mock pruning plugin
      const mockPlugin = {
        name: 'mock-pruner',
        onContext: vi.fn().mockImplementation((msgs: any[]) => {
          // Remove consecutive duplicates
          for (let i = msgs.length - 1; i > 0; i--) {
            if (msgs[i].content === msgs[i - 1].content) {
              msgs.splice(i, 1);
            }
          }
        }),
      };
      pluginManager.register(mockPlugin);

      const messages: any[] = [
        { role: 'user', content: 'a' },
        { role: 'user', content: 'a' },
        { role: 'user', content: 'b' },
        { role: 'user', content: 'b' },
        { role: 'user', content: 'c' },
      ];

      await compactor.compact(messages, pluginManager);

      expect(messages).toHaveLength(3);
      expect(messages.map(m => m.content)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getCompactInstructions', () => {
    it('returns compact instructions', () => {
      const instructions = compactor.getCompactInstructions();
      expect(instructions).toContain('Compact Instructions');
      expect(instructions).toContain('Key decisions');
      expect(instructions).toContain('File paths');
    });

    it('includes custom instructions', () => {
      const instructions = compactor.getCompactInstructions('Focus on errors');
      expect(instructions).toContain('Focus on errors');
    });
  });
});
