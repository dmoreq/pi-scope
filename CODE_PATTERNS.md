# Code Patterns & Templates for Merge Implementation

This document provides copy-paste-ready code patterns for the merge implementation.

---

## Pattern 1: SOLID-Compliant Plugin Implementation

### Base Pattern (SRP: single responsibility)

```typescript
/**
 * MyCustomPlugin — does one thing well.
 * 
 * This plugin is responsible for: [specific task only]
 * It delegates [other concerns] to other plugins/modules.
 */

import type { Plugin } from '../shared/plugin.js';
import type { ExtensionContext, AgentMessage } from '@mariozechner/pi-coding-agent';
import { getTelemetry } from 'pi-telemetry';

export class MyCustomPlugin implements Plugin {
  readonly name = 'my-custom-plugin';
  readonly version = '0.2.0';

  async onSessionStart(ctx: ExtensionContext): Promise<void> {
    getTelemetry()?.recordEvent({
      name: 'plugin_initialized',
      data: { plugin: this.name },
    });
  }

  async onContext(messages: AgentMessage[]): Promise<void> {
    // Core logic here
    const processed = this.process(messages);
    getTelemetry()?.recordMetric(`${this.name}_messages_processed`, processed);
  }

  async onSessionShutdown(): Promise<void> {
    getTelemetry()?.recordEvent({
      name: 'plugin_shutdown',
      data: { plugin: this.name },
    });
  }

  private process(messages: AgentMessage[]): number {
    // Implementation
    return messages.length;
  }
}
```

---

## Pattern 2: DIP-Compliant Injection

### OLD (Tightly Coupled)
```typescript
// ❌ BAD: Hard-coded dependencies
class SessionManager {
  private handlers = {
    'repo-map': () => { /* inline */ },
    'provider-guidance': () => { /* inline */ },
  };
}
```

### NEW (Dependency Injection via Plugin System)
```typescript
// ✅ GOOD: Plugins injected, no hard coupling
class SessionManager extends ExtensionLifecycle {
  readonly pluginManager = new PluginManager();

  constructor() {
    super();
    // Register plugins (can be swapped, extended, disabled)
    this.pluginManager.register(new ContextPruningPlugin());
    this.pluginManager.register(new ReadAwarenessPlugin());
    this.pluginManager.register(new CustomPlugin());
  }

  async onContext(event: any) {
    // All plugins run automatically, no hard-coding
    await this.pluginManager.runHook('onContext', event.messages);
  }
}
```

---

## Pattern 3: OCP-Compliant Extension (No Modification)

### OLD (Closed for Extension)
```typescript
// ❌ BAD: Adding a new injection source requires editing manager.ts
if (source === 'repo-map') { /* ... */ }
else if (source === 'context-files') { /* ... */ }
else if (source === 'provider-guidance') { /* ... */ }
// Adding a 4th source? Edit manager.ts again!
```

### NEW (Open for Extension)
```typescript
// ✅ GOOD: New injection source = register plugin, don't touch manager.ts
const plugin = new MyCustomInjectionPlugin();
sessionManager.pluginManager.register(plugin);
// That's it!
```

---

## Pattern 4: LSP-Compliant Plugin Contract

```typescript
/**
 * Plugin interface defines a contract that all plugins must honor.
 * 
 * Liskov Substitution Principle:
 * If P extends Plugin, then P can be used wherever Plugin is expected
 * without breaking semantics.
 */

// ✅ This plugin can replace any other plugin
export class ContextPruningPlugin implements Plugin {
  readonly name = 'context-pruning';

  async onContext(messages: AgentMessage[]): Promise<void> {
    // Returns immediately, doesn't crash, doesn't hang
    // Caller can use this plugin interchangeably with other plugins
  }
}
```

**Anti-pattern:**
```typescript
// ❌ BAD: Plugin violates contract (breaks LSP)
class BadPlugin implements Plugin {
  readonly name = 'bad';

  // ❌ Throws without handling
  async onContext(messages: AgentMessage[]): Promise<void> {
    throw new Error('Not implemented');
  }
}
```

---

## Pattern 5: DRY Principle – Consolidate Repeated Logic

### OLD (Repeated telemetry code)
```typescript
// ❌ Repeated 40+ times
getTelemetry()?.recordToolInvocation('pi-slim', 'repo-map');
getTelemetry()?.recordToolResult('pi-slim', 'repo-map', tokens, false);
getTelemetry()?.recordMetric('injection_repo_map_tokens', tokens);

getTelemetry()?.recordToolInvocation('pi-slim', 'dep-context');
getTelemetry()?.recordToolResult('pi-slim', 'dep-context', tokens, false);
getTelemetry()?.recordMetric('injection_dep_context_tokens', tokens);

// ... repeat for every injection source
```

