# Implementation Roadmap: Phase-by-Phase Execution Guide

This document provides step-by-step instructions for executing the merge & modernization plan.

---

## Phase 1: Analysis & Planning ✅ COMPLETE

**Status:** Done (see MERGE_PLAN.md)

### Deliverables
- ✅ MERGE_PLAN.md (30K comprehensive plan)
- ✅ Risk assessment & mitigation
- ✅ Timeline breakdown
- ✅ Module mapping table

**Next Step:** Begin Phase 2 Refactoring

---

## Phase 2: Code Extraction & Refactoring

**Duration:** 8-10 hours  
**Owner:** 1-2 developers  
**Goal:** Extract shared abstractions, adopt context-intel components, fix SOLID violations

### 2.1 Create Base Class: ExtensionLifecycle (1 hour)

**File:** `src/shared/lifecycle.ts` (NEW)

```bash
# Create file structure
mkdir -p src/shared
touch src/shared/lifecycle.ts
```

**Implementation:**
```typescript
/**
 * ExtensionLifecycle — base class for lifecycle-aware extensions.
 * 
 * Satisfies SRP: extension.ts handles wiring only, business logic
 * is implemented by subclasses (SessionManager, etc.)
 */

import type { ExtensionContext } from '@mariozechner/pi-coding-agent';

export interface NotifyOptions {
  severity?: 'info' | 'warn' | 'error' | 'success';
  badge?: { text: string; variant?: string };
}

export abstract class ExtensionLifecycle {
  abstract readonly name: string;
  abstract readonly version: string;
  protected abstract readonly description: string;
  protected abstract readonly tools: string[];
  protected abstract readonly events: string[];

  // Lifecycle hooks — override as needed
  async onSessionStart(_event: any, _ctx: ExtensionContext): Promise<void> {}
  async onBeforeAgentStart(_event: any, _ctx: ExtensionContext): Promise<void> {}
  async onContext(_event: any, _ctx: ExtensionContext): Promise<void> {}
  async onTurnEnd(_ctx: ExtensionContext): Promise<void> {}
  async onAgentEnd(_event: any, _ctx: ExtensionContext): Promise<void> {}
  async onToolCall(_event: any, _ctx: ExtensionContext): Promise<any> {}
  async onSessionShutdown(): Promise<void> {}

  // Telemetry helpers
  protected track(event: string, metadata?: Record<string, any>): void {
    const { getTelemetry } = require('pi-telemetry');
    getTelemetry()?.recordEvent({
      name: `${this.name}_${event}`,
      data: metadata,
    });
  }

  // Notification helpers
  protected notify(message: string, options?: NotifyOptions): void {
    // To be implemented by subclasses or injected
    console.log(`[${this.name}] ${message}`);
  }

  // Registration hook (for telemetry, etc.)
  protected register(): void {
    const { registerPackage } = require('./telemetry-helpers.js');
    registerPackage({
      name: this.name,
      version: this.version,
      description: this.description,
      tools: this.tools,
      events: this.events,
    });
  }
}
```

**Test:** `tests/shared/lifecycle.test.ts`
```typescript
describe('ExtensionLifecycle', () => {
  it('provides base hooks that can be overridden', () => {
    class TestExtension extends ExtensionLifecycle {
      readonly name = 'test';
      readonly version = '0.1.0';
      protected readonly description = 'Test';
      protected readonly tools = [];
      protected readonly events = [];
    }
    const ext = new TestExtension();
    expect(ext.name).toBe('test');
  });
});
```

**Checklist:**
- [ ] File created with full implementation
- [ ] All abstract methods defined
- [ ] Telemetry & notification helpers added
- [ ] Unit test passes
- [ ] No TypeScript errors

---

### 2.2 Create Plugin System (2 hours)

**Files:**
- `src/shared/plugin.ts` (interface)
- `src/shared/plugin-manager.ts` (implementation)

