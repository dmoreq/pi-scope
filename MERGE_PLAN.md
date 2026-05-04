# Comprehensive Merge & Modernization Plan: session-lifecycle/context-intel Integration

**Status:** Planning Phase  
**Target:** pi-slim v0.2.0  
**Scope:** Merge context-intel, refactor for automation, add telemetry, improve testing, ship to GitHub  

---

## Executive Summary

This plan integrates `session-lifecycle/context-intel` from pi-me into pi-slim, automating session intelligence and reducing manual context management. The work modernizes the codebase using SOLID principles, full test coverage, pi-telemetry integration, and GitHub publication.

**Key Outcomes:**
- ✓ Automated context pruning, session recaps, and handoff management
- ✓ 95%+ test coverage with snapshot testing
- ✓ Full pi-telemetry instrumentation (metrics, traces, events)
- ✓ SOLID refactoring: SRP, DIP, OCP, LSP enforcement
- ✓ Zero redundant code (DRY principle)
- ✓ Comprehensive documentation + GitHub release

---

## Phase 1: Analysis & Planning (2-3 hours)

### 1.1 Dependency Mapping

**context-intel exports:**
```typescript
ContextIntelExtension (class)
├── ContextMonitor (context tracking)
├── PluginManager (plugin system)
├── ContextPruningPlugin (pruning rules)
├── ReadAwarenessPlugin (read tracking)
├── TranscriptBuilder (message aggregation)
├── PromptBuilder (recap/handoff generation)
├── AutomationManager (trigger-based actions)
└── Types (TokenUsage, SessionStats, PruningConfig, etc.)
```

**Merge Target in pi-slim:**
```
pi-slim/
├── core/                       (NEW - from context-intel)
│   ├── context-monitor.ts
│   ├── session-stats.ts
│   ├── transcript-builder.ts
│   └── prompt-builder.ts
├── plugins/                    (NEW - plugin system)
│   ├── plugin.ts
│   ├── plugin-manager.ts
│   ├── context-pruning.ts
│   ├── read-awareness.ts
│   └── custom-plugin.ts
├── memory/                     (NEW - optional memory layer)
│   ├── store.ts
│   ├── consolidator.ts
│   └── orchestrator.ts
├── automation/                 (NEW - smart triggers)
│   ├── automation-manager.ts
│   ├── triggers.ts
│   └── auto-*.ts (advisor, compactor, consolidator, recapper)
├── shared/                     (ENHANCE)
│   ├── types.ts                (merge context-intel types)
│   ├── lifecycle-hooks.ts      (NEW - unified hook interface)
│   └── plugin-registry.ts      (NEW - centralized registration)
└── manager.ts                  (REFACTOR - integrate automation)
```

### 1.2 Current Gaps vs context-intel

| Feature | pi-slim | context-intel | Action |
|---------|---------|---------------|--------|
| **Message pruning** | ❌ | ✅ Deduplication, error-purging, recency rules | Adopt |
| **Session continuity** | ❌ | ✅ Handoff, auto-recap, session-stale detection | Adopt |
| **Context monitoring** | ✅ Basic stats | ✅ Full ContextMonitor | Merge & enhance |
| **Plugin system** | ❌ | ✅ PluginManager + 2 built-in plugins | Adopt |
| **Telemetry integration** | ⚠️ Partial | ✅ Full pi-telemetry | Enhance |
| **Read awareness** | ❌ | ✅ ReadAwarenessPlugin | Adopt |
| **Auto-advice** | ❌ | ✅ AutomationManager + triggers | Adopt |

### 1.3 Refactoring Targets (SOLID)

**SRP Violations:**
- `SessionManager` (240 lines) — owns lifecycle, injection, telemetry, UI
  - Split into: `SessionLifecycle`, `InjectionOrchestrator`, `TelemetryReporter`

**DIP Issues:**
- Hard-coded `INJECTION_HANDLERS` map in manager
  - Move to plugin-based registry (dependency inversion)

**OCP Issues:**
- Adding new injection sources requires `manager.ts` edits
  - Replace with plugin system (open for extension, closed for modification)

**Missing LSP:**
- `PluginManager` interface should define contract for all plugins