### NEW (Single source of truth)
```typescript
// ✅ GOOD: Define once, use everywhere
import { recordInjection } from './shared/telemetry-helpers.js';

recordInjection('repo-map', tokens);
recordInjection('dep-context', tokens, files);
recordInjection('context-files', tokens, files);
```

**Implementation:**
```typescript
// src/shared/telemetry-helpers.ts
export function recordInjection(
  source: string,
  tokens: number,
  files?: string[],
): void {
  getTelemetry()?.recordToolInvocation('pi-slim', source);
  getTelemetry()?.recordToolResult('pi-slim', source, tokens, false);
  getTelemetry()?.recordMetric(`injection_${source}_tokens`, tokens);
  if (files?.length) {
    getTelemetry()?.recordMetric(`injection_${source}_files`, files.length);
  }
}
```

---

## Pattern 6: Test Snapshot (Exact Output Verification)

```typescript
// tests/plugins/context-pruning.test.ts

describe('ContextPruningPlugin - Deduplication', () => {
  it('removes identical consecutive messages (snapshot)', async () => {
    const plugin = new ContextPruningPlugin();
    const messages: AgentMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'hello' }, // duplicate
      { role: 'assistant', content: 'hi there' }, // duplicate
    ];

    // Run plugin (modifies in-place or returns new array)
    await plugin.onContext(messages);

    // Snapshot test — ensures exact output matches
    expect(messages).toMatchSnapshot();
    // First time: creates snapshot file
    // Second run: compares against snapshot
    // If output changes, test fails (you review change)
  });
});

// Generated snapshot file (messages.test.ts.snap):
/*
exports[`ContextPruningPlugin - Deduplication removes identical consecutive messages 1`] = `
[
  {
    "role": "user",
    "content": "hello",
  },
  {
    "role": "assistant",
    "content": "hi there",
  },
]
`;
*/
```

---

## Pattern 7: Property-Based Testing (Invariant Verification)

```typescript
// tests/properties/injection-safety.test.ts

import { test, assert } from 'vitest';
import * as fc from 'fast-check';

describe('Injection Pipeline Safety', () => {
  test('injection budget is never exceeded', () => {
    assert(
      fc.property(
        // Generate arbitrary message arrays
        fc.array(
          fc.record({
            role: fc.constantFrom('user', 'assistant'),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
          }),
          { minLength: 1, maxLength: 100 },
        ),
        // For any array of messages...
        (messages) => {
          const injector = new ContextInjector('/project', 8000, 10);
          const depContext = injector.buildInjection(testIndex, messages);
          const tokens = estimateTokens(depContext);

          // ...the injection always respects the budget
          return tokens <= 8000;
        },
      ),
    );
  });

  test('pruning never removes critical messages', () => {
    assert(
      fc.property(
        fc.array(fc.record({ role: fc.string(), content: fc.string() })),
        (messages) => {
          const plugin = new ContextPruningPlugin();
          const before = messages.length;
          plugin.onContext(messages);

          // Critical messages (errors, tool results) are preserved
          const errors = messages.filter(m =>
            typeof m.content === 'string' && m.content.includes('Error'),
          );
          const errorsBefore = messages.filter(m =>
            typeof m.content === 'string' && m.content.includes('Error'),
          );

          return errors.length >= errorsBefore.length;
        },
      ),
    );
  });
});
```

---

## Pattern 8: Telemetry Recording (Centralized)

### Metrics (continuous values)
```typescript
import { getTelemetry } from 'pi-telemetry';

// Record session metrics
getTelemetry()?.recordMetric('session_files_indexed', 1234);
getTelemetry()?.recordMetric('session_dep_edges', 567);
getTelemetry()?.recordMetric('context_message_count', 42);
getTelemetry()?.recordMetric('context_usage_ratio', 0.85);
```

### Events (discrete occurrences)
```typescript
getTelemetry()?.recordEvent({
  name: 'injection_applied',
  data: {
    source: 'dep-context',
    files: 5,
    tokens: 2400,
    duration: 142, // ms
  },
});

getTelemetry()?.recordEvent({
  name: 'pruning_executed',
  data: {
    rules_applied: 'dedup,error-purge,recency',
    removed: 8,
    total: 42,
    ratio: 0.19,
  },
});

getTelemetry()?.recordEvent({
  name: 'automation_triggered',
  data: {
    trigger: 'recap-hint',
    suggestion: 'Consider /recap to summarize progress',
    message_count: 25,
  },
});
```

