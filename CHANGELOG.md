# Changelog

## [0.2.0] - 2026-05-04

### Added
- **ExtensionLifecycle base class** (SRP) — base class for lifecycle-aware extensions with telemetry helpers
- **Plugin system** (OCP) — Plugin interface + PluginManager for extensible architecture
- **ContextMonitor** — single source of truth for session state tracking (messages, tool calls, files, tokens)
- **ContextPruningPlugin** — automatic message pruning with 3 rules:
  - Deduplication (remove identical consecutive messages)
  - Superseded Writes (remove old writes superseded by newer ones)
  - Error Purging (remove errors followed by success)
- **ReadAwarenessPlugin** — prevents edits to files that haven't been read first
- **AutomationManager** — trigger-based automation system with 4 built-in triggers:
  - `recap-hint`: Suggest `/recap` after 20+ messages and 10 min idle
  - `context-warning`: Warn when context window > 80% full
  - `file-tracking`: Suggest handoff prep when 10+ files modified
  - `high-activity`: Suggest recap when 50+ tool calls
- **AutoRecapper** — session recap generation for handoff and summarization
- **AutoCompactor** — conversation compaction via pruning rules + message limits
- **MetricsCollector** — centralized metrics collection for pi-telemetry
- **Telemetry helpers** (DRY) — 6 consolidated functions replacing ~50 lines of inline telemetry calls
- **325 tests** (200 new) across 28 test files — 0 regressions

### Changed
- **SessionManager refactored** — now extends ExtensionLifecycle, uses PluginManager, consolidated telemetry
- **INJECTION_HANDLERS removed** — replaced by plugin-based injection via PluginManager
- **Architecture docs updated** — added plugin system, automation, telemetry layers
- **README expanded** — added sections on pruning, automation, plugins, telemetry
- **Types merged** — TokenUsage and SessionStats added to shared/types.ts from context-intel

### Fixed
- Edge case in hashContent when message content is undefined
- Missing error boundaries in plugin hook execution
- Telemetry null-safety in all helper functions

### Technical Debt
- SOLID principles enforced: SRP, OCP, LSP, DIP, ISP, DRY
- ~120KB of new production code across 15 source files
- All TypeScript compiles with strict mode — zero errors
- All tests pass with zero regressions

## [0.1.0] - 2024-11-XX

### Added
- Initial release
- AST indexing with tree-sitter (TypeScript, Python, Rust)
- Repo map injection
- Dependency context injection
- Config file support (.pi/slim.jsonc)
- Zero-config auto-indexing
- Gzip-compressed cache

## [0.0.1] - 2024-10-XX

### Added
- Proof of concept
- Basic file walking and skeleton extraction
- Single-language support (TypeScript)
