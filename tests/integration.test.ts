/**
 * End-to-end integration tests for pi-slim's core pipeline.
 *
 * Tests the interaction between ExtensionLifecycle, PluginManager,
 * ContextMonitor, and AutomationManager as an integrated system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('pi-telemetry', () => {
  const mock = {
    register: vi.fn(),
    recordToolInvocation: vi.fn(),
    recordToolResult: vi.fn(),
    recordTokens: vi.fn(),
    recordError: vi.fn(),
    heartbeat: vi.fn(),
    recordCost: vi.fn(),
    notify: vi.fn(),
  };
  return {
    getTelemetry: vi.fn(() => mock),
    default: vi.fn(),
  };
});

// ── Imports after mocks ───────────────────────────────────────────────────

const { ContextMonitor } = await import('../core/context-monitor.js');
const { PluginManager } = await import('../shared/plugin-manager.js');
const { AutomationManager } = await import('../automation/automation-manager.js');
const { BUILT_IN_TRIGGERS } = await import('../automation/triggers.js');
const { AutoRecapper } = await import('../automation/auto-recapper.js');
const { ContextPruningPlugin } = await import('../plugins/context-pruning.js');
const { recordInjection, recordSessionError, recordHeartbeat } = await import('../shared/telemetry-helpers.js');

const mockCtx = { ui: { notify: vi.fn(), setStatus: vi.fn() }, hasUI: false } as any;

describe('Integration: ContextMonitor + AutomationManager', () => {
  let monitor: ContextMonitor;
  let automation: AutomationManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    vi.clearAllMocks();

    monitor = new ContextMonitor();
    automation = new AutomationManager();
    monitor.reset('sess-int-1', '/test-project');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('automation triggers recaps when monitor reports high message count', async () => {
    automation.register(BUILT_IN_TRIGGERS[0]); // recap-hint

    // Simulate 25 messages (monitor.reset already set lastRecapAt to now)
    for (let i = 0; i < 25; i++) {
      monitor.recordMessage();
    }

    // Advance past 10-min recap cooldown
    vi.advanceTimersByTime(11 * 60 * 1000);

    const stats = monitor.getStats() as any;
    // The recap-hint trigger reads stats.lastRecapAt — it's not in SessionStats
    // but we add it for the trigger to see it
    stats.lastRecapAt = monitor.lastRecapAt;
    const suggestions = await automation.evaluate(stats, mockCtx);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('recap');
  });

  it('automation warns on context pressure', async () => {
    automation.register(BUILT_IN_TRIGGERS[1]); // context-warning

    monitor.updateTokenUsage({
      total: 9000,
      input: 7000,
      output: 2000,
      cacheRead: 0,
      cacheWrite: 0,
      contextWindow: 10000,
    });

    const stats = monitor.getStats() as any;
    const suggestions = await automation.evaluate(stats, mockCtx);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('compact');
  });

  it('automation suggests handoff when many files touched', async () => {
    automation.register(BUILT_IN_TRIGGERS[2]); // file-tracking

    for (let i = 0; i < 15; i++) {
      monitor.recordFileWrite(`src/file-${i}.ts`);
    }

    const stats = monitor.getStats() as any;
    const suggestions = await automation.evaluate(stats, mockCtx);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('handoff');
  });

  it('full lifecycle: context monitor feeding into automation', async () => {
    automation.register(BUILT_IN_TRIGGERS[0]);
    automation.register(BUILT_IN_TRIGGERS[1]);

    // Simulate a session
    monitor.reset('full-session', '/project');
    for (let i = 0; i < 25; i++) monitor.recordMessage();
    monitor.recordToolCall('bash');
    monitor.recordToolCall('write');
    monitor.recordFileWrite('src/index.ts');
    monitor.updateTokenUsage({
      total: 8500,
      input: 7000,
      output: 1500,
      cacheRead: 0,
      cacheWrite: 0,
      contextWindow: 10000,
    });

    vi.advanceTimersByTime(11 * 60 * 1000);

    const stats = monitor.getStats() as any;
    stats.lastRecapAt = monitor.lastRecapAt;
    const suggestions = await automation.evaluate(stats, mockCtx);

    // Should fire at least one trigger
    expect(suggestions.length).toBeGreaterThan(0);
    expect(stats.messageCount).toBe(25);
    expect(stats.toolCallCount).toBe(2);
    expect(stats.touchedFiles).toEqual(['src/index.ts']);
  });
});

describe('Integration: PluginManager + ContextPruningPlugin', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();
    pluginManager = new PluginManager();
  });

  it('pruning plugin removes duplicates via plugin system', async () => {
    pluginManager.register(new ContextPruningPlugin());

    const messages: any[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'hello' },
    ];

    await pluginManager.runHook('onContext', messages);

    expect(messages).toHaveLength(2);
  });

  it('read-awareness plugin blocks unread edits via plugin system', async () => {
    const { ReadAwarenessPlugin } = await import('../plugins/read-awareness.js');
    pluginManager.register(new ReadAwarenessPlugin());

    // Write without reading — blocked
    const result = await pluginManager.runToolCall(
      { toolName: 'write', input: { path: 'unread.ts', content: 'data' } },
      mockCtx,
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('has not been read');
  });

  it('read-awareness allows edits after reading', async () => {
    const { ReadAwarenessPlugin } = await import('../plugins/read-awareness.js');
    pluginManager.register(new ReadAwarenessPlugin());

    // Read first
    await pluginManager.runToolCall(
      { toolName: 'read', input: { path: 'src/index.ts' } },
      mockCtx,
    );

    // Then write — allowed
    const result = await pluginManager.runToolCall(
      { toolName: 'edit', input: { path: 'src/index.ts', oldText: 'a', newText: 'b' } },
      mockCtx,
    );

    expect(result.allowed).toBe(true);
  });
});

describe('Integration: Recapper + AutomationManager', () => {
  let recapper: AutoRecapper;
  let automation: AutomationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    recapper = new AutoRecapper();
    automation = new AutomationManager();
  });

  it('recap can be triggered by automation and produces output', async () => {
    const messages = [
      { role: 'user', content: 'implement auth flow' },
      { role: 'assistant', content: 'created src/auth.ts' },
      { toolName: 'write', input: { path: 'src/auth.ts' } },
    ];

    const recap = await recapper.recap(messages, 'recap-hint');
    expect(recap).toContain('Session Recap');
    expect(recap).toContain('src/auth.ts');
    expect(recap).toContain('Trigger: recap-hint');
  });
});

describe('Integration: Telemetry Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordInjection fires through pi-telemetry', async () => {
    recordInjection('repo-map', 3500);

    const { getTelemetry } = await import('pi-telemetry');
    const t = getTelemetry()!;
    expect(t.recordToolInvocation).toHaveBeenCalled();
  });

  it('recordHeartbeat fires through pi-telemetry', async () => {
    recordHeartbeat('healthy');
    const { getTelemetry } = await import('pi-telemetry');
    const t = getTelemetry()!;
    expect(t.heartbeat).toHaveBeenCalled();
  });

  it('recordSessionError fires through pi-telemetry', async () => {
    recordSessionError('test_type', 'test message');
    const { getTelemetry } = await import('pi-telemetry');
    const t = getTelemetry()!;
    expect(t.recordError).toHaveBeenCalled();
  });
});
