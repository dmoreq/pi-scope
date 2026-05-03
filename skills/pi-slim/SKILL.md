---
name: pi-slim
description: Use when working with AST-indexed projects where pi-slim provides skeleton-based dependency context, repo maps, and token-efficient code awareness
---

# pi-slim: AST-Powered Context Injection

pi-slim is an automatic context injection plugin for pi. It parses your project's source files into compact AST **skeletons** (signatures only, no bodies) and injects them into every LLM call — saving ~85-92% tokens vs full file reads.

## What pi-slim Does for You

| Layer | Injected | What it provides |
|-------|----------|-----------------|
| `<repo-map>` | Once (first turn) | Directory tree with exported names per file |
| `<dep-context>` | Every turn | Skeleton signatures for mentioned files + their imports |
| `<context-files>` | Once | AGENTS.local.md, CLAUDE.local.md (if present) |
| `<provider-guidance>` | Once | Provider-specific CLAUDE.md / CODEX.md / GEMINI.md |

**You don't need to configure anything** — it works automatically.

## Interpreting the Output

### `<repo-map>`
A compact directory tree with exported names:
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

### `<dep-context>`
When you mention `auth.ts`, pi-slim injects:
- The skeleton of `auth.ts` (function headers, no bodies)
- The skeleton of everything `auth.ts` imports (1st-degree deps only)

```
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

## When to Use Other Tools

pi-slim provides **forward** dependency info (what does X import?). For other analysis needs:

| You want | Use | Why |
|---------|-----|-----|
| "What files import X?" | `search` / `ripgrep` | Reverse dependency lookup — not in pi-slim's dep graph |
| "Find where function Y is called" | `search` | Text-based call site discovery |
| "Find code with a specific structure" | `ast_grep` (semgrep) | AST-level pattern matching |
| "How many LOC in this project?" | `count_lines` (tokei) | Code statistics |
| "Find all files matching a regex" | `search` | Content search |
| "Find a file by name" | `find_files` (fd) | File path search |

**pi-slim's dep graph is one-directional** — it answers "what does this file depend on?" not "what depends on this file?". For the latter, use `search` or `ripgrep` on import statements.

## Performance Notes

- First session in a project indexes ~1K files in 1-2 seconds
- Subsequent sessions load from `.pi/slim/` cache instantly
- Index is gzip-compressed (~84% smaller on disk)
- Data is cached at `.pi/slim/index.json.gz` and `.pi-cache/slim.json`

## Commands

| Command | Description |
|---------|-------------|
| `/smart-context` | Show injection stats for current/last session |

## Common Pitfalls

- **Very large projects (>10K files):** First indexing takes longer; set `exclude` patterns in `.pi/slim.jsonc` to skip vendor/test dirs
- **pi-slim doesn't do reverse dep lookups:** Use `search "import.*from.*foo"` via pi-sherlock tools
- **The dep graph only covers 1st-degree imports** (direct imports, not transitive chains)