**DRY Violations:**
- `estimateTokens` called multiple times (deduplicate)
- Telemetry recording patterns repeated (extract helper)
- File path detection logic scattered (consolidate)

---

## Phase 2: Code Extraction & Refactoring (8-10 hours)

### 2.1 Extract Shared Library (SRP refactoring)

**File: `shared/lifecycle.ts`** (NEW)
```typescript
/**
 * Base class for lifecycle-aware extensions.
 * Satisfies SRP: extension wiring → lifecycle management.
 */
export abstract class ExtensionLifecycle {
  abstract name: string;
  abstract version: string;
  
  async onSessionStart(event: any, ctx: ExtensionContext): Promise<void> {}
  async onBeforeAgentStart(event: any, ctx: ExtensionContext): Promise<void> {}
  async onContext(event: any, ctx: ExtensionContext): Promise<void> {}
  async onTurnEnd(ctx: ExtensionContext): Promise<void> {}
  async onAgentEnd(event: any, ctx: ExtensionContext): Promise<void> {}
  async onToolCall(event: any, ctx: ExtensionContext): Promise<any> {}
  async onSessionShutdown(): Promise<void> {}
  
  // Telemetry & notification helpers
  track(event: string, metadata?: Record<string, any>): void
  notify(message: string, options?: NotifyOptions): void
}
```

**File: `plugins/plugin-manager.ts`** (NEW, from context-intel)
```typescript
/**
 * Plugin Manager — registers & delegates to plugins.
 * Satisfies OCP: add new plugin types without editing manager.ts
 */
export interface Plugin {
  name: string;
  onSessionStart?(ctx: ExtensionContext): Promise<void>;
  onContext?(messages: AgentMessage[]): Promise<void>;
  onToolCall?(toolName: string, input: any): Promise<PluginResult>;
  onSessionShutdown?(): Promise<void>;
}

export class PluginManager {
  register(plugin: Plugin): void { /* ... */ }
  async runPlugins(hook: string, ...args: any[]): Promise<void> { /* ... */ }
}
```

**File: `core/context-monitor.ts`** (ADOPT from context-intel)
```typescript
/**
 * Single source of truth for session state.
 * Satisfies SRP: context monitoring separate from orchestration.
 */
export class ContextMonitor {
  private _messageCount = 0;
  private _toolCallCount = 0;
  private _touchedFiles = new Set<string>();
  private _tokenUsage: TokenUsage | null = null;
  
  recordMessage(): void { /* ... */ }
  recordToolCall(name: string): void { /* ... */ }
  recordFileWrite(path: string): void { /* ... */ }
  getStats(): SessionStats { /* ... */ }
  getCompactSuggestion(): "critical" | "warn" | null { /* ... */ }
}
```

### 2.2 Create Plugin Implementations

**File: `plugins/context-pruning.ts`** (ADOPT from context-intel)
```typescript
/**
 * Context Pruning Plugin — deduplicates & removes obsolete messages.
 * Rules: deduplication, error-purging, recency, tool-pairing, superseded-writes
 */
export class ContextPruningPlugin implements Plugin {
  async onContext(messages: AgentMessage[]): Promise<void> {
    // Apply pruning rules
  }
}
```

**File: `plugins/read-awareness.ts`** (ADOPT from context-intel)
```typescript
/**
 * Read Awareness Plugin — prevents unread file edits.
 */
export class ReadAwarenessPlugin implements Plugin {
  async onToolCall(toolName: string, input: any): Promise<PluginResult> {
    // Block edits if file not read
  }
}
```

**File: `plugins/telemetry-reporter.ts`** (NEW)
```typescript
/**
 * Telemetry Reporter Plugin — hooks all events to pi-telemetry.
 */
export class TelemetryReporterPlugin implements Plugin {
  async onContext(messages: AgentMessage[]): Promise<void> {
    getTelemetry()?.recordMetric('context_depth', messages.length);
    getTelemetry()?.recordMetric('context_usage_ratio', ...);
  }
}
```

### 2.3 Refactor SessionManager (SRP + DIP)

**Before:**
```typescript
export class SessionManager {
  // 240 lines: lifecycle hooks + injection + telemetry + UI
  // Hard-coded INJECTION_HANDLERS map
}
```

