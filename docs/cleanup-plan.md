# Codebase Cleanup Plan — pi-slim v0.4.0

## Analysis Results

### 1. 🗑️ Dead Code — Not Imported by Any Production Module

| File | Lines | Why Dead |
|------|-------|----------|
| `core/context-monitor.ts` | 203 | Only imported by its test. SessionManager does its own tracking. |
| `automation/auto-compactor.ts` | 99 | Only imported by its test. Manager has no auto-compact path. |
| `automation/auto-recapper.ts` | 116 | Only imported by its test. Never wired into SessionManager. |
| `automation/automation-manager.ts` | 168 | Only imported by its test. No triggers registered in production. |
| `automation/triggers.ts` | 94 | Only imported by tests. BUILT_IN_TRIGGERS never registered. |
| `metrics/metrics-collector.ts` | 144 | Only imported by its test. Never instantiated. |
| `shared/lifecycle.ts` | 273 | SessionManager extends it but only uses `ensureRegistered()`. 200+ lines of unused lifecycle hooks and telemetry helpers (SessionManager uses its own). |

**Total dead production code: ~1,097 lines (12% of production codebase)**

### 2. 📚 Planning Documents — Already Executed / Outdated

| File | Size | Status |
|------|------|--------|
| `00_START_HERE.md` | ~4KB | Merge guide — MERGE IS DONE. Outdated. |
| `EXECUTIVE_SUMMARY.txt` | ~2KB | Merge summary — MERGE IS DONE. Outdated. |
| `CODE_PATTERNS.md` | ~17KB | Template patterns for merge code — MERGE IS DONE. |
| `IMPLEMENTATION_ROADMAP.md` | ~27KB | Phase-by-phase merge guide — ALL PHASES DONE. |
| `INTEGRATION_SUMMARY.md` | ~15KB | What context-intel brings — ALREADY ADOPTED. |
| `MERGE_PLAN.md` | ~30KB | Full merge plan — ALREADY EXECUTED. |
| `QUICK_START.md` | ~11KB | "Start here" for merge devs — MERGE IS DONE. |
| `README_MERGE.md` | ~15KB | Document index for merge docs — MERGE IS DONE. |
| `docs/hashline-extension-plan.md` | ~15KB | Plan to extract hashline as standalone extension — ALREADY DONE (as pi-slim built-in). |

**Total stale documentation: ~136KB (50%+ of repo docs)**

### 3. 🔄 Duplicate / Overlapping Logic

| Pattern | Where | Duplication |
|---------|-------|-------------|
| Telemetry wrapping | `shared/lifecycle.ts`, `shared/telemetry-helpers.ts`, inline in manager | 3 different patterns for the same thing |
| Message types | `automation/auto-compactor.ts`, `automation/auto-recapper.ts`, `manager.ts` | `{ role?; content?; [key:string]: unknown }` redefined in 3+ places |
| Pruning rules | `plugins/context-pruning.ts` + `plugins/pruning-rules.ts` | Two modules doing similar pruning with different APIs |
| Context tracking | `core/context-monitor.ts` + manager's own stats | Two separate message/tool/file counters |
| Plugin interface | `shared/plugin.ts` + `shared/lifecycle.ts` | Both define `PluginToolCallResult` |

### 4. 🧹 Trivial Simplifications

| Item | Action |
|------|--------|
| `parsers/language-parser.ts` (6 lines) | Interface only — keep, it's the contract |
| `shared/paths.ts` (16 lines) | `slimDir` used in 3 places — keep |
| `shared/token.ts` (15 lines) | `estimateTokens` used in 5 places — keep |
| `shared/message.ts` (30 lines) | Used in manager + injector — keep |
| `vitest.config.ts` (7 lines) | Test config — keep |
| `extension.ts` can remove unused `initHash` import | Removed in earlier phase |

## Cleanup Plan

### Phase 1: Delete Dead Production Code (~1,097 lines → 0)
1. 🔴 **Delete `core/context-monitor.ts`** — Unused. SessionManager tracks everything inline.
2. 🔴 **Delete `automation/`** (4 files: auto-compactor, auto-recapper, automation-manager, triggers) — All unused.
3. 🔴 **Delete `metrics/metrics-collector.ts`** — Never instantiated.

**Tests to remove:** tests for each deleted module.

### Phase 2: Consolidate Duplicates
4. 🔄 **Merge `shared/lifecycle.ts` into `manager.ts`** — SessionManager is the only consumer. Keeps `ensureRegistered()` inline. Removes 200+ lines of unused hooks/helpers.
5. 🔄 **Unify message types** — Define `AgentMessage` once in `shared/types.ts`, import everywhere.
6. 🔄 **Consolidate pruning logic** — `plugins/pruning-rules.ts` is the pure engine. `plugins/context-pruning.ts` is the plugin wrapper. Keep both but remove duplicate `applyPruningRules` call from `auto-compactor.ts` (file being deleted anyway).

### Phase 3: Delete Stale Documentation (~136KB)
7. 📚 **Delete merge planning documents** — All 9 files executed/outdated.
8. 📚 **Keep only: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/architecture.md`, `docs/hashline-integration-plan.md`, `skills/pi-slim/SKILL.md`**

### Phase 4: Clean Imports & Types
9. 🧹 **Remove `lifecycle.ts` import from `manager.ts`** — Replace with inline registration.
10. 🧹 **Remove unused `PluginToolCallResult` from `shared/lifecycle.ts`** (if lifecycle.ts deleted, this goes away).
11. 🧹 **Update `package.json` `files` field** — Remove deleted directories.

## Metrics Target

| Metric | Current | Target | Delta |
|--------|---------|--------|-------|
| Production LOC | ~8,434 | ~7,000 | **−1,434 (−17%)** |
| Total files (src) | 48 | 38 | **−10** |
| Dead code | 12% | 0% | **−12%** |
| Stale docs | 50%+ | 0% | **−136KB** |
| Duplicate type definitions | 3 places | 1 place | **−2** |
| Tests | 419 | ~390 | **−29** (removes tests for deleted modules) |

## Execution Order

1. Delete dead production code (core/context-monitor, automation/*, metrics/metrics-collector)
2. Delete their tests
3. Consolidate lifecycle.ts → manager.ts
4. Delete stale documentation
5. Clean up package.json and tsconfig.json
6. Run tests, verify
7. Update CHANGELOG
8. Commit, tag v0.4.0, push to GitHub

**Total effort: ~30 minutes**