**File: `src/shared/plugin.ts`**
```typescript
/**
 * Plugin interface — contract for extending pi-slim.
 * 
 * Examples:
 *   - ContextPruningPlugin (removes redundant messages)
 *   - ReadAwarenessPlugin (prevents unread file edits)
 *   - TelemetryReporterPlugin (captures metrics)
 *   - CustomPlugin (user-defined)
 */

import type { ExtensionContext, AgentMessage } from '@mariozechner/pi-coding-agent';

export interface PluginToolCallResult {
  allowed: boolean;
  reason?: string;
}

export interface Plugin {
  readonly name: string;
  readonly version?: string;

  // Lifecycle hooks
  onSessionStart?(ctx: ExtensionContext): Promise<void>;
  onBeforeAgentStart?(event: any, ctx: ExtensionContext): Promise<void>;
  onContext?(messages: AgentMessage[]): Promise<void>;
  onTurnEnd?(ctx: ExtensionContext): Promise<void>;
  onAgentEnd?(event: any, ctx: ExtensionContext): Promise<void>;
  onToolCall?(event: { toolName: string; input: any }, ctx: ExtensionContext): Promise<PluginToolCallResult | undefined>;
  onSessionShutdown?(): Promise<void>;
}
```

**File: `src/shared/plugin-manager.ts`**
```typescript
/**
 * Plugin Manager — registers & delegates to plugins (OCP pattern).
 * 
 * Adding a new plugin type doesn't require changes to SessionManager,
 * just register it via pluginManager.register(plugin).
 */

import type { Plugin, PluginToolCallResult } from './plugin.js';
import type { ExtensionContext, AgentMessage } from '@mariozechner/pi-coding-agent';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): void {
    this.plugins.delete(name);
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  async runHook(
    hook: 'onSessionStart' | 'onBeforeAgentStart' | 'onContext' | 'onTurnEnd' | 'onAgentEnd' | 'onSessionShutdown',
    ...args: any[]
  ): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const fn = plugin[hook] as any;
      if (fn) {
        try {
          await fn.apply(plugin, args);
        } catch (err) {
          console.error(`Plugin ${plugin.name} hook ${hook} failed:`, err);
        }
      }
    }
  }

  async runToolCall(
    event: { toolName: string; input: any },
    ctx: ExtensionContext,
  ): Promise<PluginToolCallResult> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onToolCall) {
        try {
          const result = await plugin.onToolCall(event, ctx);
          if (result && !result.allowed) {
            return result;
          }
        } catch (err) {
          console.error(`Plugin ${plugin.name} tool call hook failed:`, err);
        }
      }
    }
    return { allowed: true };
  }
}
```

**Tests:** `tests/shared/plugin-manager.test.ts`
```typescript
describe('PluginManager', () => {
  it('registers and retrieves plugins', () => {
    const manager = new PluginManager();
    const plugin = { name: 'test-plugin' };
    manager.register(plugin);
    expect(manager.get('test-plugin')).toBe(plugin);
  });

  it('prevents duplicate registrations', () => {
    const manager = new PluginManager();
    manager.register({ name: 'test' });
    expect(() => manager.register({ name: 'test' })).toThrow();
  });

  it('runs hooks for all registered plugins', async () => {
    const manager = new PluginManager();
    const hook1 = { name: 'p1', onSessionStart: jest.fn() };
    const hook2 = { name: 'p2', onSessionStart: jest.fn() };
    manager.register(hook1);
    manager.register(hook2);
    await manager.runHook('onSessionStart', {} as any);
    expect(hook1.onSessionStart).toHaveBeenCalled();
    expect(hook2.onSessionStart).toHaveBeenCalled();
  });

  it('short-circuits on tool call rejection', async () => {
    const manager = new PluginManager();
    const reject = { name: 'reject', onToolCall: async () => ({ allowed: false, reason: 'blocked' }) };
    const allow = { name: 'allow', onToolCall: async () => ({ allowed: true }) };
    manager.register(reject);
    manager.register(allow);
    const result = await manager.runToolCall({ toolName: 'edit', input: {} }, {} as any);
    expect(result.allowed).toBe(false);
  });
});
```

**Checklist:**
- [ ] Plugin interface created
- [ ] PluginManager implemented
- [ ] Tests passing (5+ tests)
- [ ] No TypeScript errors

---

### 2.3 Adopt ContextMonitor (1.5 hours)

**File:** `src/core/context-monitor.ts` (ADOPT from context-intel)

Copy from pi-me and adapt types:
```bash
cp /Users/quy.doan/Workspace/personal/pi-me/session-lifecycle/context-intel/core/context-monitor.ts \
   /Users/quy.doan/Workspace/personal/pi-slim/src/core/context-monitor.ts
```

