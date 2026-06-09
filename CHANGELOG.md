# Changelog

## [0.9.0] - 2026-06-09

### Added
- **`shared/path-policy.ts`** — Unified source-path policy module: `createPathPolicy()`, `PathPolicy` interface, `DEFAULT_IGNORES`, `SOURCE_EXTENSIONS`, `PARSER_EXTENSIONS`, `isSupportedSourcePath()`, `hasParserSupport()`. Eliminates duplicated ignore/path logic scattered across indexer, commands, and tools.
- **`shared/concurrency.ts`** — `mapLimit<T, R>(items, limit, fn)`: bounded concurrent async mapping utility, used by the indexer for parallel file parsing.
- **`shared/line-window.ts`** — `readLineWindow()` (async, streaming) and `readLineWindowSync()` (sync, chunked reads): efficient partial-file reads for hashline anchor extraction, replacing full-file reads.
- **`shared/index-fingerprint.ts`** — `computeRepoIndexFingerprint(index)`: SHA-256 fingerprint of a `RepoIndex` (files + deps + symbols). Extracted from `graph-service.ts` so it can be computed once at index-save time and reused on reload.
- **`context/graph-lookup-index.ts`** — `GraphLookupIndex` class: pre-built read-only lookup tables (node adjacency, in/out-degree, community membership, god-node maps, surprise maps) for all graph analysis hot paths. `buildGraphLookupIndex(analysis)` factory function. Shared across retrieval, dep-context, LSP hover, and hashline-inject.
- **`StoredIndexV2.graphFingerprint`** and **`IndexMetadata.graphFingerprint`** — new optional fields in `shared/schema-v2.ts`; the index-store persists the fingerprint so the graph-service can skip recomputing it on reload.

### Changed
- **`indexer/engine.ts`** — `IndexEngine.build()` now parallelizes file parsing with `mapLimit(..., 12, ...)`. `resolveImport()` accepts a pre-built `sourcePaths: Set<string>` instead of doing per-import `existsSync()` checks, eliminating O(files²) filesystem calls.
- **`context/retrieval.ts`** — `RetrievalEngine` builds pre-computed inverted lookup tables (`exactSymbols`, `partialSymbols`, `filenames`, `exactPaths`, `suffixPaths`) at construction time; scoring no longer iterates the full symbol index on every query.
- **`context/pipeline.ts`** — `InjectionPipeline.produce()` now lazily evaluates `source.produce()` in priority order, skipping all remaining sources once the token budget is exhausted. Previously, all sources were produced eagerly before budget trimming.
- **`lsp/service.ts`** — `ensureDocumentOpen()` now uses an `openingDocs: Map<string, Promise<void>>` to coalesce concurrent open requests for the same file, preventing redundant reads during batch navigation.
- **`services/graph-service.ts`** — `analyzeFromIndex()` accepts `{ indexFingerprint?: string }` option; if provided, skips recomputing the SHA-256 fingerprint. Private `indexFingerprint()` function removed and superseded by `shared/index-fingerprint.ts`.
- **`manager.ts`** — Auto-reindex now correctly builds `nextState` before calling `loadGraph(nextState)`, preventing graph analysis from landing on the previous session state object. Manager pre-builds `GraphLookupIndex` after graph analysis and passes it to retrieval and dep-context.
- **`algorithms/community-detection.ts`** and **`algorithms/pagerank.ts`** — Performance-optimized implementations (lower GC pressure, tighter loop structures).
- **`graph/analyzers/graph-analyzer.ts`** and **`compute-graph-analysis.ts`** — Refactored hot paths for cold graph analysis.
- **`commands/hashline-read.ts`** and **`hashline/lsp-hover-anchor.ts`** — Now use `readLineWindowSync` for anchor extraction instead of loading full file content.
- **`context/dep-context.ts`**, **`context/graph-impact.ts`**, **`context/graph-lsp-hover.ts`**, **`context/hashline-inject.ts`** — Accept pre-built `GraphLookupIndex` to avoid redundant graph traversals.

### Fixed
- **`manager.ts`** — Graph state was silently lost after auto-reindex because `loadGraph` was called before `this.state` was updated to the new session state; now correctly ordered.

### Performance

| Operation | Before | After |
|-----------|--------|-------|
| Source indexing (1,000 files) | Sequential | 12-way parallel via `mapLimit` |
| Import resolution | `existsSync()` per import | Set lookup (`O(1)`) via pre-built `sourcePaths` |
| Retrieval scoring | Full `symbolIndex` scan per query | Pre-built inverted lookup tables |
| Graph fingerprint on reload | Recomputed from index | Read from persisted `StoredIndexV2.graphFingerprint` |
| Context pipeline | All sources produced eagerly | Lazy: skips sources past budget |
| LSP batch document open | One `readFile` per concurrent open | Coalesced: one read total via `openingDocs` map |
| Graph lookups (community, god-node, adjacency) | Linear scans per query | O(1) via `GraphLookupIndex` pre-built maps |

### Quality
- **Tests:** ~730 tests across 60+ test files (all passing)
- Added 16 new test files covering: concurrency, line-window, path-policy, cycle-detection, dep-context, graph-impact, graph-lsp-hover, hashline-inject, retrieval-graph, pipeline (lazy budget), indexer parallelism, lsp-batch, hashline-editor-mismatch, manager-reindex, graph-cache-fingerprint integration

## [0.8.0] - 2026-05-12

