import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pi-telemetry', () => ({
  getTelemetry: vi.fn(() => ({
    recordToolInvocation: vi.fn(),
    recordToolResult: vi.fn(),
  })),
  default: vi.fn(),
}));

const { AutoRecapper } = await import('../../automation/auto-recapper.js');

describe('AutoRecapper', () => {
  let recapper: AutoRecapper;

  beforeEach(() => {
    vi.clearAllMocks();
    recapper = new AutoRecapper();
  });

  describe('recap', () => {
    it('generates a recap summary', async () => {
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
        { role: 'user', content: 'create src/index.ts' },
      ];

      const recap = await recapper.recap(messages, 'recap-hint');

      expect(recap).toContain('Session Recap');
      expect(recap).toContain('Messages: 3');
      expect(recap).toContain('recap-hint');
    });

    it('counts tool calls', async () => {
      const messages = [
        { role: 'user', content: 'do something' },
        { toolName: 'bash', content: 'npm test' },
        { toolName: 'write', input: { path: 'test.ts' } },
      ];

      const recap = await recapper.recap(messages, 'test');
      expect(recap).toContain('Tool calls');
      expect(recap).toContain('bash');
      expect(recap).toContain('write');
    });

    it('lists referenced files', async () => {
      const messages = [
        { role: 'user', content: 'check src/index.ts and src/utils.ts' },
      ];

      const recap = await recapper.recap(messages, 'test');
      expect(recap).toContain('src/index.ts');
      expect(recap).toContain('src/utils.ts');
    });

    it('handles empty messages', async () => {
      const recap = await recapper.recap([], 'empty');
      expect(recap).toContain('Messages: 0');
    });

    it('generates recap output correctly', async () => {
      const recap = await recapper.recap([{ role: 'user', content: 'hi' }], 'test');
      expect(recap).toContain('Trigger: test');
      expect(recap).toContain('Messages: 1');
    });
  });

  describe('buildHandoffContext', () => {
    it('builds handoff with goal', async () => {
      const messages = [
        { role: 'user', content: 'implement auth' },
        { role: 'assistant', content: 'done' },
      ];

      const handoff = await recapper.buildHandoffContext(messages, 'Implement authentication');
      expect(handoff).toContain('Context Handoff');
      expect(handoff).toContain('Implement authentication');
      expect(handoff).toContain('Messages: 2');
    });
  });
});
