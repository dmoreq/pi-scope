# Quick Start: Merge Implementation

**For busy developers: Start here. 5-minute overview.**

---

## What Are We Doing?

Merging `session-lifecycle/context-intel` from pi-me into pi-slim. This brings:
- **Message Pruning** (remove redundant messages automatically)
- **Smart Automation** (suggest recap, compact, consolidate)
- **Plugin System** (extensible architecture)
- **Full Telemetry** (track everything)

**Impact:** More automation, less manual context management, production-ready.

---

## Where to Start

1. **Read this file** (5 min) ← You are here
2. **Read INTEGRATION_SUMMARY.md** (10 min) — High-level overview
3. **Read MERGE_PLAN.md** (15 min) — Comprehensive plan
4. **Read IMPLEMENTATION_ROADMAP.md** (20 min) — Execution steps

Then pick a phase and start coding.

---

## The 7 Phases at a Glance

| # | Phase | Hours | Status | Start Condition |
|---|-------|-------|--------|-----------------|
| 1 | Analysis | 2-3 | ✅ Done | - |
| 2 | **Refactoring** | 8-10 | 🔄 READY | After approval |
| 3 | Automation | 6-8 | ⏳ Next | Phase 2 complete |
| 4 | Testing | 8-10 | ⏳ Next | Phases 2-3 complete |
| 5 | Telemetry | 4-6 | ⏳ Next | Phase 4 in progress (parallel) |
| 6 | Documentation | 4-6 | ⏳ Next | Phase 4 in progress (parallel) |
| 7 | Release | 3-5 | ⏳ Final | All phases complete |

**Total: 35-48 hours (~1 week with 2 developers)**

---

## Phase 2: Refactoring (First Steps)

### What to Build
1. **ExtensionLifecycle** — base class (SRP pattern)
2. **PluginManager** — plugin registry (OCP pattern)
3. **ContextMonitor** — session tracking (adopt from context-intel)
4. **ContextPruningPlugin** — pruning rules (adopt)
5. **ReadAwarenessPlugin** — read tracking (adopt)
6. **Telemetry Helpers** — consolidate (DRY pattern)
7. **SessionManager** — refactor to use plugins

### Effort: 8-10 hours (1-2 developers, 2 days)

### Steps to Execute

#### Step 1: Create ExtensionLifecycle (1 hour)
```bash
# File to create
src/shared/lifecycle.ts

# Content: Base class with lifecycle hooks
# Copy from IMPLEMENTATION_ROADMAP.md section 2.1
```

**Checklist:**
- [ ] File created with all abstract methods
- [ ] Telemetry & notification helpers added
- [ ] Unit test written & passing

---

#### Step 2: Create Plugin System (2 hours)
```bash
# Files to create
src/shared/plugin.ts           # Plugin interface
src/shared/plugin-manager.ts   # Plugin registry

# Content: OCP-compliant plugin system
# Copy from IMPLEMENTATION_ROADMAP.md section 2.2
```

**Checklist:**
- [ ] Plugin interface defined
- [ ] PluginManager implemented (register, unregister, runHook)
- [ ] 5+ unit tests passing

---

#### Step 3: Adopt ContextMonitor (1.5 hours)
```bash
# File to copy/adapt
cp pi-me/session-lifecycle/context-intel/core/context-monitor.ts \
   pi-slim/src/core/context-monitor.ts

# Then update imports to local paths
```

**Checklist:**
- [ ] File copied & imports updated
- [ ] Types unified in shared/types.ts
- [ ] 8+ unit tests passing

---

#### Step 4: Adopt Pruning Plugin (1.5 hours)
```bash
# File to copy/adapt
cp pi-me/session-lifecycle/context-intel/plugins/context-pruning.ts \
   pi-slim/src/plugins/context-pruning.ts

# This includes 8 pruning rules:
# - deduplication
# - error-purging
# - recency
# - tool-pairing
# - superseded-writes
# (+ 3 new ones)
```

**Checklist:**
- [ ] File copied & imports updated
- [ ] All 8 rules implemented
- [ ] 30+ unit tests passing (snapshot-based)

---

#### Step 5: Adopt Read Awareness (1 hour)
```bash
# File to copy/adapt
cp pi-me/session-lifecycle/context-intel/plugins/read-awareness.ts \
   pi-slim/src/plugins/read-awareness.ts
```

**Checklist:**
- [ ] File copied & imports updated
- [ ] 8+ unit tests passing

---