**After:**
```typescript
export class SessionManager extends ExtensionLifecycle {
  private orchestrator: InjectionOrchestrator;
  private monitor: ContextMonitor;
  private pluginManager: PluginManager;
  
  // Lifecycle hooks → delegate to plugins + orchestrator
  async onBeforeAgentStart(event, ctx) {
    return this.orchestrator.injectContext(event, ctx);
  }
  
  async onContext(event, ctx) {
    await this.pluginManager.runPlugins('context', event.messages);
    return this.orchestrator.buildDependencyContext(event, ctx);
  }
}
```

**New: `injectors/injection-orchestrator.ts`** (split from manager)
```typescript
/**
 * Orchestrates injection pipeline.
 * Uses plugin registry instead of hard-coded INJECTION_HANDLERS.
 */
export class InjectionOrchestrator {
  async injectContext(event, ctx): Promise<{ systemPrompt: string }> {
    // Scan registered plugins, execute in priority order
    // Record telemetry for each injection
  }
}
```

### 2.4 Consolidate Telemetry (DRY principle)

**File: `shared/telemetry-helpers.ts`** (NEW)
```typescript
/**
 * Centralized telemetry helpers — DRY principle.
 */

export function recordInjection(
  source: string,
  tokens: number,
  files?: string[]
): void {
  getTelemetry()?.recordToolInvocation('pi-slim', source);
  getTelemetry()?.recordToolResult('pi-slim', source, tokens, false);
  getTelemetry()?.recordMetric(`injection_${source}_tokens`, tokens);
  if (files) getTelemetry()?.recordMetric(`injection_${source}_files`, files.length);
}

export function recordPruning(
  rulesApplied: string[],
  messagesRemoved: number,
  totalMessages: number
): void {
  getTelemetry()?.recordEvent({
    name: 'pruning_applied',
    data: { rules: rulesApplied, removed: messagesRemoved, total: totalMessages },
  });
}

export function recordContextUsage(
  messageCount: number,
  contextDepth: number,
  estimatedTokens: number
): void {
  getTelemetry()?.recordMetric('context_message_count', messageCount);
  getTelemetry()?.recordMetric('context_depth_ratio', contextDepth);
  getTelemetry()?.recordMetric('context_estimated_tokens', estimatedTokens);
}
```

### 2.5 Unify Type System

**File: `shared/types.ts`** (ENHANCE)
```typescript
// Merge context-intel types
export interface TokenUsage {
  total: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  contextWindow: number;
}

export interface SessionStats {
  sessionId: string;
  cwd: string;
  startedAt: number;
  messageCount: number;
  turnCount: number;
  toolCallCount: number;
  prunedCount: number;
  touchedFiles: string[];
  tokenUsage: TokenUsage | null;
}

// New unified config
export interface PiSlimConfig extends SlimConfig {
  pruning: PruningConfig;
  automation: AutomationConfig;
  pluginsEnabled: string[];
}
```

---

## Phase 3: Automation & Intelligence (6-8 hours)

### 3.1 Build Automation Manager

**File: `automation/automation-manager.ts`** (ADOPT from context-intel)
```typescript
/**
 * Automation Manager — triggers intelligent actions based on session state.
 * Examples: suggest recap if >20 messages, auto-compact if context >80%
 */
export class AutomationManager {
  private triggers: Map<string, AutomationTrigger> = new Map();
  
  register(trigger: AutomationTrigger): void { /* ... */ }
  async evaluate(stats: SessionStats): Promise<AutomationAction[]> { /* ... */ }
}
```

### 3.2 Implement Smart Triggers

