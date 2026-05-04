import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pi-telemetry', () => {
  const mockTelemetry = {
    recordToolInvocation: vi.fn(),
    recordToolResult: vi.fn(),
    recordTokens: vi.fn(),
    recordError: vi.fn(),
    recordCost: vi.fn(),
    heartbeat: vi.fn(),
    register: vi.fn(),
  };
  return {
    getTelemetry: vi.fn(() => mockTelemetry),
    default: vi.fn(),
  };
});

const { MetricsCollector } = await import('../../metrics/metrics-collector.js');
import type { SessionStats } from '../../shared/types.js';

const mockSessionStats: SessionStats = {
  sessionId: 'test-session',
  cwd: '/project',
  startedAt: Date.now(),
  messageCount: 50,
  turnCount: 10,
  toolCallCount: 30,
  bashCallCount: 15,
  prunedCount: 5,
  totalProcessed: 100,
  touchedFiles: ['src/a.ts', 'src/b.ts'],
  tokenUsage: null,
};

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let mockTelemetry: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    collector = new MetricsCollector();
    const { getTelemetry } = await import('pi-telemetry');
    mockTelemetry = getTelemetry();
  });

  describe('recordSessionStart', () => {
    it('records session start metrics', () => {
      collector.recordSessionStart({ filesIndexed: 1234, depEdges: 567, indexSource: 'fresh' });

      expect(mockTelemetry.recordToolInvocation).toHaveBeenCalledWith('pi-slim', 'session-index');
      expect(mockTelemetry.recordToolResult).toHaveBeenCalledWith('pi-slim', 'session-index', 0, false);
    });
  });

  describe('recordInjection', () => {
    it('records injection metrics', () => {
      collector.recordInjection('repo-map', 3500);
      expect(mockTelemetry.recordToolInvocation).toHaveBeenCalledWith('pi-slim', 'repo-map');

      collector.recordInjection('dep-context', 2400, 5);
      expect(mockTelemetry.recordToolInvocation).toHaveBeenCalledWith('pi-slim', 'dep-context');
    });

    it('records token usage', () => {
      collector.recordInjection('repo-map', 3500);
      expect(mockTelemetry.recordTokens).toHaveBeenCalledWith('pi-slim', { input: 3500, output: 0 });
    });
  });

  describe('recordPruning', () => {
    it('records pruning metrics', () => {
      collector.recordPruning({ rulesApplied: ['dedup', 'error-purge'], removed: 5, total: 20 });

      expect(mockTelemetry.recordToolInvocation).toHaveBeenCalledWith('pi-slim', 'pruning');
      expect(mockTelemetry.recordToolResult).toHaveBeenCalledWith('pi-slim', 'pruning', 0, false);
    });
  });

  describe('recordContextUsage', () => {
    it('records context usage', () => {
      collector.recordContextUsage(mockSessionStats);

      expect(mockTelemetry.recordToolInvocation).toHaveBeenCalledWith('pi-slim', 'context-monitor');
    });
  });

  describe('recordAutomation', () => {
    it('records automation events', () => {
      collector.recordAutomation('recap-hint', 'Consider /recap');

      expect(mockTelemetry.recordToolInvocation).toHaveBeenCalledWith('pi-slim', 'automation');
    });
  });

  describe('recordError', () => {
    it('records errors', () => {
      collector.recordError('cache_corrupt', 'Store corrupted');

      expect(mockTelemetry.recordError).toHaveBeenCalledWith('pi-slim', 'cache_corrupt', 'Store corrupted');
    });
  });

  describe('recordHeartbeat', () => {
    it('records heartbeats', () => {
      collector.recordHeartbeat('healthy');
      expect(mockTelemetry.heartbeat).toHaveBeenCalledWith('pi-slim', { status: 'healthy', error: undefined });

      collector.recordHeartbeat('error', 'Indexing failed');
      expect(mockTelemetry.heartbeat).toHaveBeenCalledWith('pi-slim', { status: 'error', error: 'Indexing failed' });
    });
  });

  describe('recordSessionEnd', () => {
    it('records session end metrics', () => {
      collector.recordSessionEnd(mockSessionStats);

      expect(mockTelemetry.recordToolInvocation).toHaveBeenCalledWith('pi-slim', 'session-end');
      expect(mockTelemetry.recordToolResult).toHaveBeenCalledWith('pi-slim', 'session-end', 0, false);
    });
  });

  describe('null safety', () => {
    it('handles null telemetry gracefully', async () => {
      const { getTelemetry } = await import('pi-telemetry');
      (getTelemetry as any).mockReturnValue(null);

      expect(() => {
        collector.recordSessionStart({ filesIndexed: 0, depEdges: 0, indexSource: 'test' });
        collector.recordInjection('test', 0);
        collector.recordPruning({ rulesApplied: [], removed: 0, total: 0 });
        collector.recordContextUsage(mockSessionStats);
        collector.recordAutomation('test', 'test');
        collector.recordError('test', 'test');
        collector.recordHeartbeat('healthy');
        collector.recordSessionEnd(mockSessionStats);
      }).not.toThrow();
    });
  });
});