Then update imports:
```typescript
// Update pi-me imports to local paths
import type { TokenUsage, SessionStats } from '../shared/types.js';
```

**Tests:** `tests/core/context-monitor.test.ts`
```typescript
describe('ContextMonitor', () => {
  it('tracks message count', () => {
    const monitor = new ContextMonitor();
    monitor.reset('session-1', '/project');
    expect(monitor.messageCount).toBe(0);
    monitor.recordMessage();
    expect(monitor.messageCount).toBe(1);
  });

  it('tracks tool calls and file writes', () => {
    const monitor = new ContextMonitor();
    monitor.reset('session-1', '/project');
    monitor.recordToolCall('bash');
    monitor.recordFileWrite('/project/src/index.ts');
    expect(monitor.toolCallCount).toBe(1);
    expect(monitor.fileCount).toBe(1);
  });

  it('calculates context usage ratio', () => {
    const monitor = new ContextMonitor();
    monitor.reset('session-1', '/project');
    monitor.updateTokenUsage({ total: 8000, contextWindow: 10000, ...rest });
    expect(monitor.getContextUsageRatio()).toBe(0.8);
  });

  it('suggests compact at critical threshold', () => {
    const monitor = new ContextMonitor();
    monitor.reset('session-1', '/project');
    monitor.updateTokenUsage({ total: 9500, contextWindow: 10000, ...rest });
    expect(monitor.getCompactSuggestion()).toBe('critical');
  });
});
```

**Checklist:**
- [ ] File copied & imports updated
- [ ] Types unified in shared/types.ts
- [ ] Tests passing (8+ tests)
- [ ] ContextMonitor integrated into SessionManager

---

### 2.4 Create ContextPruningPlugin (1.5 hours)

**File:** `src/plugins/context-pruning.ts` (ADOPT from context-intel)

Adopt all 8 pruning rules:
1. Deduplication
2. Error-purging
3. Recency
4. Tool-pairing
5. Superseded-writes
6. (Add 3 new: cache-hits, short-messages, trailing-errors)

**Tests:** `tests/plugins/context-pruning.test.ts`
```typescript
describe('ContextPruningPlugin', () => {
  describe('deduplication', () => {
    it('removes identical consecutive messages', async () => { /* ... */ });
    it('preserves unique messages', async () => { /* ... */ });
  });

  describe('error-purging', () => {
    it('removes resolved errors', async () => { /* ... */ });
    it('preserves unresolved errors', async () => { /* ... */ });
  });

  describe('tool-pairing', () => {
    it('keeps tool calls with results', async () => { /* ... */ });
    it('removes orphaned tool results', async () => { /* ... */ });
  });

  // ... 5+ tests per rule
});
```

**Target:** 30+ unit tests (snapshot-based for exact outputs)

**Checklist:**
- [ ] All 8 rules implemented
- [ ] 30+ tests passing
- [ ] Snapshot tests included
- [ ] No regressions in existing functionality

---

### 2.5 Create ReadAwarenessPlugin (1 hour)

**File:** `src/plugins/read-awareness.ts` (ADOPT from context-intel)

Blocks file edits if file hasn't been read.

**Tests:** `tests/plugins/read-awareness.test.ts`
```typescript
describe('ReadAwarenessPlugin', () => {
  it('allows edit of read files', async () => { /* ... */ });
  it('blocks edit of unread files', async () => { /* ... */ });
  it('allows read operations always', async () => { /* ... */ });
});
```

**Checklist:**
- [ ] Plugin implemented
- [ ] 8+ tests passing
- [ ] Integrated with SessionManager

---

### 2.6 Consolidate Telemetry Helpers (1 hour)

**File:** `src/shared/telemetry-helpers.ts` (NEW)