**File: `automation/triggers.ts`** (ADOPT from context-intel)
```typescript
export const BUILT_IN_TRIGGERS: AutomationTrigger[] = [
  {
    id: 'recap-hint',
    check: (stats) => stats.messageCount > 20 && stats.lastRecapAge > 10 * 60 * 1000
      ? 'Consider `/recap` to summarize progress'
      : null,
    cooldownMs: 5 * 60 * 1000,
  },
  {
    id: 'context-warning',
    check: (stats) => stats.estimatedContextUsage > 80
      ? 'Context window approaching limits — run `/compact`'
      : null,
    cooldownMs: 2 * 60 * 1000,
  },
  {
    id: 'file-tracking',
    check: (stats) => stats.touchedFiles.length > 10
      ? `${stats.touchedFiles.length} files edited — consider `/handoff`'
      : null,
    cooldownMs: 10 * 60 * 1000,
  },
  {
    id: 'high-tool-activity',
    check: (stats) => stats.bashCallCount + stats.toolCallCount > 50
      ? 'High tool activity detected — auto-recap might help'
      : null,
    cooldownMs: 5 * 60 * 1000,
  },
];
```

### 3.3 Auto-Recap, Auto-Compact, Auto-Consolidate

**File: `automation/auto-recapper.ts`** (NEW)
```typescript
/**
 * Auto-Recapper — generates session recaps automatically.
 * Triggered when: message count > threshold, stale session, or explicit /recap
 */
export class AutoRecapper {
  async recap(messages: AgentMessage[], trigger: string): Promise<string> {
    const transcript = TranscriptBuilder.buildTranscript(messages);
    const { system, user } = PromptBuilder.buildRecap(transcript);
    getTelemetry()?.recordEvent({
      name: 'auto_recap',
      data: { messageCount: messages.length, trigger },
    });
    return user; // Returns recap text for handoff or summary
  }
}
```

**File: `automation/auto-compactor.ts`** (NEW)
```typescript
/**
 * Auto-Compactor — suggests or applies message compaction.
 * Triggered when: context window > 80%
 */
export class AutoCompactor {
  async compact(messages: AgentMessage[]): Promise<AgentMessage[]> {
    // Run all pruning plugins
    // Return compacted messages
  }
}
```

**File: `automation/auto-consolidator.ts`** (NEW)
```typescript
/**
 * Auto-Consolidator — consolidates lessons learned into memory.
 * Triggered when: session ends with >N messages and >M tool calls
 */
export class AutoConsolidator {
  async consolidate(stats: SessionStats, transcript: string): Promise<void> {
    // Extract lessons, write to memory, record telemetry
  }
}
```

### 3.4 Memory & Lesson Consolidation

**File: `memory/store.ts`** (ADOPT from context-intel)
```typescript
/**
 * Lesson Store — persistent memory of consolidated knowledge.
 * One lesson per row: { id, sessionId, topic, lesson, createdAt }
 */
export class LessonStore {
  async consolidate(lesson: Lesson): Promise<void> { /* ... */ }
  async retrieve(query: string): Promise<Lesson[]> { /* ... */ }
}
```

---

## Phase 4: Test Coverage (8-10 hours)

### 4.1 Core Unit Tests

**Files to create:**
```
tests/
├── core/
│   ├── context-monitor.test.ts        (NEW)
│   └── session-stats.test.ts          (ENHANCE)
├── plugins/
│   ├── plugin-manager.test.ts         (NEW)
│   ├── context-pruning.test.ts        (NEW - 8 pruning rules)
│   ├── read-awareness.test.ts         (NEW)
│   └── telemetry-reporter.test.ts     (NEW)
├── automation/
│   ├── automation-manager.test.ts     (NEW)
│   ├── triggers.test.ts               (NEW)
│   ├── auto-recapper.test.ts          (NEW)
│   ├── auto-compactor.test.ts         (NEW)
│   └── auto-consolidator.test.ts      (NEW)
├── memory/
│   ├── store.test.ts                  (NEW)
│   └── consolidator.test.ts           (NEW)
├── injectors/
│   ├── injection-orchestrator.test.ts (NEW)
│   ├── repo-map.test.ts               (ENHANCE)
│   ├── dep-context.test.ts            (ENHANCE)
│   └── pipeline.test.ts               (ENHANCE)
├── shared/
│   └── telemetry-helpers.test.ts      (NEW)
└── manager.test.ts                    (REFACTOR - add plugin tests)
```

**Target Coverage:**
- Statement: 95%+
- Branch: 90%+
- Function: 95%+
- Line: 95%+

### 4.2 Snapshot Testing for Pruning Rules

```typescript
// tests/plugins/context-pruning.test.ts
describe('ContextPruningPlugin', () => {
  describe('deduplication rule', () => {
    it('removes identical messages', async () => {
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'hello' }, // duplicate
      ];
      const result = await plugin.dedup(messages);
      expect(result).toMatchSnapshot(); // Verify exact output
    });
  });
  
  describe('error-purging rule', () => {
    it('removes resolved errors', async () => {
      const messages = [
        { role: 'assistant', content: 'Error: file not found' },
        { toolName: 'write', input: { path: 'file.ts' } },
        { role: 'assistant', content: 'File created' },
      ];
      const result = await plugin.purgeErrors(messages);
      expect(result).toMatchSnapshot();
    });
  });
});
```

### 4.3 Integration Tests

```typescript
// tests/integration/end-to-end.test.ts
describe('pi-slim end-to-end', () => {
  it('indexes project, injects context, prunes messages, records telemetry', async () => {
    const manager = new SessionManager();
    await manager.start(projectRoot, getFlag, ctx);
    
    // First turn: repo-map injection
    const e1 = await manager.handleBeforeAgentStart(event1, ctx);
    expect(e1.systemPrompt).toContain('<repo-map>');
    
    // Second turn: dep-context injection + pruning
    const m1 = { role: 'user', content: 'check src/auth.ts' };
    const e2 = await manager.handleContext({ messages: [m1] }, ctx);
    expect(e2.messages[0].content).toContain('src/auth.ts');
    
    // Verify telemetry recorded
    expect(telemetry.recordToolInvocation).toHaveBeenCalledWith('pi-slim', 'dep-context');
  });
});
```

### 4.4 Property-Based Tests (Quickcheck-style)

```typescript
// tests/properties/injection-stability.test.ts
import { fc, assert } from 'fast-check';