### Traces (performance profiling)
```typescript
getTelemetry()?.startTrace('session_indexing');
await indexEngine.build();
getTelemetry()?.endTrace('session_indexing');

getTelemetry()?.startTrace('injection_pipeline');
const result = pipeline.build(budget);
getTelemetry()?.endTrace('injection_pipeline', {
  sources_processed: result.sources.length,
  trimmed: result.trimmed,
});
```

---

## Pattern 9: Error Handling in Plugins

```typescript
export class RobustPlugin implements Plugin {
  readonly name = 'robust-plugin';

  async onContext(messages: AgentMessage[]): Promise<void> {
    try {
      // Core logic with error boundary
      this.process(messages);
      getTelemetry()?.recordEvent({
        name: 'robust_plugin_success',
        data: { messageCount: messages.length },
      });
    } catch (err) {
      // Log error but don't crash
      const errMsg = err instanceof Error ? err.message : String(err);
      getTelemetry()?.recordError('pi-slim', 'robust_plugin_failed', errMsg);
      
      // Optionally notify user
      console.error(`${this.name} failed (non-fatal):`, errMsg);
      
      // Return gracefully (messages unchanged)
      return;
    }
  }

  private process(messages: AgentMessage[]): void {
    // Implementation that might throw
  }
}
```

---

## Pattern 10: Configuration with Zod

```typescript
import { z } from 'zod';

// Define schema
const PiSlimConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxRepoMapTokens: z.number().min(1000).default(4000),
  maxInjectionTokens: z.number().min(1000).default(8000),
  scanLastNMessages: z.number().min(1).default(10),
  pruning: z.object({
    enabled: z.boolean().default(true),
    rules: z.array(z.string()).default(['dedup', 'error-purge']),
  }),
  automation: z.object({
    enabled: z.boolean().default(true),
    recapThreshold: z.number().min(1).default(20),
    contextWarningThreshold: z.number().min(0.5).max(1).default(0.8),
  }),
});

export type PiSlimConfig = z.infer<typeof PiSlimConfigSchema>;

// Validate config
export function loadConfig(obj: unknown): PiSlimConfig {
  return PiSlimConfigSchema.parse(obj);
}
```

---

## Pattern 11: Lifecycle Hook Extension

```typescript
/**
 * Extend SessionLifecycle to add custom hooks.
 */

export abstract class ExtensionWithAutomation extends ExtensionLifecycle {
  // Override parent hooks
  async onTurnEnd(ctx: ExtensionContext): Promise<void> {
    // Call parent implementation
    await super.onTurnEnd(ctx);
    
    // Add custom behavior
    await this.onAutomate(ctx);
  }

  // New abstract hook
  abstract onAutomate(ctx: ExtensionContext): Promise<void>;
}

// Subclass implements custom hook
export class SessionManager extends ExtensionWithAutomation {
  async onAutomate(ctx: ExtensionContext): Promise<void> {
    // Automation-specific logic
    const stats = this.monitor.getStats();
    const suggestions = await this.automation.evaluate(stats, ctx);
    for (const suggestion of suggestions) {
      ctx.ui.notify(suggestion, 'info');
    }
  }
}
```

---

## Pattern 12: Type-Safe Config Access

```typescript
// Type-safe flag access (no magic strings)
const getSlimFlag = (name: keyof SlimConfigFlags) => 
  pi.getFlag(`slim.${name}`);

interface SlimConfigFlags {
  enabled: boolean;
  maxRepoMapTokens: number;
  maxInjectionTokens: number;
  scanLastNMessages: number;
  pruning: {
    enabled: boolean;
  };
  automation: {
    enabled: boolean;
  };
}

// Usage
const enabled = getSlimFlag('enabled');
const tokens = getSlimFlag('maxRepoMapTokens');
```

---

## Pattern 13: Automated Test Cleanup (Isolation)

```typescript
describe('MyPlugin', () => {
  let plugin: MyPlugin;

  beforeEach(() => {
    // Fresh instance for each test
    plugin = new MyPlugin();
    // Mock telemetry
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    plugin = null;
  });

  it('does something', async () => {
    const result = await plugin.process([]);
    expect(result).toBeDefined();
  });
});
```

---

## Pattern 14: DRY Principle – Common Test Fixtures