```typescript
import { getTelemetry } from 'pi-telemetry';

/**
 * DRY principle: centralized telemetry patterns.
 */

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

export function recordPruning(
  rulesApplied: string[],
  removed: number,
  total: number,
): void {
  getTelemetry()?.recordEvent({
    name: 'pruning_applied',
    data: {
      rules: rulesApplied.join(','),
      removed,
      total,
      ratio: removed / total,
    },
  });
}

export function recordContextUsage(
  stats: SessionStats,
): void {
  getTelemetry()?.recordMetric('context_message_count', stats.messageCount);
  getTelemetry()?.recordMetric('context_tool_calls', stats.toolCallCount);
  getTelemetry()?.recordMetric('context_files_touched', stats.touchedFiles.length);
  if (stats.tokenUsage) {
    getTelemetry()?.recordMetric('context_token_usage', stats.tokenUsage.total);
  }
}

export function registerPackage(config: {
  name: string;
  version: string;
  description: string;
  tools: string[];
  events: string[];
}): void {
  getTelemetry()?.register(config);
}
```

**Checklist:**
- [ ] Helpers created (4 functions)
- [ ] Used in SessionManager, plugins, automation
- [ ] Reduces ~40 lines of telemetry boilerplate

---

### 2.7 Refactor SessionManager (2 hours)

**File:** `src/manager.ts` (MAJOR REFACTORING)

Extract:
- `InjectionOrchestrator` (injection pipeline logic)
- `SessionLifecycle` (lifecycle hooks)

Old SessionManager (240 lines) → New SessionManager (100 lines) that:
1. Extends ExtensionLifecycle
2. Owns PluginManager instance
3. Delegates to InjectionOrchestrator
4. Records telemetry via helpers

```typescript
export class SessionManager extends ExtensionLifecycle {
  readonly name = 'pi-slim';
  readonly version = '0.2.0';
  protected readonly description = 'AST-powered context + pruning + automation';
  protected readonly tools = ['repo-map', 'dep-context'];
  protected readonly events = ['session_start', 'before_agent_start', 'context', 'session_shutdown'];

  private state: SessionState | null = null;
  private monitor = new ContextMonitor();
  readonly pluginManager = new PluginManager();
  private orchestrator: InjectionOrchestrator | null = null;

  async onSessionStart(event: any, ctx: ExtensionContext): Promise<void> {
    const { projectRoot, getFlag } = event;
    const config = loadConfig(projectRoot, getFlag);
    
    if (!config.enabled) return;

    this.monitor.reset(ctx.sessionManager.getSessionId(), projectRoot);
    
    // Initialize orchestrator
    this.orchestrator = new InjectionOrchestrator(projectRoot, config);
    
    // Register built-in plugins
    this.pluginManager.register(new ContextPruningPlugin());
    this.pluginManager.register(new ReadAwarenessPlugin());
    this.pluginManager.register(new TelemetryReporterPlugin());

    // Run plugin hooks
    await this.pluginManager.runHook('onSessionStart', ctx);

    this.track('session_started', {
      projectRoot,
      configEnabled: true,
    });
  }

  async onBeforeAgentStart(event: any, ctx: ExtensionContext) {
    const result = await this.orchestrator?.injectContext(event, ctx);
    this.monitor.recordTurn();
    return result;
  }

  async onContext(event: any, ctx: ExtensionContext) {
    const messages = event.messages;
    this.monitor.recordMessage();

    // Run plugins
    await this.pluginManager.runHook('onContext', messages);

    // Build dep-context
    const depContext = await this.orchestrator?.buildDependencyContext(event, ctx);
    this.track('context_injected', {
      fileCount: extractFilePaths(depContext).length,
    });

    return depContext;
  }

  async onSessionShutdown(): Promise<void> {
    await this.pluginManager.runHook('onSessionShutdown');
    const stats = this.monitor.getStats();
    this.track('session_ended', stats);
  }
}
```

**Checklist:**
- [ ] SessionManager refactored
- [ ] Extends ExtensionLifecycle
- [ ] PluginManager owned
- [ ] Telemetry helpers used
- [ ] All existing tests still pass
- [ ] New tests for plugin integration (10+ tests)

---

### 2.8 Verify All Tests Pass

```bash
npm test
```

**Expected output:**
```
PASS  tests/shared/lifecycle.test.ts
PASS  tests/shared/plugin-manager.test.ts
PASS  tests/core/context-monitor.test.ts
PASS  tests/plugins/context-pruning.test.ts
PASS  tests/plugins/read-awareness.test.ts
PASS  tests/manager.test.ts
...
Test Files  12 passed (12)
Tests      85 passed (85)
```

**Checklist:**
- [ ] All 85+ tests passing
- [ ] No TypeScript errors
- [ ] No ESLint issues