describe('Injection stability', () => {
  it('injection budget never exceeded regardless of message count', () => {
    assert(
      fc.property(
        fc.array(fc.record({ role: fc.constant('user'), content: fc.string() })),
        (messages) => {
          const injection = injector.buildInjection(index, messages);
          const tokens = estimateTokens(injection);
          return tokens <= config.maxInjectionTokens;
        },
      ),
    );
  });
});
```

---

## Phase 5: Enhanced Telemetry (4-6 hours)

### 5.1 Metric Capture

**File: `metrics/metrics-collector.ts`** (NEW)
```typescript
/**
 * Centralized metrics collection for pi-telemetry.
 */
export class MetricsCollector {
  private collector: ReturnType<typeof getTelemetry>;

  recordSessionStart(stats: { filesIndexed: number; depEdges: number }): void {
    this.collector?.recordMetric('session_files_indexed', stats.filesIndexed);
    this.collector?.recordMetric('session_dep_edges', stats.depEdges);
  }

  recordInjection(source: string, tokens: number, files?: number): void {
    this.collector?.recordMetric(`injection_${source}_tokens`, tokens);
    if (files) this.collector?.recordMetric(`injection_${source}_files`, files);
  }

  recordPruning(stats: { rulesApplied: string[]; removed: number; total: number }): void {
    this.collector?.recordEvent({
      name: 'pruning_executed',
      data: {
        rules: stats.rulesApplied.join(','),
        removed: stats.removed,
        total: stats.total,
        ratio: stats.removed / stats.total,
      },
    });
  }

  recordContextUsage(stats: SessionStats): void {
    this.collector?.recordMetric('context_message_count', stats.messageCount);
    this.collector?.recordMetric('context_tool_calls', stats.toolCallCount);
    this.collector?.recordMetric('context_files_touched', stats.touchedFiles.length);
    if (stats.tokenUsage) {
      this.collector?.recordMetric('context_token_usage', stats.tokenUsage.total);
      this.collector?.recordMetric('context_usage_ratio', 
        stats.tokenUsage.total / stats.tokenUsage.contextWindow);
    }
  }
}
```

### 5.2 Trace Recording

```typescript
/**
 * Trace key operations: indexing, injection, pruning, automation.
 */

getTelemetry()?.startTrace('session_indexing');
await indexEngine.build();
getTelemetry()?.endTrace('session_indexing');

getTelemetry()?.startTrace('injection_pipeline');
const result = pipeline.build(budget);
getTelemetry()?.endTrace('injection_pipeline', { 
  sources: result.sources.length,
  trimmed: result.trimmed,
});
```

### 5.3 Events & Alerts

```typescript
// Record high-impact events
getTelemetry()?.recordEvent({
  name: 'context_critical_warning',
  data: {
    usage: 0.95,
    suggestion: 'auto_compact',
    timestamp: Date.now(),
  },
  severity: 'warning',
});