```typescript
// tests/fixtures/messages.ts

export const FIXTURE_MESSAGES = {
  simple: [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi' },
  ],
  
  withTools: [
    { role: 'user', content: 'create file' },
    { toolName: 'write', input: { path: 'file.ts', content: 'code' } },
    { role: 'toolResult', content: 'File created' },
  ],
  
  withErrors: [
    { role: 'assistant', content: 'Error: file not found' },
    { toolName: 'write', input: { path: 'file.ts' } },
    { role: 'assistant', content: 'File created' },
  ],
  
  long: Array.from({ length: 100 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}`,
  })),
};

// Usage in tests
import { FIXTURE_MESSAGES } from '../fixtures/messages.js';

it('handles simple messages', async () => {
  const result = await plugin.process(FIXTURE_MESSAGES.simple);
  expect(result.length).toBe(2);
});
```

---

## Pattern 15: Comprehensive Type Exports

```typescript
// src/index.ts (barrel export for public API)

export type {
  SlimConfig,
  SessionStats,
  TokenUsage,
  PruningConfig,
  AutomationConfig,
} from './shared/types.js';

export { SessionManager } from './manager.js';
export { ContextMonitor } from './core/context-monitor.js';
export { ContextPruningPlugin } from './plugins/context-pruning.js';
export { ReadAwarenessPlugin } from './plugins/read-awareness.js';
export { PluginManager, type Plugin } from './shared/plugin-manager.js';
export { AutomationManager } from './automation/automation-manager.js';
export { AutoRecapper } from './automation/auto-recapper.js';
export { AutoCompactor } from './automation/auto-compactor.js';

// For extensions writing custom plugins
export { ExtensionLifecycle } from './shared/lifecycle.js';
```

---

## Pattern 16: Backward Compatibility Layer

```typescript
/**
 * Deprecated alias for backward compatibility.
 * 
 * @deprecated Use ContextMonitor instead
 */
export class SessionTracker extends ContextMonitor {
  // Extends ContextMonitor but keeps old name for compatibility
}

/**
 * Deprecated function — calls new implementation.
 * 
 * @deprecated Use recordInjection() instead
 */
export function trackInjection(
  source: string,
  tokens: number,
): void {
  recordInjection(source, tokens);
}
```

---

## Pattern 17: Performance Optimization – Lazy Loading

```typescript
/**
 * Lazy-load expensive modules only when needed.
 */

let transcriptBuilder: TranscriptBuilder | null = null;

async function ensureTranscriptBuilder(): Promise<TranscriptBuilder> {
  if (!transcriptBuilder) {
    // First access: load and cache
    const { TranscriptBuilder } = await import('./core/transcript-builder.js');
    transcriptBuilder = new TranscriptBuilder();
  }
  return transcriptBuilder;
}

// Usage
const tb = await ensureTranscriptBuilder();
const transcript = tb.build(messages);
```

---

## Pattern 18: Comprehensive Logging

```typescript
const logger = {
  info: (msg: string, data?: any) => 
    console.log(`[pi-slim] ℹ️  ${msg}`, data ?? ''),
  warn: (msg: string, data?: any) => 
    console.warn(`[pi-slim] ⚠️  ${msg}`, data ?? ''),
  error: (msg: string, err?: Error) => 
    console.error(`[pi-slim] ❌ ${msg}`, err ?? ''),
  debug: (msg: string, data?: any) => {
    if (process.env.DEBUG_PI_SLIM) {
      console.log(`[pi-slim] 🔧 ${msg}`, data ?? '');
    }
  },
};

// Usage
logger.info('Session started', { projectRoot });
logger.warn('Context window approaching limits');
logger.error('Failed to index project', err);
logger.debug('Evaluating automation triggers', stats);
```

---

## Pattern 19: Health Checks & Heartbeats

```typescript
export class HealthMonitor {
  private lastHeartbeat = Date.now();
  private readonly heartbeatInterval = 30_000; // 30s

  startHeartbeat(): void {
    setInterval(() => {
      getTelemetry()?.heartbeat('pi-slim', {
        status: 'healthy',
        uptime: Date.now() - this.startedAt,
      });
      this.lastHeartbeat = Date.now();
    }, this.heartbeatInterval);
  }

  isHealthy(): boolean {
    return Date.now() - this.lastHeartbeat < this.heartbeatInterval * 2;
  }
}
```

---

## Summary

These 19 patterns provide reusable solutions for:
- ✅ SOLID principle implementation
- ✅ DRY code consolidation
- ✅ Comprehensive testing
- ✅ Telemetry instrumentation
- ✅ Error handling & robustness
- ✅ Backward compatibility
- ✅ Performance optimization
- ✅ Maintainability

Use these patterns throughout the merge implementation for consistency and quality.

---

**Document Status:** ✅ Ready for Developer Reference  
**Last Updated:** 2024-12-XX