---

## Phase 2 Summary

**Deliverables:**
- ✅ ExtensionLifecycle base class
- ✅ PluginManager + Plugin interface
- ✅ ContextMonitor (from context-intel)
- ✅ ContextPruningPlugin (8 rules)
- ✅ ReadAwarenessPlugin
- ✅ Telemetry helpers (consolidated)
- ✅ Refactored SessionManager (SRP + DIP + OCP)
- ✅ 85+ tests passing

**Next Step:** Begin Phase 3 Automation

---

## Phase 3: Automation & Intelligence

**Duration:** 6-8 hours  
**Owner:** 1-2 developers  
**Goal:** Implement smart triggers, auto-recap, auto-compact, auto-consolidate

### 3.1 AutomationManager (1.5 hours)

**File:** `src/automation/automation-manager.ts`

```typescript
/**
 * AutomationManager — triggers intelligent actions based on session state.
 */

export interface AutomationTrigger {
  id: string;
  check: (stats: SessionStats, ctx: any) => string | null;
  action?: (stats: SessionStats, ctx: any) => Promise<void>;
  cooldownMs: number;
  lastTriggered?: number;
}

export class AutomationManager {
  private triggers: Map<string, AutomationTrigger> = new Map();
  private triggerLog: Map<string, number> = new Map();

  register(trigger: AutomationTrigger): void {
    this.triggers.set(trigger.id, trigger);
  }

  async evaluate(stats: SessionStats, ctx: any): Promise<string[]> {
    const suggestions: string[] = [];

    for (const trigger of this.triggers.values()) {
      const lastTriggered = this.triggerLog.get(trigger.id) ?? 0;
      const elapsed = Date.now() - lastTriggered;

      if (elapsed < trigger.cooldownMs) continue;

      const suggestion = trigger.check(stats, ctx);
      if (suggestion) {
        suggestions.push(suggestion);
        this.triggerLog.set(trigger.id, Date.now());

        if (trigger.action) {
          try {
            await trigger.action(stats, ctx);
          } catch (err) {
            console.error(`Trigger ${trigger.id} action failed:`, err);
          }
        }
      }
    }

    return suggestions;
  }

  clear(): void {
    this.triggerLog.clear();
  }
}
```

**Tests:** `tests/automation/automation-manager.test.ts` (8+ tests)

---

### 3.2 Built-In Triggers (1.5 hours)

**File:** `src/automation/triggers.ts`

```typescript
export const BUILT_IN_TRIGGERS: AutomationTrigger[] = [
  {
    id: 'recap-hint',
    check: (stats) => 
      stats.messageCount > 20 && (Date.now() - stats.lastRecapAt) > 10 * 60 * 1000
        ? `✨ Consider \`/recap\` to summarize ${stats.messageCount} messages`
        : null,
    cooldownMs: 5 * 60 * 1000,
  },
  {
    id: 'context-warning',
    check: (stats) => {
      const ratio = stats.tokenUsage?.total / stats.tokenUsage?.contextWindow;
      if (ratio && ratio > 0.8) {
        return `⚠️ Context window ${Math.round(ratio * 100)}% full — consider \`/compact\``;
      }
      return null;
    },
    cooldownMs: 2 * 60 * 1000,
  },
  {
    id: 'file-tracking',
    check: (stats) =>
      stats.touchedFiles.length > 10
        ? `📝 ${stats.touchedFiles.length} files modified — consider \`/handoff\` prep`
        : null,
    cooldownMs: 10 * 60 * 1000,
  },
  {
    id: 'high-tool-activity',
    check: (stats) =>
      stats.toolCallCount > 50
        ? `🔧 High tool activity (${stats.toolCallCount} calls) — auto-recap might help`
        : null,
    cooldownMs: 5 * 60 * 1000,
  },
];
```

**Tests:** `tests/automation/triggers.test.ts` (10+ tests for each trigger)

---

### 3.3 AutoRecapper (1 hour)

**File:** `src/automation/auto-recapper.ts`

```typescript
/**
 * Auto-Recapper — generates session recaps automatically.
 */

import { TranscriptBuilder } from '../core/transcript-builder.js';
import { PromptBuilder } from '../core/prompt-builder.js';
import { getTelemetry } from 'pi-telemetry';