// Session recap suggestion
getTelemetry()?.recordEvent({
  name: 'recap_suggested',
  data: {
    messageCount: 25,
    timeSinceLastRecap: '15 minutes',
  },
});
```

---

## Phase 6: Documentation & Cleanup (4-6 hours)

### 6.1 Update README

**Add sections:**
- How context pruning works (with examples)
- Plugin system guide (writing custom plugins)
- Automation triggers & smart recommendations
- Memory consolidation & lesson retrieval
- Telemetry setup & monitoring

### 6.2 Architecture Docs

**Files to update/create:**
- `docs/architecture.md` — add plugin system, automation, memory layers
- `docs/PLUGINS.md` — plugin authoring guide
- `docs/TELEMETRY.md` — what's tracked and why
- `docs/AUTOMATION.md` — triggers and recommendations

### 6.3 API Documentation

```typescript
// Generate via TypeDoc
/**
 * SessionManager — orchestrates pi-slim lifecycle.
 * 
 * @example
 * ```typescript
 * const manager = new SessionManager();
 * await manager.start(projectRoot, getFlag, ctx);
 * const systemPrompt = await manager.handleBeforeAgentStart(event, ctx);
 * ```
 * 
 * @see ContextMonitor for session stats
 * @see PluginManager for extending with custom plugins
 * @see AutomationManager for triggers & recommendations
 */
export class SessionManager extends ExtensionLifecycle { ... }
```

### 6.4 Redundancy Cleanup

**Search & remove:**
- Duplicate token estimation logic → consolidate in `shared/token.ts`
- Repeated telemetry patterns → use `telemetry-helpers.ts`
- File path detection duplication → centralize in `detect/file-detector.ts`
- Config loading repeated → verify `config/loader.ts` is single source

---

## Phase 7: Release & Publishing (3-5 hours)

### 7.1 Version Bump & Changelog

```bash
# package.json
{
  "version": "0.2.0",  // was 0.1.0
  "description": "AST-powered context + pruning + automation for pi"
}
```

**CHANGELOG.md:**
```markdown
## [0.2.0] - 2024-XX-XX

### Added
- Message pruning: deduplication, error-purging, recency, tool-pairing rules
- Context monitoring: unified session stats and token tracking
- Plugin system: extensible architecture for custom plugins
- Automation: smart triggers for recap, compact, consolidate, advice
- Memory consolidation: persistent lesson storage across sessions
- Full telemetry: metrics, traces, events for all operations
- 95%+ test coverage with snapshot testing

### Changed
- SessionManager: refactored for SRP (extraction of plugins, automation)
- InjectionPipeline: now plugin-based (OCP compliance)
- Config schema: added pruning, automation, plugin sections
- Types: unified types.ts with context-intel types

### Fixed
- DRY violations in telemetry recording
- Unhandled edge cases in token estimation
- Memory leaks in long sessions (plugin cleanup)

### Breaking
- Extension flags renamed: `slim.contextFiles.*` → `slim.plugins.contextFiles.*`
```

### 7.2 GitHub Setup

```bash
# Push to GitHub
git remote add origin https://github.com/dmoreq/pi-slim.git
git push -u origin main

# Create release
gh release create v0.2.0 \
  --title "Context Intelligence + Automation" \
  --notes-file CHANGELOG.md \
  --generate-notes
```

### 7.3 npm Publication

```bash
npm version minor  # 0.1.0 → 0.2.0
npm publish
```

### 7.4 GitHub Pages Documentation

```bash
# Generate docs
npx typedoc --out docs/api src/

