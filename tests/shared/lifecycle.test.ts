import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionLifecycle } from '../../shared/lifecycle.js';

// ── Mock Telemetry ─────────────────────────────────────────────────────────

vi.mock('pi-telemetry', () => {
  const mockTelemetry = {
    register: vi.fn(),
    recordToolInvocation: vi.fn(),
    recordToolResult: vi.fn(),
    recordError: vi.fn(),
    heartbeat: vi.fn(),
    notify: vi.fn(),
    recordTokens: vi.fn(),
    recordCost: vi.fn(),
  };
  return {
    getTelemetry: vi.fn(() => mockTelemetry),
    default: vi.fn(),
  };
});

// ── Test Extension ─────────────────────────────────────────────────────────

class TestExtension extends ExtensionLifecycle {
  readonly name = 'test-ext';
  readonly version = '0.1.0';
  protected readonly description = 'Test extension for unit tests';
  protected readonly tools = ['test-tool'];
  protected readonly events = ['session_start'];
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ExtensionLifecycle', () => {
  let ext: TestExtension;
  let mockTelemetry: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    ext = new TestExtension();

    // Get fresh mock instances
    const { getTelemetry } = await import('pi-telemetry');
    mockTelemetry = getTelemetry() as any;
  });

  describe('basics', () => {
    it('exposes name and version', () => {
      expect(ext.name).toBe('test-ext');
      expect(ext.version).toBe('0.1.0');
    });

    it('registers with telemetry on first use', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      await ext.onSessionStart({ type: 'session_start' } as any, {} as any);

      expect(t!.register).toHaveBeenCalledWith({
        name: 'test-ext',
        version: '0.1.0',
        description: 'Test extension for unit tests',
        tools: ['test-tool'],
        events: ['session_start'],
      });
    });

    it('does not re-register telemetry on subsequent calls', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      await ext.onSessionStart({ type: 'session_start' } as any, {} as any);
      await ext.onSessionStart({ type: 'session_start' } as any, {} as any);

      expect(t!.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle hooks', () => {
    it('onSessionStart returns without error', async () => {
      await expect(
        ext.onSessionStart({ type: 'session_start' } as any, {} as any),
      ).resolves.toBeUndefined();
    });

    it('onBeforeAgentStart returns undefined by default', async () => {
      const result = await ext.onBeforeAgentStart(
        { type: 'before_agent_start', systemPrompt: 'test', prompt: 'test' } as any,
        {} as any,
      );
      expect(result).toBeUndefined();
    });

    it('onContext returns undefined by default', async () => {
      const result = await ext.onContext(
        { type: 'context', messages: [] },
        {} as any,
      );
      expect(result).toBeUndefined();
    });

    it('onTurnEnd returns without error', async () => {
      await expect(ext.onTurnEnd({} as any)).resolves.toBeUndefined();
    });

    it('onAgentEnd returns without error', async () => {
      await expect(ext.onAgentEnd({ type: 'agent_end' } as any, {} as any)).resolves.toBeUndefined();
    });

    it('onToolCall returns undefined by default', async () => {
      const result = await ext.onToolCall(
        { toolName: 'test', input: {} },
        {} as any,
      );
      expect(result).toBeUndefined();
    });

    it('onSessionShutdown returns without error', async () => {
      await expect(ext.onSessionShutdown()).resolves.toBeUndefined();
    });
  });

  describe('telemetry helpers', () => {
    it('recordToolInvocation calls telemetry', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      ext['recordToolInvocation']('test-tool');

      expect(t!.recordToolInvocation).toHaveBeenCalledWith('test-ext', 'test-tool');
    });

    it('recordToolResult calls telemetry', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      ext['recordToolResult']('test-tool', 100, false);

      expect(t!.recordToolResult).toHaveBeenCalledWith('test-ext', 'test-tool', 100, false);
    });

    it('recordError calls telemetry', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      ext['recordError']('timeout', 'Something failed', 'stack trace');

      expect(t!.recordError).toHaveBeenCalledWith('test-ext', 'timeout', 'Something failed', 'stack trace');
    });

    it('heartbeat calls telemetry', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      ext['heartbeat']('healthy');

      expect(t!.heartbeat).toHaveBeenCalledWith('test-ext', { status: 'healthy', error: undefined });
    });

    it('notify calls telemetry', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      ext['notify']('Hello');

      expect(t!.notify).toHaveBeenCalledWith('Hello', undefined);
    });

    it('recordTokens calls telemetry', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      ext['recordTokens']({ input: 100, output: 50 });

      expect(t!.recordTokens).toHaveBeenCalledWith('test-ext', { input: 100, output: 50 });
    });

    it('recordCost calls telemetry', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      const t = getTelemetry();

      ext['recordCost'](0.005);

      expect(t!.recordCost).toHaveBeenCalledWith('test-ext', 0.005);
    });

    it('all telemetry helpers handle telemetry being null gracefully', async () => {
      const piTelemetry = await import('pi-telemetry');
      const originalGet = piTelemetry.getTelemetry;

      // Temporarily make getTelemetry return null
      (piTelemetry.getTelemetry as any).mockReturnValue(null);

      expect(() => {
        ext['recordToolInvocation']('test');
        ext['recordToolResult']('test', 0, false);
        ext['recordError']('test', 'msg');
        ext['heartbeat']();
        ext['notify']('test');
        ext['recordTokens']({ input: 0, output: 0 });
        ext['recordCost'](0);
        ext['track']('test');
      }).not.toThrow();

      // Restore
      (piTelemetry.getTelemetry as any).mockReturnValue(originalGet());
    });
  });

  describe('custom extension subclass', () => {
    it('can override hooks', async () => {
      const hookCalls: string[] = [];
      class CustomExt extends ExtensionLifecycle {
        readonly name = 'custom';
        readonly version = '1.0.0';
        protected readonly description = 'Custom';
        protected readonly tools: string[] = [];
        protected readonly events: string[] = [];

        async onSessionStart() { hookCalls.push('start'); }
        async onTurnEnd() { hookCalls.push('turnEnd'); }
        async onSessionShutdown() { hookCalls.push('shutdown'); }
      }

      const custom = new CustomExt();
      await custom.onSessionStart({} as any, {} as any);
      await custom.onTurnEnd({} as any);
      await custom.onSessionShutdown();

      expect(hookCalls).toEqual(['start', 'turnEnd', 'shutdown']);
    });
  });
});