export class AutoRecapper {
  async recap(messages: AgentMessage[], trigger: string): Promise<string> {
    const transcript = TranscriptBuilder.buildTranscript(messages);
    const { user: recapPrompt } = PromptBuilder.buildRecap(transcript);

    getTelemetry()?.recordEvent({
      name: 'auto_recap_generated',
      data: { messageCount: messages.length, trigger },
    });

    return recapPrompt;
  }

  async buildHandoff(messages: AgentMessage[], goal: string): Promise<string> {
    const transcript = TranscriptBuilder.buildTranscript(messages);
    const { system, user } = PromptBuilder.buildHandoff(transcript, goal);

    getTelemetry()?.recordEvent({
      name: 'handoff_prepared',
      data: { messageCount: messages.length, goal },
    });

    return `${system}\n\n${user}`;
  }
}
```

**Tests:** `tests/automation/auto-recapper.test.ts` (5+ tests)

---

### 3.4 AutoCompactor (1 hour)

**File:** `src/automation/auto-compactor.ts`

```typescript
/**
 * Auto-Compactor — compresses long conversations.
 */

export class AutoCompactor {
  async compact(
    messages: AgentMessage[],
    pluginManager: PluginManager,
    maxMessages?: number,
  ): Promise<AgentMessage[]> {
    let working = [...messages];

    // Run all pruning plugins
    await pluginManager.runHook('onContext', working);

    // If still too long, use semantic compression
    if (maxMessages && working.length > maxMessages) {
      working = await this.semanticCompress(working, maxMessages);
    }

    getTelemetry()?.recordEvent({
      name: 'auto_compact_applied',
      data: {
        before: messages.length,
        after: working.length,
        removed: messages.length - working.length,
      },
    });

    return working;
  }

  private async semanticCompress(
    messages: AgentMessage[],
    target: number,
  ): Promise<AgentMessage[]> {
    // Group messages by turn
    // Summarize older groups
    // Keep recent N messages intact
    return messages; // Stub for v0.2.0
  }
}
```

**Tests:** `tests/automation/auto-compactor.test.ts` (5+ tests)

---

### 3.5 Integrate into SessionManager (1 hour)

Update `manager.ts` to:
1. Create AutomationManager instance
2. Create AutoRecapper, AutoCompactor instances
3. Wire automation into onTurnEnd hook

```typescript
export class SessionManager extends ExtensionLifecycle {
  private automation = new AutomationManager();
  private recapper = new AutoRecapper();
  private compactor = new AutoCompactor();

  constructor() {
    super();
    // Register built-in triggers
    for (const trigger of BUILT_IN_TRIGGERS) {
      this.automation.register(trigger);
    }
  }

  async onTurnEnd(ctx: ExtensionContext): Promise<void> {
    const stats = this.monitor.getStats();
    const suggestions = await this.automation.evaluate(stats, ctx);

    for (const suggestion of suggestions) {
      ctx.ui.notify(suggestion, 'info');
    }
  }