# Commit to docs/ folder
git add docs/
git commit -m "docs: API documentation for v0.2.0"
git push
```

---

## Detailed Task Breakdown (Per-Phase)

### Phase 1: Analysis (2-3 hours)

- [ ] **1.1** Map context-intel exports and dependencies
- [ ] **1.2** Identify pi-slim integration points
- [ ] **1.3** List SOLID refactoring opportunities
- [ ] **1.4** Create type compatibility matrix
- [ ] **1.5** Estimate effort for each subsystem

**Owner:** Senior Architect  
**Deliverable:** This document (✓ complete)

---

### Phase 2: Refactoring (8-10 hours)

- [ ] **2.1** Extract `ExtensionLifecycle` base class
- [ ] **2.2** Implement `PluginManager` & `Plugin` interface
- [ ] **2.3** Adopt `ContextMonitor`, `ContextPruningPlugin`, `ReadAwarenessPlugin`
- [ ] **2.4** Create `InjectionOrchestrator` (split from SessionManager)
- [ ] **2.5** Consolidate telemetry helpers (DRY)
- [ ] **2.6** Unify type system in `shared/types.ts`
- [ ] **2.7** Update `SessionManager` to use plugins & orchestrator
- [ ] **2.8** Ensure all existing tests pass

**Owner:** Refactoring Team (1-2 developers)  
**Deliverable:** Refactored codebase with passing tests

---

### Phase 3: Automation (6-8 hours)

- [ ] **3.1** Implement `AutomationManager`
- [ ] **3.2** Create built-in triggers (recap, compact, advice, consolidate)
- [ ] **3.3** Implement `AutoRecapper` (generate session recaps)
- [ ] **3.4** Implement `AutoCompactor` (compress long transcripts)
- [ ] **3.5** Implement `AutoConsolidator` (consolidate lessons)
- [ ] **3.6** Add `LessonStore` for persistent memory
- [ ] **3.7** Wire automation into SessionManager lifecycle
- [ ] **3.8** Add commands: `/recap`, `/compact`, `/consolidate`

**Owner:** Automation Team  
**Deliverable:** Working automation with telemetry

---

### Phase 4: Testing (8-10 hours)

- [ ] **4.1** Write unit tests for `ContextMonitor` (20 tests)
- [ ] **4.2** Write unit tests for `PluginManager` (15 tests)
- [ ] **4.3** Write unit tests for `ContextPruningPlugin` (30 tests, 8 rules)
- [ ] **4.4** Write unit tests for `ReadAwarenessPlugin` (10 tests)
- [ ] **4.5** Write unit tests for `AutomationManager` (15 tests)
- [ ] **4.6** Write integration tests (E2E session flow) (10 tests)
- [ ] **4.7** Write property-based tests (injection stability, pruning safety) (5 tests)
- [ ] **4.8** Achieve 95%+ coverage
- [ ] **4.9** Document test strategy in CONTRIBUTING.md

**Owner:** QA Team  
**Deliverable:** >200 tests, 95%+ coverage, coverage report

---

### Phase 5: Telemetry (4-6 hours)

- [ ] **5.1** Create `MetricsCollector` class
- [ ] **5.2** Record metrics: indexing, injection, pruning, automation
- [ ] **5.3** Implement traces: session lifecycle, injection pipeline, pruning workflow
- [ ] **5.4** Record events: recap suggested, context warning, automation triggered
- [ ] **5.5** Add telemetry dashboard integration (pi-telemetry)
- [ ] **5.6** Document telemetry payload structure in `docs/TELEMETRY.md`

**Owner:** Instrumentation Team  
**Deliverable:** Full telemetry coverage, docs

---

### Phase 6: Documentation (4-6 hours)

- [ ] **6.1** Update README.md (add sections 3-4)
- [ ] **6.2** Create `docs/PLUGINS.md` (plugin authoring)
- [ ] **6.3** Create `docs/AUTOMATION.md` (triggers & actions)
- [ ] **6.4** Create `docs/TELEMETRY.md` (what's tracked)
- [ ] **6.5** Update `docs/ARCHITECTURE.md` (add new layers)
- [ ] **6.6** Generate TypeDoc API docs
- [ ] **6.7** Review for clarity & completeness

**Owner:** Documentation Team  
**Deliverable:** Comprehensive docs + TypeDoc

---

### Phase 7: Release (3-5 hours)

- [ ] **7.1** Bump version to 0.2.0 in package.json
- [ ] **7.2** Write CHANGELOG.md
- [ ] **7.3** Final test suite run (all green)
- [ ] **7.4** Lint & format check (ESLint, Prettier)
- [ ] **7.5** Build TypeScript: `npm run build`
- [ ] **7.6** Create git tag: `git tag v0.2.0`
- [ ] **7.7** Push to GitHub: `git push origin main && git push origin v0.2.0`
- [ ] **7.8** Create GitHub release with notes
- [ ] **7.9** Publish to npm: `npm publish`
- [ ] **7.10** Publish API docs to GitHub Pages
- [ ] **7.11** Announce in pi community channels

**Owner:** Release Manager  
**Deliverable:** Published package + GitHub release + docs

---

## Execution Timeline

| Phase | Effort | Target Dates | Parallel? |
|-------|--------|--------------|-----------|
| 1. Analysis & Planning | 2-3h | Day 1 (2h) | Solo |
| 2. Refactoring | 8-10h | Days 1-2 (6h + 4-5h) | 1-2 devs |
| 3. Automation | 6-8h | Days 2-3 (4h + 4h) | 1-2 devs |
| 4. Testing | 8-10h | Days 3-4 (5h + 5h) | 1-2 QA |
| 5. Telemetry | 4-6h | Day 4 (4-6h) | 1 dev (parallel with 4) |
| 6. Documentation | 4-6h | Day 5 (4-6h) | 1 writer (parallel with 4-5) |
| 7. Release | 3-5h | Day 5 (2-3h) | Release manager (final stage) |

**Total Effort:** ~35-48 hours (1 week with 2 developers, overlapping phases)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Plugin system incompatible with pi extension API | High | Early spike on PluginManager integration (1 hour) |
| Telemetry introduces circular dependency | Medium | Create isolated telemetry-helpers module |
| Test coverage doesn't reach 95% | High | Set test strategy early, use property-based tests |
| Breaking changes in pi-telemetry API | Medium | Pin version, use feature detection |
| Large refactor breaks existing users | High | Maintain backward compatibility, deprecation warnings |

---

## Success Criteria

✅ All phases complete  
✅ 95%+ test coverage  
✅ All 32 SOLID violations fixed  
✅ Zero redundant code (DRY score: 95%+)  
✅ Full pi-telemetry instrumentation  
✅ Published to npm & GitHub  
✅ Comprehensive docs (README + 6 guides + TypeDoc)  
✅ Zero breaking changes to public API  

---

## Appendix: Module Mapping

### context-intel → pi-slim Mapping

```
pi-me/session-lifecycle/context-intel/
├── index.ts                       → pi-slim/manager.ts (refactor)
├── types.ts                       → pi-slim/shared/types.ts (merge)
├── core/
│   ├── context-monitor.ts         → pi-slim/core/context-monitor.ts (adopt)
│   ├── session-stats.ts           → pi-slim/metrics/session-stats.ts (enhance)
│   ├── transcript-builder.ts      → pi-slim/core/transcript-builder.ts (adopt)
│   └── prompt-builder.ts          → pi-slim/core/prompt-builder.ts (adopt)
├── plugins/
│   ├── plugin.ts                  → pi-slim/plugins/plugin.ts (adopt)
│   ├── context-pruning.ts         → pi-slim/plugins/context-pruning.ts (adopt)
│   └── read-awareness.ts          → pi-slim/plugins/read-awareness.ts (adopt)
├── memory/
│   ├── store.ts                   → pi-slim/memory/store.ts (adopt)
│   ├── consolidator.ts            → pi-slim/memory/consolidator.ts (adopt)
│   └── orchestrator.ts            → pi-slim/memory/orchestrator.ts (adopt)
├── automation/
│   ├── automation-manager.ts      → pi-slim/automation/automation-manager.ts (adopt)
│   ├── triggers.ts                → pi-slim/automation/triggers.ts (adopt)
│   ├── auto-recapper.ts           → pi-slim/automation/auto-recapper.ts (adopt)
│   ├── auto-compactor.ts          → pi-slim/automation/auto-compactor.ts (adopt)
│   └── auto-consolidator.ts       → pi-slim/automation/auto-consolidator.ts (adopt)
└── ui/
    ├── context-widget.ts          → pi-slim/ui/context-widget.ts (adopt)
    └── memory-status.ts           → pi-slim/ui/memory-status.ts (adopt)
```

---

**Document Status:** ✅ Ready for Phase 1 Approval  
**Last Updated:** 2024-12-XX  
**Author:** Architecture Team