#### Step 6: Consolidate Telemetry (1 hour)
```bash
# File to create
src/shared/telemetry-helpers.ts

# Functions:
# - recordInjection(source, tokens, files)
# - recordPruning(rulesApplied, removed, total)
# - recordContextUsage(stats)
# - registerPackage(config)

# Copy from IMPLEMENTATION_ROADMAP.md section 2.6
```

**Checklist:**
- [ ] 4 helper functions implemented
- [ ] Used in SessionManager, plugins
- [ ] Reduces 40+ lines of boilerplate

---

#### Step 7: Refactor SessionManager (2 hours)
```bash
# File to refactor
src/manager.ts

# Changes:
# 1. Extend ExtensionLifecycle
# 2. Own PluginManager instance
# 3. Use telemetry-helpers (not inline)
# 4. Remove INJECTION_HANDLERS (replace with plugins)
# 5. Delegate to plugins (not hard-coded)

# Copy from IMPLEMENTATION_ROADMAP.md section 2.7
```

**Checklist:**
- [ ] SessionManager extends ExtensionLifecycle
- [ ] PluginManager owned and used
- [ ] Telemetry helpers used
- [ ] INJECTION_HANDLERS removed
- [ ] All existing tests still pass (85+)
- [ ] New plugin integration tests added (10+)

---

#### Step 8: Verify Tests Pass (30 min)
```bash
npm test

# Expected output:
# ✓ 95+ tests passing
# ✓ No TypeScript errors
# ✓ No ESLint issues
```

---

## Quick Reference: Files to Create/Modify

### New Files (Phase 2)
```
src/shared/lifecycle.ts           ← ExtensionLifecycle base class
src/shared/plugin.ts              ← Plugin interface
src/shared/plugin-manager.ts      ← Plugin registry
src/shared/telemetry-helpers.ts   ← Consolidated helpers
src/core/context-monitor.ts       ← Adopt from context-intel
src/plugins/context-pruning.ts    ← Adopt from context-intel
src/plugins/read-awareness.ts     ← Adopt from context-intel
tests/shared/lifecycle.test.ts    ← Base class tests
tests/shared/plugin-manager.test.ts ← Registry tests
tests/core/context-monitor.test.ts ← Monitor tests
tests/plugins/context-pruning.test.ts ← 30+ pruning tests
tests/plugins/read-awareness.test.ts ← 8+ awareness tests
```

### Modified Files (Phase 2)
```
src/manager.ts                    ← Refactor for plugins
src/shared/types.ts               ← Merge context-intel types
```

---

## Copy-Paste Commands

### Get context-intel files from pi-me
```bash
# Copy files to inspect
cp -r /Users/quy.doan/Workspace/personal/pi-me/session-lifecycle/context-intel \
  /tmp/context-intel-src

# Then adapt and integrate into pi-slim
```

### Create new test file
```bash
touch tests/shared/lifecycle.test.ts
cat > tests/shared/lifecycle.test.ts << 'EOF'
describe('ExtensionLifecycle', () => {
  it('provides base hooks', () => {
    // See IMPLEMENTATION_ROADMAP.md section 2.1
  });
});
EOF
```

### Run tests with coverage
```bash
npm test -- --coverage
npm test -- --watch          # Watch mode while developing
npm test -- context-monitor  # Single file
```

---

## Success Indicators for Phase 2

### Minimum Viable (MVP)
- [ ] 85+ tests passing
- [ ] ExtensionLifecycle works
- [ ] PluginManager functional
- [ ] SessionManager uses plugins
- [ ] No breaking changes

### Excellent (Recommended)
- [ ] 95+ tests passing
- [ ] SOLID principles checked
- [ ] Telemetry helpers consolidated
- [ ] Code review approved
- [ ] Documentation updated

---

## Troubleshooting

### Tests Failing
1. Check TypeScript: `npm run build`
2. Check imports: Are they updated from pi-me paths?
3. Check mocks: Are telemetry calls mocked in tests?
4. Run single test: `npm test -- context-monitor.test.ts`

### Import Errors
```typescript
// ❌ BAD (pi-me paths still present)
import { ContextMonitor } from '../../session-lifecycle/context-intel/core/context-monitor';

// ✅ GOOD (local paths)
import { ContextMonitor } from '../core/context-monitor.js';
```

### Circular Dependencies
If you see "circular dependency" warnings:
1. Move shared types to `shared/types.ts`
2. Use interfaces instead of concrete classes in imports
3. Use telemetry-helpers for isolated telemetry calls

---

## How to Get Help