### Added
- **Architecture documentation** — comprehensive ARCHITECTURE.md covering 12 feature groups, data flow, design patterns, and integration points
- **Feature analysis** — documented all 50+ features, 12 groups, 15 examined overlaps with zero conflicts detected
- **Build system** — esbuild-based TypeScript transpilation for proper dist/ compilation
- **Code quality** — biome configuration for consistent linting and formatting

### Changed
- **Build pipeline** — replaced tsc with esbuild to handle noEmit: true in tsconfig.json
- **Linting** — 118 warnings reduced to ≤40 through:
  - 11 `noForEach` → `for...of` replacements
  - 13 `noExplicitAny` → proper types
  - 7 `noNonNullAssertion` → null checks
  - 370+ files auto-formatted
- **Documentation** — removed non-core analysis artifacts, standardized on GitHub format

### Fixed
- TypeScript compilation errors from ParseError (missing initializer)
- All 75 dist files now have valid JavaScript syntax
- Type assertion warnings across 9 critical modules

### Quality Improvements
- **Tests:** 614/614 (100% passing)
- **Dist validation:** 75/75 (100% valid)
- **Architecture:** EXCELLENT (50/50 quality score)
- **Conflicts:** ZERO detected across all feature groups

## [0.7.1] - 2026-05-09

### Added
- **Broad codebase query detection** — `handleContext()` now triggers context injection for high-level introspection queries (e.g., "what does this codebase do", "show me the architecture", "what are the key files") that don't mention specific file paths or symbol names.
  - `shared/query-intent.ts` — `isBroadCodebaseQuery()` classifier with 14 regex patterns covering overview, structure, purpose, and key-file queries
  - `context/dep-context.ts` — `getBroadOverviewFiles()` injects top files by reverse-dependency centrality plus entry-point files; `buildModuleStructureListing()` adds compact directory grouping
  - `manager.ts` — new `hasCodebaseQuery` trigger before the early-exit gate in `handleContext()`

### Fixed
- Context injection now activates on first-turn broad codebase questions (previously required specific file paths, tool calls, or symbol matches)

## [0.7.0] - 2026-05-04

### Added
- **Intelligent Retrieval** — scored file retrieval via symbol index, filename matching, and dependency proximity
  - `context/retrieval.ts` — RetrievalEngine with multi-signal scoring (3×symbolMatch + 2×filenameMatch + 1×depProximity)
  - Symbol exports extracted from all 3 parsers (TypeScript, Python, Rust) into `FileIndex.exports[]`
  - Inverted symbol index (`symbol→files[]`) built during graph construction
  - Reverse dependency index (`file→dependents[]`) for impact analysis
- **Transitive dependency resolution** — configurable via `dependencyDepth` (1-3, default 1)
- **Hashline dry-run mode** — `dry_run: true` validates anchors and shows diff without writing
- **Pruning telemetry** — `✂️ Pruned 5/30 (17%)` notifications via pi-telemetry
- **Repo map relevance sorting** — files sorted by modification time (most recent first)
- **Compact unified guidance** — 5-line tool overview in system prompt covering hashline + LSP

### Changed
- `ContextInjector.buildInjection()` — accepts optional `RetrievalEngine` and `transitiveDepth` params
- `RepositoryIndex` now includes `reverseDeps` and `symbolIndex` fields
- Manager wired retrieval into session state with `s.retrieval` field
- Pruning plugin fires telemetry notifications on each cycle

### Package Rename
- Package renamed from `pi-slim` to `pi-scope`
- Skill directory: `skills/pi-slim/` → `skills/pi-scope/`
- All internal docs, comments, and identifiers updated

## [0.6.0] - 2026-05-04

### Changed
- **Documentation rewrite** — README, CONTRIBUTING, architecture, SKILL.md fully updated to reflect current codebase
- **Stale code removed** — `recordAutomation()` dead function, stale "automation" comments in manager/plugin/telemetry
- **Stale docs deleted** — cleanup-plan, naming-refactor-plan, hashline-integration-plan execution docs

## [0.5.0] - 2026-05-04

### Changed
- **Naming & folder structure refactor** — `injectors/` → `context/`, `detect/` + `persistence/` → `shared/`, plugins consolidated

## [0.4.0] - 2026-05-04

### Removed
- **Dead code cleanup** — `core/context-monitor.ts`, `automation/` (4 files), `metrics/metrics-collector.ts`, `shared/lifecycle.ts`
- **~1,691 LOC removed** (−20%), **10 stale docs** deleted

## [0.3.0] - 2026-05-04

### Added
- **Hashline edit system** — 6 pure modules extracted from oh-my-pi: `hashline/line-hash.ts`, `normalize.ts`, `core.ts`, `diff.ts`, `diff-preview.ts`, `streaming.ts`
- **`hashline_edit` tool** — registered via `defineTool`, wraps hashline core with file I/O
- **LSP navigation** — 3 tools (`lsp_go_to_definition`, `lsp_find_references`, `lsp_hover`) + LSP service
- **94 new tests** (419 total)

## [0.2.0] - 2026-05-04

### Added
- **Context intelligence adoption** from pi-me — ExtensionLifecycle, Plugin system, ContextMonitor, pruning plugins, automation triggers
- **Telemetry helpers** for consolidated pi-telemetry integration
- **325 tests** across 28 test files

## [0.1.0] - 2024

### Added
- Initial release — AST indexing with tree-sitter, repo map, dependency context, config file support
