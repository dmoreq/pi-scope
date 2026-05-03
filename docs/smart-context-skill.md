# smart-context skill

This skill is automatically active when the `@pi/smart-context` extension is loaded.
Copy or symlink this file to `.omp/skills/smart-context.md` in any project where the extension is installed.

---

## What the extension gives you

At session start the extension indexes all `.ts`, `.tsx`, `.py`, and `.rs` files in the project root and persists the result to `.pi/smart-context/`.

On every prompt you receive two injected blocks in your context:

### `<repo-map>` (system prompt, injected once)

A compact directory tree of the entire codebase listing every file and its exported names.
Use it to answer "where does X live?" without reading any files.

```
<repo-map>
  src/
    index.ts   smartContextExtension
    store.ts   storeExists, saveStore, loadStore
    types.ts   SmartContextConfig, DEFAULT_CONFIG
  …
</repo-map>
```

### `<dep-context>` (prepended before each LLM call)

Skeleton signatures for every file you mentioned in recent messages, plus all files those files import.
Bodies are elided (`{ ... }`) — you see types, function signatures, and class shapes without noise.

```
<dep-context>
## Active files
### src/store.ts
export async function storeExists(projectRoot: string): Promise<boolean> { ... }
export async function saveStore(...): Promise<void> { ... }
export async function loadStore(...): Promise<{...}> { ... }

## Direct dependencies
### src/types.ts
export interface SmartContextConfig { ... }
export const DEFAULT_CONFIG: SmartContextConfig
</dep-context>
```

---

## How to use these injections

**Navigating the codebase**
Read `<repo-map>` before using file-read or grep tools.
If a symbol is listed there, you already know which file it lives in.

**Understanding a file**
When the user asks about a file you have not read yet, check `<dep-context>` first.
If its skeleton is there you can often answer interface/type/signature questions without a full read.

**Editing a file**
Before writing an edit, verify the skeleton matches your mental model.
If `<dep-context>` shows a function signature, trust it — the skeleton comes from the live AST.

**Finding dependencies**
`<dep-context>` shows `## Direct dependencies` — the files imported by the active files.
Use this to understand the blast radius of a change before writing any code.

---

## Managing the index

The index is stored in `.pi/smart-context/` relative to the project root:

```
.pi/smart-context/
  repo-map.txt   — the repo map string (human-readable)
  index.json     — full serialised dep graph (loaded on next session)
```

**Force a rebuild** — delete the store and restart the session:
```bash
rm -rf .pi/smart-context/
```

**Debug the index** — run the debug tool to inspect what was indexed:
```bash
make debug FOLDER=.           # full report
make debug FOLDER=. NO_TS=1  # skip TypeScript dep graph
```

**Exclude vendored code** — add to your project settings (`.omp/settings.json`):
```json
{
  "flags": {
    "smart-context.maxRepoMapTokens": 6000
  }
}
```
Or rebuild excluding a glob:
```bash
rm -rf .pi/smart-context/
make debug FOLDER=. EXCLUDE='crates/vendor-*/**'
```

---

## Token budget

| Injection | Default | Flag |
|---|---|---|
| Repo map (system prompt) | 4 000 tokens | `smart-context.maxRepoMapTokens` |
| Dep context (per turn) | 8 000 tokens | `smart-context.maxInjectionTokens` |
| Messages scanned | last 10 | `smart-context.scanLastNMessages` |

The extension never exceeds these budgets — entries are dropped when the limit is reached.

---

## Supported languages

| Language | Skeletons extracted | Imports tracked |
|---|---|---|
| TypeScript / TSX | Classes, functions, interfaces, types, enums | Relative `.ts` / `.tsx` imports |
| Python | Classes, `def` signatures (indented) | Relative `from . import` |
| Rust | `fn`, `struct`, `enum`, `trait`, `impl`, `type` | `mod x;`, `use crate::`, `use super::` |
