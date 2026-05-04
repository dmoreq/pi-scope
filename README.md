# pi-slim

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/pi-slim)](https://www.npmjs.com/package/pi-slim)

**AST-powered project context for [pi](https://github.com/mariozechner/pi-coding-agent).** Reduces token waste by injecting compact code skeletons (not full files) into every LLM call, with automatic import resolution, dependency awareness, message pruning, and smart automation.

- **~85-92% token reduction** per referenced file vs. full-file reads
- **Zero-config** — auto-indexes on first session
- **Dependency-aware** — mentions `foo.ts` and gets its imports too
- **Multi-language** — TypeScript, Python, Rust (extensible)
- **Automatic pruning** — removes duplicate/obsolete messages before LLM context
- **Smart triggers** — suggests `/recap`, `/compact`, and handoff prep automatically
- **Plugin system** — extend with custom plugins without editing core
- **Full telemetry** — session tracking, injection monitoring, cost attribution

---

## Table of Contents

- [Installation](#installation)
- [How It Works](#how-it-works)
- [Injection Layers](#injection-layers)
- [Context Pruning](#context-pruning)
- [Automation Triggers](#automation-triggers)
- [Plugin System](#plugin-system)
- [Configuration](#configuration)
- [Commands](#commands)
- [Supported Languages](#supported-languages)
- [Performance](#performance)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
pi install git:github.com/dmoreq/pi-slim
```

Restart pi. First session in each project indexes your source files (~1-2s for 1,000 files). Subsequent sessions load from cache instantly.

---

## How It Works

### Session start: AST indexing

1. **Walk** — scans all `.ts`, `.tsx`, `.py`, `.rs` files (respects `.gitignore` and configurable `exclude` patterns)
2. **Parse** — each file is parsed via [tree-sitter](https://tree-sitter.github.io/)
3. **Extract** — only signatures are kept (function headers, class shapes, type definitions) — no bodies, no comments
4. **Graph** — import statements are resolved into a one-directional dependency graph
5. **Cache** — gzip-compressed index saved to `.pi/slim/` for instant reload

### Every LLM call: context injection

The pipeline injects up to four layers per turn, ordered by priority and trimmed to a shared token budget:

| Layer | Frequency | What it provides |
|-------|-----------|-----------------|
| `<repo-map>` | Once (first turn) | Directory tree with exported names per file |
| `<dep-context>` | Every turn | Skeleton signatures for mentioned files + 1st-degree imports |
| `<context-files>` | Once | AGENTS.local.md, CLAUDE.local.md (if present) |
| `<provider-guidance>` | Once | Provider-specific CLAUDE.md / CODEX.md / GEMINI.md |

### Per-turn: message pruning

Before building dependency context, pi-slim automatically prunes redundant messages:

| Rule | What it removes |
|------|----------------|
| **Deduplication** | Identical consecutive user/assistant messages |
| **Superseded Writes** | Old file writes superseded by newer writes to the same file |
| **Error Purging** | Error tool results followed by successful results |

---

## Context Pruning

pi-slim automatically prunes the message array before each LLM call, removing redundant or obsolete content to maximize token efficiency.

### How it works

1. **OnContext hook** fires before every LLM context construction
2. **Pruning rules** run in order: deduplication → superseded writes → error purging
3. **Messages modified in-place** — the context array is trimmed before the LLM sees it
4. **Stats tracked** — total pruned/pruned percentage shown in session summary

### Pruning Rules

**Deduplication:** Removes identical consecutive user or assistant messages. Tool messages (tool_call, tool_result) are preserved even with identical content, as they carry structured data that shouldn't be deduplicated.

**Superseded Writes:** When a file is written multiple times, only the latest write is kept. Older writes to the same file path are removed, as they've been superseded by newer content.

**Error Purging:** When a tool returns an error (`"isError": true` or `"status": "error"`) and a subsequent tool result for the same operation succeeds, the error message is removed. Unresolved errors are preserved.

### Disable Pruning

```bash
# Via CLI flag
pi --slim.plugins.pruning=false

# Via config file .pi/slim.jsonc
{ "plugins": ["read-awareness"] }
```

---

## Automation Triggers

pi-slim includes four built-in automation triggers that monitor session activity and suggest helpful actions.

| Trigger | Condition | Suggestion | Cooldown |
|---------|-----------|------------|----------|
| **recap-hint** | >20 messages AND last recap >10 min ago | Suggest `/recap` | 5 min |
| **context-warning** | Context window >80% full | Suggest `/compact` | 2 min |
| **file-tracking** | >10 files modified | Suggest handoff prep | 10 min |
| **high-activity** | >50 tool calls | Suggest auto-recap | 5 min |

Suggestions are delivered as styled notifications in the session TUI. The automation system respects cooldowns to avoid spamming the user.

### Disable Automation

```bash
# Disable all automation
pi --slim.automation.enabled=false

# Via config
{ "automation": { "enabled": false } }
```

---

## Plugin System

pi-slim now includes an extensible plugin system (OCP-compliant). Built-in plugins are registered automatically.

### Built-in Plugins

| Plugin | Purpose |
|--------|---------|
| **ContextPruningPlugin** | Removes duplicate/obsolete messages before LLM context |
| **ReadAwarenessPlugin** | Prevents edits to files that haven't been read first |

### Writing a Custom Plugin

```typescript
import type { Plugin, PluginToolCallResult } from 'pi-slim';
import type { ExtensionContext } from '@mariozechner/pi-coding-agent';

class MyAnalyticsPlugin implements Plugin {
  readonly name = 'my-analytics';

  async onSessionStart(ctx: ExtensionContext): Promise<void> {
    console.log('Session started');
  }

  async onTurnEnd(ctx: ExtensionContext): Promise<void> {
    console.log('Turn completed');
  }

  async onToolCall(event, ctx): Promise<PluginToolCallResult | undefined> {
    // Intercept tool calls
    return { allowed: true };
  }
}

// Register with SessionManager
manager.pluginManager.register(new MyAnalyticsPlugin());
```

### Available Plugin Hooks

| Hook | When it fires | Purpose |
|------|--------------|---------|
| `onSessionStart` | New session | Initialize state |
| `onBeforeAgentStart` | Before LLM call | Modify system prompt |
| `onContext` | Context construction | Prune/augment messages |
| `onTurnEnd` | After each turn | Post-turn automation |
| `onAgentEnd` | After agent output | Post-agent processing |
| `onToolCall` | Every tool invocation | Intercept/block tools |
| `onSessionShutdown` | Session end | Persist state, cleanup |

---

## Injection Layers

### `<repo-map>`

Compact project overview — injected once into the system prompt:

```xml
<repo-map>
  (root)
    index.ts  createApp, defineRoutes
    src/
      auth.ts  authenticate, authorize
    config/
      db.ts  DatabaseConfig
</repo-map>
```

Use this to answer "where does X live?" without reading any files.

### `<dep-context>`

When you mention a file (e.g., `src/auth.ts`), pi-slim injects its skeleton plus the skeletons of everything it directly imports:

```xml
<dep-context>
## Active files
### src/auth.ts
export function authenticate(token: string): User { ... }
export function authorize(role: Role): boolean { ... }

## Direct dependencies
### src/auth/models.ts
export interface User { ... }
export enum Role { ... }
</dep-context>
```

Skeletons are **function/class signatures only** — ~8-15% of full file size.

### `<context-files>` / `<provider-guidance>`

Loads project-local markdown files from ancestor directories (`.pi/`, project root, home):
- **Context files:** AGENTS.local.md, CLAUDE.local.md
- **Guidance:** CLAUDE.md (Anthropic), CODEX.md (OpenAI), GEMINI.md (Google)

---

## Configuration

### CLI flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `slim.enabled` | boolean | `true` | Master switch |
| `slim.maxRepoMapTokens` | number | `4000` | Token budget for repo map |
| `slim.maxInjectionTokens` | number | `8000` | Token budget for per-turn dep-context |
| `slim.scanLastNMessages` | number | `10` | Messages to scan for file mentions |
| `slim.contextFiles.enabled` | boolean | `true` | Load AGENTS.local.md etc. |
| `slim.contextFiles.filenames` | string | `AGENTS.local.md,CLAUDE.local.md` | Comma-separated filenames |
| `slim.providerGuidance.enabled` | boolean | `true` | Load CLAUDE.md/CODEX.md/GEMINI.md |

### Config file (`.pi/slim.jsonc`)

Project-local config overrides CLI flags:

```jsonc
{
  // Reduce repo map for large projects
  "maxRepoMapTokens": 2000,
  // Skip generated and vendor files
  "exclude": ["**/node_modules/**", "**/vendor/**", "**/*.generated.*"],
  // Disable context files if not needed
  "contextFiles": { "enabled": false }
}
```

Global config at `~/.pi/agent/slim.jsonc` applies to all projects; project config overrides global.

### Config priority

1. **CLI flags** (highest)
2. **Project config** (`.pi/slim.jsonc`)
3. **Global config** (`~/.pi/agent/slim.jsonc`)
4. **Hardcoded defaults**

---

## Commands

| Command | Description |
|---------|-------------|
| `/slim` | Show injection stats for the current or last session |

Example output:

```
── slim session stats ──────────────────
  Index source     : fresh
  Files indexed    : 1,234
  Dep edges        : 567
  Repo map         : ~3,500t (once)
  Dep-context      : 12x, ~2,400t total
  Token savings    : ~18,000t (88% vs full reads)
  Unique files seen: 45
  Messages pruned  : 23 (12% of total)
─────────────────────────────────────────
```

---

## Supported Languages

| Language | Extensions | Skeletons | Import Resolution |
|----------|-----------|-----------|-------------------|
| TypeScript | `.ts`, `.tsx` | Classes, functions, interfaces, types, enums | Relative `./foo`, `../bar` |
| Python | `.py` | Classes, function signatures (indented) | Relative `from .module` |
| Rust | `.rs` | `fn`, `struct`, `enum`, `trait`, `impl` | `mod x;`, `use crate::`, `use super::` |

To add a language: implement the `LanguageParser` interface — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Performance

- **First index:** ~1-2 seconds for 1,000 files, ~5-10s for 10,000 files
- **Cache load:** < 50ms from `.pi/slim/index.json.gz`
- **Disk size:** Gzip-compressed index is ~84% smaller than raw JSON
- **Token savings:** Skeletons are 8-15% of full file size — 85-92% saved per referenced file
- **Pruning overhead:** < 5ms per turn for message pruning

### Tuning

For large projects, increase exclusion patterns or reduce token budgets in `.pi/slim.jsonc`:

```jsonc
{
  "exclude": ["**/node_modules/**", "**/*.test.ts", "**/examples/**"],
  "maxRepoMapTokens": 2000,
  "maxInjectionTokens": 6000
}
```

If you see `trimmed` warnings in the log, increase the budget.

---

## Development

```bash
npm install              # install dependencies
npm test                 # run tests (vitest)
npm run build            # compile TypeScript
npm run test:watch       # watch mode
```

### Project structure

```
pi-slim/
├── extension.ts              # Extension entry point (lifecycle wiring)
├── manager.ts                # Session lifecycle and orchestration
├── shared/                   # Shared utilities (types, lifecycle, plugin, telemetry)
├── core/                     # Core components (context monitoring)
├── plugins/                  # Plugin implementations (pruning, read-awareness)
├── automation/               # Automation triggers and actions
├── config/                   # Config schema and loader
├── indexer/                  # Index engine, disk cache, persistent store
├── injectors/                # Context injection pipeline and sources
├── detect/                   # File path detection from messages/tools
├── metrics/                  # Token tracking, cost estimation, metrics collection
├── parsers/                  # Language-specific AST parsers
├── persistence/              # Runtime state file I/O
├── ui/                       # TUI notification formatting
├── skills/                   # pi skill definitions
├── tests/                    # Test suite (mirrors source structure)
└── docs/                     # Architecture documentation
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, code style, and how to add a language parser, injection source, or plugin.

---

## License

MIT — see [LICENSE](LICENSE)
