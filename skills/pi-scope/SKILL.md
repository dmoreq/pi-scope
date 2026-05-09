---
name: pi-scope
description: AST-powered context injection, intelligent symbol-based file retrieval, graph analysis, hashline editing, and LSP code navigation for pi
---

# pi-scope: Context, Retrieval, Graph Analysis & Code Intelligence

pi-scope parses your project's source files into compact AST skeletons, retrieves files intelligently by symbol name and relevance, runs graph analysis to identify god nodes and communities, supports hash-verified editing, and provides LSP code navigation — saving ~85-97% tokens vs naive full-file reads.

## What pi-scope Does for You

### Intelligent Retrieval (Automatic)

pi-scope finds files by **what they export**, not just their filename. When you mention a function name, it matches against the symbol index built at session start.

**Scoring:** `3×symbolMatch + 2×filenameMatch + 1×depProximity`

**Graph boost:** God nodes (highly depended-on symbols) get a 2× score multiplier. Surprising connections (cross-community edges) are injected as context breadcrumbs.

### Context Injection (Automatic)

| Layer | Injected | What it provides |
|-------|----------|-----------------|
| `<repo-map>` | Once (first turn) | Directory tree with exported names, sorted by recency |
| `<dep-context>` | Every turn | Scored skeletons for retrieved files + transitive deps |
| `<context-files>` | Once | AGENTS.local.md, CLAUDE.local.md |
| `<provider-guidance>` | Once | Provider-specific CLAUDE.md / CODEX.md / GEMINI.md |
| `<graph-insights>` | Once | God nodes, communities, cycle count (if graph data available) |

### Graph Analysis (Automatic When graphify-out/graph.json Exists)

When `graphify-out/graph.json` is found at session start, pi-scope automatically runs:

| Algorithm | What it detects | How it helps you |
|-----------|-----------------|------------------|
| **Degree Centrality + PageRank** | God nodes — symbols everything depends on | Boosts their retrieval score 2×; shows in `/scope` dashboard |
| **Louvain Clustering** | Communities — related module groups | Community pruning plugin keeps context focused |
| **Cycle Detection (Tarjan SCC)** | Circular dependencies | Warned in dashboard, used for impact analysis |
| **Surprise Detection** | Cross-community edges | Injected as context breadcrumbs for exploration |

**Without graphify:** pi-scope runs normally with all core features. Graph analysis is purely additive with zero breaking changes.

### Hashline Editing

The `hashline_edit` tool edits files using `LINE+BIGRAM` anchors. The agent sees hash-annotated content and references lines by anchor — no file re-read.

**Dry-run mode:** `dry_run: true` validates without writing.

### LSP Navigation

Three tools: `lsp_go_to_definition`, `lsp_find_references`, `lsp_hover`. When graph analysis is active, hover info includes god node status, centrality metrics, and community membership. Results auto-inject into next context.

## When to Use Graph Features

**When a user asks about architecture or codebase structure:**
- Call `/wiki-communities` — see how modules are grouped
- Call `/wiki-god-nodes` — see the most depended-on symbols
- Call `/wiki-impact <symbol>` — see what would break if a symbol changes
- Call `/wiki <symbol>` — get auto-generated documentation page for a symbol

**When investigating a bug or planning a refactor:**
- Check if the symbol is a god node (high risk to change)
- Check `/wiki-impact` to see transitive dependents
- Cross-reference against community structure for modularity

**When exploring an unfamiliar codebase:**
- Start with `/wiki-god-nodes` to find the load-bearing abstractions
- Use `/wiki-search type:module` to find all modules
- Navigate communities via `/wiki-communities`

## No User Commands

pi-scope has **zero user commands.** All features are automatic:

- Index builds auto-magically on first codebase-relevant query
- Graph analysis runs at startup when `graphify-out/graph.json` is present
- Context is injected every turn — no commands needed
- Graph insights (god nodes, communities) are added to system prompt automatically
- Notifications appear via pi-telemetry badges

**If you need to investigate specific symbols, use these built-in tools:**
- `/hashline-read <file>` — Read a file with hash anchors

## Common Pitfalls

- **Large projects (>10K files):** Set `exclude` patterns in `.pi/slim.jsonc`
- **Reverse dep lookups:** Use `search`/`ripgrep` via pi-sherlock
- **LSP requires binaries on $PATH:** `typescript-language-server`, `gopls`, `pyright-langserver`, `rust-analyzer`
- **First-degree imports only** in dep graph (transitive configurable via `dependencyDepth`)
- **Graph data requires graphify:** Install graphify (`pip install graphifyy`) and run `graphify .` to generate `graphify-out/graph.json`. pi-scope detects and uses it automatically.
