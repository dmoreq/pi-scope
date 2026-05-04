# Architecture

## Data Flow

```
session_start
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  IndexEngine                                          │
│  ├── walkDir() → file list (respects .gitignore)     │
│  ├── LanguageParser.parseFile() → FileIndex           │
│  │   └── tree-sitter AST → {skeleton, imports, hash}  │
│  ├── DiskCache (SHA-256 cache, avoids re-parsing)     │
│  ├── buildGraph() → RepoIndex {skeletons, deps}       │
│  └── saveStore() → .pi/slim/index.json.gz (gzip)      │
│                                                       │
│  RepoMapGenerator → .pi/slim/repo-map.txt             │
└──────────────────────────────────────────────────────┘
    │
    ▼
SessionManager extends ExtensionLifecycle
    │
    ├── PluginManager (OCP-compliant plugin system)
    │   ├── ContextPruningPlugin (dedup, supersede, error-purge)
    │   └── ReadAwarenessPlugin (prevent unread edits)
    │
    ├── ContextMonitor (session state tracking)
    │   └── recordMessage, recordToolCall, recordFileWrite
    │
    ├── AutomationManager (trigger-based suggestions)
    │   ├── recap-hint (20+ msgs, 10min idle)
    │   ├── context-warning (80%+ window usage)
    │   ├── file-tracking (10+ files modified)
    │   └── high-activity (50+ tool calls)
    │
    └── MetricsCollector (pi-telemetry integration)
        └── session, injection, pruning, automation metrics
    │
    ▼
before_agent_start (first turn)
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  InjectionPipeline                                    │
│  ├── priority 1: <repo-map>                           │
│  ├── priority 2: <provider-guidance>                  │
│  ├── priority 4: <context-files>                      │
│  └── trim to maxRepoMapTokens + maxInjectionTokens    │
└──────────────────────────────────────────────────────┘
    │
    ▼
context event (every turn)
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  PluginManager.runHook('onContext')                       │
│  └── ContextPruningPlugin.onContext()                      │
│      ├── deduplicate identical messages                   │
│      ├── supersede old file writes                        │
│      └── purge resolved errors                            │
│                                                           │
│  ContextInjector                                           │
│  ├── file-detector (messages + tool calls + output)       │
│  ├── detectInFocusFiles() → set of mentioned paths        │
│  ├── buildInjection() → <dep-context> block               │
│  └── trim to maxInjectionTokens                           │
└──────────────────────────────────────────────────────────┘
    │
    ▼
AutomationManager (post-turn)
    ├── evaluate triggers against ContextMonitor stats
    └── return suggestions for user notification
```

## Component Dependencies

```
extension.ts
    └── SessionManager (extends ExtensionLifecycle)
            ├── ExtensionLifecycle (shared/lifecycle.ts)
            │   └── Telemetry helpers (recordToolInvocation, heartbeat, etc.)
            ├── PluginManager (shared/plugin-manager.ts)
            │   ├── Plugin interface (shared/plugin.ts)
            │   ├── ContextPruningPlugin (plugins/context-pruning.ts)
            │   │   └── Pruning Rules (plugins/pruning-rules.ts)
            │   └── ReadAwarenessPlugin (plugins/read-awareness.ts)
            ├── ContextMonitor (core/context-monitor.ts)
            ├── AutomationManager (automation/automation-manager.ts)
            │   └── Built-in Triggers (automation/triggers.ts)
            ├── AutoRecapper (automation/auto-recapper.ts)
            ├── AutoCompactor (automation/auto-compactor.ts)
            ├── MetricsCollector (metrics/metrics-collector.ts)
            ├── IndexEngine
            │       ├── DiskCache
            │       └── LanguageParser (x3: TS, Python, Rust)
            ├── RepoMapGenerator
            ├── ContextInjector
            │       ├── file-detector (detect/)
            │       └── shared/message.ts, shared/token.ts
            ├── InjectionPipeline
            │       └── shared/token.ts
            ├── context-files (injectors/)
            ├── guidance (injectors/)
            ├── SessionStats
            │       ├── metrics/cost-estimator.ts
            │       └── persistence/runtime-state.ts
            └── config/loader.ts
                    └── config/schema.ts (zod)
```

## Lifecycle Hook Map

| pi event | Handler | What happens |
|----------|---------|-------------|
| `session_start` | `SessionManager.start()` | Load or build index, init plugins, start monitoring |
| `before_agent_start` | `SessionManager.handleBeforeAgentStart()` | Build pipeline, inject repo-map + guidance + context-files |
| `context` | `SessionManager.handleContext()` | Run plugins (pruning), scan messages, build dep-context, record stats |
| `turn_end` | `AutomationManager.evaluate()` (via plugin hook) | Evaluate triggers, suggest recap/compact/handoff |
| `tool_call` | `PluginManager.runToolCall()` | Intercept tool calls (read-awareness check) |
| `session_shutdown` | `SessionManager.shutdown()` | Plugin cleanup, show summary, persist stats |

## Injection Priority

| Source | Priority | Frequency | Trimmed first? |
|--------|----------|-----------|----------------|
| `<repo-map>` | 1 | Once | No (highest) |
| `<provider-guidance>` | 2 | Once | Only if severely over budget |
| `<context-files>` | 4 | Once | Yes (lowest) |
| `<dep-context>` | (separate flow) | Per turn | Handled by ContextInjector budget |

## Plugin Hook Execution Order

```
onSessionStart → onBeforeAgentStart → onContext → onTurnEnd → onAgentEnd → onSessionShutdown
                                                        ↓
                                                  onToolCall (interleaved)
```

Errors in one plugin do NOT prevent other plugins from running. Tool call interception short-circuits on rejection.

## Pruning Rule Pipeline

```
Incoming messages (array)
    │
    ▼
1. Deduplication
    └── Remove identical consecutive user/assistant messages
    │
    ▼
2. Superseded Writes
    └── Remove old file writes superseded by newer writes to same file
    │
    ▼
3. Error Purging
    └── Remove error results followed by success
    │
    ▼
Pruned messages (array)
```

## Automation Trigger Evaluation

```
Post-turn
    │
    ▼
For each registered trigger:
    ├── Check cooldown (min time between firings)
    ├── Evaluate condition against current stats
    └── If triggered: return suggestion + execute optional action
    │
    ▼
Aggregate suggestions → notify user
```

## Storage Layout

```
.pi/slim/
├── index.json.gz     # Gzip-compressed RepoIndex (skeletons + dep graph)
├── repo-map.txt      # Generated repo-map string
├── state.json        # Latest session state (for cross-session /slim)
├── stats.jsonl       # Historical session records (one JSON line per session)
└── slim.jsonc        # Project-local config (optional)
```

## Key Design Decisions

- **One-directional dep graph:** Answers "what does X import?" only. For reverse lookups ("what imports X?"), use `search` / `ripgrep`.
- **SHA-256 content hashing:** Avoids re-parsing unchanged files across sessions.
- **Gzip compression:** Reduces `.pi/slim/` disk usage by ~84% vs raw JSON.
- **Atomic writes:** Cache + store use tmp + rename to prevent corruption on crash.
- **Plugin system (OCP):** Adding a new feature = register a plugin. No core edits needed.
- **SRP compliance:** ExtensionLifecycle (base), SessionManager (orchestration), ContextMonitor (state tracking), plugins (specific behaviors).
- **Telemetry consolidation:** DRY helper functions replace 50+ lines of inline telemetry calls.
