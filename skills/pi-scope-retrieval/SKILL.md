---
name: pi-scope-retrieval
description: Use when pi-scope fails to find the right files by context, when you need files retrieved by symbol name instead of path, or when you want to understand how file scoring and dep-context injection works
---

# pi-scope Intelligent Retrieval

## How File Retrieval Works

At session start, pi-scope builds a **symbol index** of every exported name across all parsed files. When you mention a function/class/variable name, the retrieval engine matches against this index — not just filenames.

When graph data is available (from `graphify-out/graph.json`), retrieval is further **boosted**:
- God nodes get a 2× score multiplier
- Surprising connections are injected as context breadcrumbs
- Community pruning keeps only relevant community context per turn

## Scoring Formula

```
score(file) = 3 × symbolMatch + 2 × filenameMatch + 1 × depProximity
```

| Signal | Weight | What it matches |
|--------|--------|-----------------|
| **symbolMatch** | 3× | Query token matches a symbol that `file` exports |
| **filenameMatch** | 2× | Query token matches the file's basename (without extension) |
| **depProximity** | 1× | File is already a transitive dep of an active file |

**Graph boost (additional):** God nodes in the result set get 2× total score multiplication.

## What Gets Injected

Each turn, pi-scope examines the last N messages (default 10) and:

1. **Scans for file paths** via regex — matches `path/to/file.ts` patterns
2. **Scans tool calls** — reads `path`, `filePath`, `file`, `target` arguments from `read`/`write`/`edit`/`bash`/`grep` calls
3. **Scans tool outputs** — extracts paths from compiler errors, logs, and grep results
4. **Runs scored retrieval** — if symbol index exists, scores all files against query text

Matches are combined into an `<dep-context>` block:

```xml
<dep-context>
## Active files
### src/auth.ts
export function authenticate(token: string): User { ... }

## Direct dependencies
### src/auth/models.ts
export interface User { ... }
</dep-context>
```

## Graph-Enhanced Retrieval Commands

When graph data is available, use these commands to understand the codebase structure:

| Command | When to use |
|---------|-------------|
| `/wiki <symbol>` | Get a full auto-generated documentation page for any symbol |
| `/wiki-god-nodes` | See which symbols are most depended-on (critical architecture) |
| `/wiki-communities` | Understand how modules group into functional areas |
| `/wiki-impact <symbol>` | Check what would break if you change a symbol |
| `/wiki-search <keyword>` | Find symbols by name, type, or community membership |

## Influencing Retrieval

**To make pi-scope find a file:**

1. **Mention the symbol name** — "edit the `authenticate` function" → finds files exporting `authenticate`
2. **Mention the filename** — "look at `auth.ts`" → `filenameMatch` fires
3. **Use `/hashline-read`** — file becomes visible to dep-proximity scoring
4. **Call an LSP tool** — resolved locations feed into next context's `extraPaths`
5. **Check god nodes** — if the symbol is a god node, it's automatically boosted 2×

**Avoid vague queries** like "that validation module" — use the actual symbol name or check `/wiki-search` first.

## Reading the `<dep-context>` Block

```
<dep-context>
## Active files              ← Files matching your query
### src/auth.ts              ← File path (relative to project root)
export function auth...      ← AST skeleton (signatures only, ~10% of file)

## Direct dependencies       ← Imported modules of active files
### src/auth/models.ts       ← Available without reading
export interface User...
</dep-context>
```

- **Active files** section: highest-scored matches, sorted by relevance
- **Direct dependencies** section: transitive imports (depth configurable via `dependencyDepth`)
- Each entry shows the **AST skeleton** (function/class signatures), not full content

## Transitive Dependency Depth

Configurable via `dependencyDepth` (0-3, default 1):

| Depth | Resolution |
|-------|------------|
| 0 | Active files only — no dependency injection |
| 1 | Active files + their direct imports |
| 2 | Active files + direct imports + those imports' imports |
| 3 | Three levels deep |

## Common Mistakes

| Mistake | Why it fails | Fix |
|---------|--------------|-----|
| Using vague references | No symbol match — falls back to regex path scanning | Use the exact symbol name |
| Expecting full file content | Only **skeletons** are injected | Read the file explicitly if you need full content |
| Assuming all dirs indexed | Excluded dirs (`node_modules`, `dist`, patterns in `slim.exclude`) are skipped | Check your `exclude` config |
| Path not in recent N messages | `scanLastNMessages` default = 10; older messages are ignored | Mention the path again in a recent message |
| Ignoring god nodes on risky changes | High-impact symbols are marked in the graph | Always check `/wiki-impact` before modifying a symbol in `/wiki-god-nodes` |