  async onAgentEnd(event: any, ctx: ExtensionContext): Promise<void> {
    // Evaluate automation
    // Suggest compact, recap, or consolidate
  }
}
```

**Checklist:**
- [ ] AutomationManager implemented
- [ ] 4+ built-in triggers
- [ ] AutoRecapper, AutoCompactor, AutoConsolidator
- [ ] Integrated into SessionManager
- [ ] 20+ tests passing

---

## Phase 3 Summary

**Deliverables:**
- ✅ AutomationManager with trigger system
- ✅ 4 built-in triggers (recap, context, files, activity)
- ✅ AutoRecapper (generate recaps on demand)
- ✅ AutoCompactor (prune redundant messages)
- ✅ AutoConsolidator (extract lessons)
- ✅ Integration into SessionManager
- ✅ 20+ tests

**Next Step:** Begin Phase 4 Testing

---

## Phase 4: Test Coverage

**Duration:** 8-10 hours  
**Owner:** 1-2 QA engineers  
**Goal:** Achieve 95%+ test coverage with snapshot testing

(See MERGE_PLAN.md for detailed test strategy)

**Create:**
- 30+ tests for ContextPruningPlugin
- 8+ tests for ReadAwarenessPlugin  
- 20+ tests for AutomationManager
- 10+ integration tests
- 5+ property-based tests

**Verification:**
```bash
npm test -- --coverage
# Expected: ✓ 95%+ coverage
```

---

## Phase 5: Telemetry Integration

**Duration:** 4-6 hours  
**Owner:** 1 developer  
**Goal:** Full pi-telemetry instrumentation

**File:** `src/metrics/metrics-collector.ts`

Record:
- Session metrics (files indexed, edges, duration)
- Injection metrics (tokens, files, frequency)
- Pruning metrics (rules applied, messages removed)
- Automation metrics (triggers fired, suggestions)
- Context usage (message count, token ratio, file count)

---

## Phase 6: Documentation

**Duration:** 4-6 hours  
**Owner:** 1 technical writer  
**Goal:** Comprehensive documentation

**Create/Update:**
- README.md (add sections on plugins, automation)
- docs/PLUGINS.md (plugin authoring guide)
- docs/AUTOMATION.md (triggers & actions)
- docs/TELEMETRY.md (what's tracked)
- docs/ARCHITECTURE.md (updated with new layers)
- TypeDoc API docs

---

## Phase 7: Release

**Duration:** 3-5 hours  
**Owner:** Release manager  
**Goal:** Published to npm & GitHub

**Steps:**
1. Bump version to 0.2.0
2. Write CHANGELOG.md
3. `npm run build`
4. `npm test` (all passing)
5. `npm run lint` (no errors)
6. Git tag: `git tag v0.2.0`
7. Git push: `git push origin main && git push origin v0.2.0`
8. Create GitHub release
9. `npm publish`
10. Deploy docs to GitHub Pages

---

## Execution Checklist

Phase 1: Analysis ✅ DONE
Phase 2: Refactoring
- [ ] ExtensionLifecycle
- [ ] PluginManager + Plugin
- [ ] ContextMonitor
- [ ] ContextPruningPlugin
- [ ] ReadAwarenessPlugin
- [ ] Telemetry helpers
- [ ] SessionManager refactor
- [ ] All tests passing

Phase 3: Automation
- [ ] AutomationManager
- [ ] Triggers
- [ ] AutoRecapper
- [ ] AutoCompactor
- [ ] AutoConsolidator
- [ ] Integration
- [ ] Tests passing

Phase 4: Testing
- [ ] 200+ tests
- [ ] 95%+ coverage
- [ ] Snapshot tests
- [ ] Integration tests
- [ ] Property-based tests

Phase 5: Telemetry
- [ ] MetricsCollector
- [ ] Traces
- [ ] Events
- [ ] Dashboards

Phase 6: Documentation
- [ ] README updated
- [ ] 6 guides created
- [ ] TypeDoc generated
- [ ] Reviewed

Phase 7: Release
- [ ] Version bumped
- [ ] CHANGELOG written
- [ ] All tests green
- [ ] GitHub release
- [ ] npm published
- [ ] Docs deployed

---

## Estimated Timeline

**Sequential Execution (1 developer):**
- Phases 1-2: 10-13 hours (Days 1-2)
- Phase 3: 6-8 hours (Day 2-3)
- Phases 4-5: 12-16 hours (Days 3-4) [parallel]
- Phases 6-7: 7-11 hours (Day 5) [parallel]
- **Total: 35-48 hours (~1 week)**

**Parallel Execution (2+ developers):**
- Phase 1: 2-3 hours (Day 1)
- Phases 2-3: 14-18 hours (Days 1-2, 2 devs)
- Phase 4: 8-10 hours (Days 2-3, 1-2 QA)
- Phase 5: 4-6 hours (Day 3, 1 dev, parallel with 4)
- Phase 6: 4-6 hours (Day 4, 1 writer, parallel with 5)
- Phase 7: 3-5 hours (Day 5, release manager)
- **Total: ~1 week calendar time with 2-3 people**

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Plugin system not compatible with pi API | Early spike on PluginManager integration (1 hour) |
| Tests break during refactoring | Test each component in isolation before integration |
| Telemetry circular dependency | Create isolated telemetry-helpers module |
| Context-intel incompatibilities | Add compatibility layer, test both paths |
| Large merge conflicts | Work on isolated branches, merge daily |

---

**Document Status:** ✅ Ready for Phase 2 Execution  
**Last Updated:** 2024-12-XX