1. **Architecture questions?** → Read MERGE_PLAN.md section 1-3
2. **Implementation questions?** → Read IMPLEMENTATION_ROADMAP.md
3. **Code patterns?** → Read CODE_PATTERNS.md
4. **Type errors?** → Check shared/types.ts for unified types
5. **Test failures?** → See "Troubleshooting" above

---

## Recommended Development Workflow

### Daily Checklist
- [ ] Start with one subtask (e.g., "Create ExtensionLifecycle")
- [ ] Write tests first (TDD)
- [ ] Implement code
- [ ] Run `npm test` locally
- [ ] Commit with clear message
- [ ] Move to next subtask

### Git Workflow
```bash
# Create feature branch
git checkout -b feat/context-intel-merge

# Work on subtask
git add src/shared/lifecycle.ts tests/shared/lifecycle.test.ts
git commit -m "feat: add ExtensionLifecycle base class"

# Push daily
git push origin feat/context-intel-merge

# After Phase 2 complete, create PR
# After review approval, merge to main
```

### Testing Strategy
```bash
# Before committing
npm run build      # Check TypeScript
npm test           # Run all tests
npm run lint       # Check code style

# After committing
git push
# CI/CD runs in GitHub (automated)
```

---

## Phase 2 Checklist (Copy to Jira/GitHub Issues)

```markdown
## Phase 2: Refactoring (8-10 hours)

- [ ] 2.1 ExtensionLifecycle (1h)
  - [ ] File created: src/shared/lifecycle.ts
  - [ ] Abstract methods defined
  - [ ] Telemetry helpers added
  - [ ] Unit tests passing (5+)
  
- [ ] 2.2 PluginManager (2h)
  - [ ] File created: src/shared/plugin.ts
  - [ ] File created: src/shared/plugin-manager.ts
  - [ ] Register/unregister methods work
  - [ ] Hook execution functional
  - [ ] Unit tests passing (5+)

- [ ] 2.3 ContextMonitor (1.5h)
  - [ ] File copied & imports updated
  - [ ] Types merged into shared/types.ts
  - [ ] Unit tests passing (8+)
  - [ ] Integrated into SessionManager

- [ ] 2.4 ContextPruningPlugin (1.5h)
  - [ ] File copied & imports updated
  - [ ] All 8 pruning rules implemented
  - [ ] Snapshot tests passing (30+)
  - [ ] Integrated into SessionManager

- [ ] 2.5 ReadAwarenessPlugin (1h)
  - [ ] File copied & imports updated
  - [ ] Unit tests passing (8+)
  - [ ] Integrated into SessionManager

- [ ] 2.6 Telemetry Helpers (1h)
  - [ ] File created: src/shared/telemetry-helpers.ts
  - [ ] 4 helper functions implemented
  - [ ] Used in SessionManager & plugins
  - [ ] 40+ lines of boilerplate removed

- [ ] 2.7 SessionManager Refactor (2h)
  - [ ] Extends ExtensionLifecycle
  - [ ] Owns PluginManager
  - [ ] Uses telemetry-helpers
  - [ ] INJECTION_HANDLERS removed
  - [ ] All 85+ existing tests pass
  - [ ] 10+ new plugin tests added

- [ ] 2.8 Verify Tests (30 min)
  - [ ] npm test → 95+ passing
  - [ ] npm run build → No errors
  - [ ] npm run lint → No issues

## Sign-Off
- [ ] Code review approved
- [ ] All tests passing
- [ ] Documentation updated (code comments)
- [ ] Ready for Phase 3
```

---

## Next: After Phase 2 Complete

Once Phase 2 is done and tests are passing:

1. Create summary: "Phase 2 Complete: Core refactoring done, plugin system functional"
2. Update this document with status
3. **Start Phase 3: Automation** (6-8 hours)
   - Build AutomationManager
   - Implement 4 triggers
   - Create AutoRecapper, AutoCompactor
4. Continue through phases 4-7

---

## Final Words

**This is a well-planned, low-risk modernization.** We have:
- ✅ 75K words of documentation
- ✅ Copy-paste-ready code patterns
- ✅ Step-by-step execution guide
- ✅ Comprehensive test strategy
- ✅ Risk mitigation plan

**Just execute Phase 2, test thoroughly, and move on to Phase 3.**

Good luck! 🚀

---

**Document Status:** ✅ Quick Start Ready  
**Read Time:** 5 minutes  
**Action Time:** 8-10 hours (Phase 2)  
**Next:** INTEGRATION_SUMMARY.md → IMPLEMENTATION_ROADMAP.md
