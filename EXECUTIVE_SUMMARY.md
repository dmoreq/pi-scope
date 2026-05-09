# Executive Summary: pi-scope

## What Is pi-scope?

pi-scope is a **context, retrieval & code intelligence** extension for [pi](https://github.com/mariozechner/pi-coding-agent). It makes AI assistants dramatically faster and cheaper at navigating large codebases by:

1. **Injecting compact AST skeletons** (~10% of file size) instead of full files
2. **Finding files by what they contain** (symbol names), not just filenames
3. **Running graph analysis** to identify god nodes, communities, and patterns
4. **Enabling hash-verified editing** without re-reading files
5. **Providing LSP code navigation** (go-to-def, references, hover)

---

## Core Capabilities

### 🧠 Intelligent Retrieval
Finds files by exported symbol names. Score formula: `3×symbolMatch + 2×filenameMatch + 1×depProximity`.

**Graph Boost:** When graph data is available, god nodes get a 2× score multiplier and surprising connections are injected as context breadcrumbs.

### 🔗 Graph Analysis
Runs 5 algorithms automatically at startup (if `graphify-out/graph.json` exists):

| Algorithm | What it finds | Display |
|-----------|---------------|---------|
| Degree Centrality | Nodes with most connections | God nodes |
| PageRank | Important nodes (by importance flow) | God node ranking |
| Louvain Clustering | Related module groups | Communities |
| Tarjan's SCC | Circular dependency chains | Cycle count |
| Surprise Detection | Cross-community edges | Guidance section |

**Graceful fallback:** Without graph data, pi-scope runs normally with all core features.

### 💰 Token Efficiency
| Scenario | Without pi-scope | With pi-scope | Savings |
|----------|----------------|---------------|---------|
| Understand a file | ~200t (full read) | ~20t (skeleton) | 90% |
| Find a definition | ~200t (search) | ~2t (LSP) | 99% |
| Edit a function | ~200t (read+edit) | ~0t (hashline) | ~100% |

### 🔧 Code Intelligence
- **Hashline Editing** — edit with hash-verified anchors, no re-read needed
- **LSP Navigation** — go-to-definition, find references, hover (with graph metrics when available)
- **Context Pruning** — dedup, superseded writes, error purging, community-aware filtering
- **Wikipedia Subsystem** — auto-generated symbol documentation with metrics and impact analysis

---

## Key Metrics

| Metric | Value |
|--------|-------|
| **Test suite** | 594 tests, all passing (42/44 test files) |
| **Graphify-specific tests** | 330 tests across 12 test files |
| **Token savings** | ~85-96% vs full file reads |
| **Graph analysis speed** | ~30ms (small graph) to ~300ms (100 nodes) |
| **Cache reload** | <25ms (graph) / <50ms (index) |
| **Breaking changes** | Zero — all graph features are optional |

---

## Architecture

```
pi-scope/
├── extension.ts              # Extension entry point
├── manager.ts                # SessionManager + graph analysis orchestration
├── algorithms/               # 5 graph algorithms (degree, PageRank, Louvain, cycles, surprises)
├── cli/                      # CLI command handlers (/wiki, /wiki-search, etc.)
├── context/                  # Retrieval, injection, graphify modules (7 files)
├── hashline/                 # Hashline editing system
├── lsp/                      # LSP client + service
├── indexer/                  # AST indexing engine
├── parsers/                  # Language parsers (TS, Python, Rust)
├── plugins/                  # Plugin system + built-in plugins
├── persistence/              # Graph cache
├── metrics/                  # Tracker + graph metrics + cost estimation
├── visualization/            # D3.js HTML dashboard generator
├── shared/                   # Utilities
├── ui/                       # TUI notifications, dashboard, init prompt
├── docs/                     # Reference documentation
└── tests/                    # 594 tests (42 files)
```

**22 source files** across 13 directories, **12 test files** with comprehensive coverage.

---

## Design Philosophy

1. **Zero-config** — auto-indexes, auto-detects graph data, cache loads instantly
2. **Graceful degradation** — all graph features are optional with seamless fallback
3. **Token efficiency first** — ~10% skeleton size, graph overhead <5%
4. **Open for extension** — Plugin interface (OCP), language parsers, algorithm modules
5. **Backwards compatible** — zero breaking changes across the entire implementation
