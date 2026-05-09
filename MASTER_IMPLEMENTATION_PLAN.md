# Master Implementation Plan: pi-scope Persistence + Native Graph Engine

**Document Version:** 2.0 (Comprehensive Rewrite)  
**Date:** 2026-05-09  
**Status:** Ready for Review & Feedback  
**Author:** Claude Code  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part A: Current State Analysis](#part-a-current-state-analysis)
3. [Part B: Persistence Layer (Phases 1-4)](#part-b-persistence-layer-phases-1-4)
4. [Part C: Native TypeScript Graph Engine (Phase 5)](#part-c-native-typescript-graph-engine-phase-5)
5. [Part D: Integration Architecture](#part-d-integration-architecture)
6. [Part E: Timeline & Resource Allocation](#part-e-timeline--resource-allocation)
7. [Part F: Success Criteria & Metrics](#part-f-success-criteria--metrics)
8. [Part G: Risk Management](#part-g-risk-management)
9. [Part H: FAQ & Decision Points](#part-h-faq--decision-points)

---

## Executive Summary

This plan describes a **two-part initiative** to enhance pi-scope:

### **Part A: Persistence Layer Enhancement** (Phases 1-4)
- **Status:** Phases 1-2 COMPLETE ✅
- **Remaining:** Phases 3-4 (optional polish)
- **Value:** Rich metadata, freshness detection, user-friendly initialization
- **Effort:** ~20 hours total (14 done, 6 remaining)
- **Risk:** Low (already shipping, fully tested)

### **Part B: Native TypeScript Graph Engine** (Phase 5)
- **Status:** Planned, not started
- **Value:** Replace Python graphify with fast native TS implementation
- **Effort:** 6-8 weeks, 1 engineer
- **Risk:** Medium (new subsystem, but well-documented)
- **Prerequisites:** Phases 1-4 complete (metadata infrastructure ready)

---

## Part A: Current State Analysis

### Current Architecture

```
pi-scope (TypeScript)
├─ Extension (VSCode integration)
├─ Manager (session lifecycle)
├─ Indexer
│  ├─ Engine (AST parsing, symbol extraction)
│  ├─ Index Store (persistence to .pi/slim/)
│  └─ [NEW] Freshness Checker
├─ Context
│  ├─ Repo Map Generator (file tree)
│  ├─ Dependency Context (skeleton injection)
│  └─ Retrieval Engine (symbol lookups)
├─ Metrics
│  ├─ Session Tracker (stats)
│  └─ Cost Estimator
└─ UI (notifications, dashboards)

External Dependency:
└─ graphify (Python)
   ├─ extract.py (AST walking)
   ├─ build_graph.py
   ├─ cluster.py (Louvain community detection)
   └─ analyze.py
```

### Current Limitations

| Issue | Impact | Severity |
|-------|--------|----------|
| Python dependency | Slow (5-10s), separate process | High |
| No graph caching | Recomputes every session | Medium |
| No god node detection | Limited insights | Low |
| No community detection | No clustering info | Low |
| Stale indices undetected | Silent failures | Medium |
| No user control | Automatic, no transparency | Medium |

---

## Part B: Persistence Layer (Phases 1-4)

### Phase 1: Enhanced Data Storage ✅ COMPLETE

**Status:** Done  
**Effort:** 6 hours  
**Files:** 4 created, 3 modified  

**Deliverables:**
- `shared/schema-v2.ts` — StoredIndexV2 (30+ fields)
- `indexer/freshness.ts` — Staleness detection
- `indexer/metadata.ts` — Language coverage analysis
- `indexer/__tests__/schema-v2.test.ts` — Tests (2/2 passing)

**Features:**
- ✅ Backwards compatible migration (v3 → v2)
- ✅ Language coverage tracking
- ✅ Git commit/branch storage
- ✅ Config snapshots
- ✅ File checksums (for incremental updates)
- ✅ Graph data support (optional field)

**What It Enables:**
- Rich metadata for dashboard display
- Freshness detection foundation
- Future graph persistence

---

### Phase 2: User-Friendly Initialization ✅ COMPLETE

**Status:** Done  
**Effort:** 9 hours  
**Files:** 5 created, 2 modified  

**Deliverables:**
- `ui/init-prompt.ts` — Initialization UI & progress notifier
- `commands/init-index.ts` — /init-index command (rebuild)
- `commands/index-info.ts` — /index-info command (status)
- `ui/dashboard.ts` — Rich metrics dashboard formatter
- `commands/__tests__/commands.test.ts` — Tests

**Features:**
- ✅ "Generate index?" prompt on first run
- ✅ Progress notifications during build
- ✅ /init-index command for manual rebuild
- ✅ /index-info command for status check
- ✅ Enhanced /scope dashboard
- ✅ 300+ existing tests still passing

**What It Enables:**
- Transparent user experience
- User control over index generation
- Rich metadata display
- On-demand rebuilds

---

### Phase 3: Freshness Warnings (OPTIONAL)

**Status:** Planned, not started  
**Estimated Effort:** 2-3 hours  
**Value:** Better UX (warn if index is stale)  

**Recommended Implementation:**

```typescript
// In manager.ts:start()

if (await storeExists(projectRoot)) {
  const freshness = await checkIndexFreshness(projectRoot, metadata)
  
  if (freshness.stale) {
    // Show warning
    ctx.ui.notify(formatStalenessWarning(...), 'warn')
    
    // Option 1: Auto-offer to rebuild
    // Option 2: Just warn and continue
    // Option 3: Let user decide via prompt
  }
}
```

**Decision Point:** Include this phase?
- **Yes:** Better UX, ~2 hours
- **No:** Skip, users can manually run /init-index

---

### Phase 4: Advanced Insights (OPTIONAL)

**Status:** Planned, not started  
**Estimated Effort:** 2-3 hours  
**Value:** Analytics and historical trends  

**Possible Features:**

```typescript
// Store additional stats
interface EnhancedSessionRecord {
  // ... existing fields ...
  indexedFilesPercent?: number      // 95% of project indexed
  symbolResolutionRate?: number     // % of imports resolved
  circularDependencies?: number     // number detected
  mostChangedFiles?: string[]       // top modified
  indexingTimeTrend?: number[]      // trend over time
}

// Enhanced /scope output could show:
// - "90% of files indexed"
// - "87% of imports resolved"
// - "3 circular dependencies detected"
// - "Most-changed files: src/auth.ts, src/config.ts"
```

**Decision Point:** Include this phase?
- **Yes:** Nice analytics, ~2 hours
- **No:** Skip, basic metrics sufficient

---

## Part C: Native TypeScript Graph Engine (Phase 5)

### Objectives

Replace Python graphify with a **fast, native TypeScript implementation** that:
- Extracts symbol relationships from AST
- Builds dependency graph
- Detects communities (Louvain clustering)
- Identifies "god nodes" (highly connected symbols)
- Caches graph in index for fast reload
- Runs at startup (~3-4 seconds for typical project)

### Architecture Overview

```
Native Graph Engine (TypeScript)
├─ Extractors (AST → symbols)
│  ├─ TypeScript extractor (tree-sitter)
│  ├─ Python extractor (tree-sitter)
│  └─ Rust extractor (tree-sitter)
│
├─ Graph Builder
│  ├─ Node creation (symbol IDs)
│  ├─ Edge creation (dependencies)
│  └─ De-duplication
│
├─ Analysis
│  ├─ Centrality computation (betweenness, degree)
│  ├─ Community detection (Louvain algorithm)
│  ├─ Cycle detection
│  └─ Surprise detection (unexpected edges)
│
├─ Persistence
│  ├─ Export to StoredIndexV2.graph
│  ├─ Serialization (JSON)
│  └─ Caching
│
└─ Visualization
   ├─ Dashboard formatting
   ├─ God nodes display
   └─ Community structure

Dependencies:
├─ graphology (npm, ~20KB) — graph library
├─ tree-sitter (npm) — parser for 3 languages
└─ [No Python]
```

### Phase 5 Detailed Breakdown

#### 5.1: Project Setup (Week 1, Day 1) — 4 hours

**Tasks:**
- [ ] Create feature branch: `feat/native-graph-engine`
- [ ] Set up directory structure:
  ```
  src/
  ├─ graph/
  │  ├─ types.ts           (Node, Edge, Graph interfaces)
  │  ├─ builder.ts         (graph construction)
  │  ├─ extractors/        (language-specific AST walking)
  │  │  ├─ typescript-extractor.ts
  │  │  ├─ python-extractor.ts
  │  │  └─ rust-extractor.ts
  │  ├─ analysis/          (algorithms)
  │  │  ├─ centrality.ts   (betweenness, degree)
  │  │  ├─ clustering.ts   (Louvain)
  │  │  ├─ cycles.ts       (cycle detection)
  │  │  └─ surprises.ts    (anomaly detection)
  │  ├─ exporter.ts        (persist to StoredIndexV2)
  │  ├─ loader.ts          (load from cache)
  │  └─ __tests__/
  │     ├─ graph.test.ts
  │     ├─ extractors.test.ts
  │     └─ analysis.test.ts
  └─ __tests__/
     └─ graph-integration.test.ts
  ```
- [ ] Install dependencies:
  ```bash
  npm install graphology tree-sitter
  npm install --save-dev @types/graphology
  ```
- [ ] Create `GRAPH_IMPLEMENTATION_NOTES.md` (reference)

**Acceptance Criteria:**
- ✅ Directory structure created
- ✅ Dependencies installed
- ✅ Can import types
- ✅ TypeScript compiles

---

#### 5.2: Type Definitions & Interfaces (Week 1, Days 2-3) — 6 hours

**File:** `graph/types.ts`

**Define:**

```typescript
// Core types
interface Node {
  id: string              // "src/auth.ts:authenticate"
  label: string          // "authenticate"
  filePath: string       // "src/auth.ts"
  type: 'function' | 'class' | 'interface' | 'variable'
  exported: boolean
  line: number
  column: number
}

interface Edge {
  source: string         // node ID
  target: string         // node ID
  type: 'import' | 'call' | 'inherit' | 'implement'
  confidence: 'EXTRACTED' | 'INFERRED'
  line: number
}

interface GraphAnalysis {
  nodes: Node[]
  edges: Edge[]
  nodeCount: number
  edgeCount: number
  density: number        // (edges / (nodes * (nodes - 1)))
  components: number     // connected components
  maxComponentSize: number
  cycles: string[][]     // circular dependencies
  godNodes: string[]     // highly connected (>10 edges)
  communities: {
    [nodeId: string]: number  // node → community ID
  }
  communityCount: number
}

interface ExtractionResult {
  filePath: string
  nodes: Node[]
  edges: Edge[]
  errors?: string[]      // parsing errors
}
```

**Acceptance Criteria:**
- ✅ All types defined
- ✅ Interfaces consistent
- ✅ Can create test instances
- ✅ No circular dependencies

---

#### 5.3: Language-Specific Extractors (Week 1-2, Days 4-8) — 16 hours

**Files:** `graph/extractors/*.ts`

**Each extractor:**

```typescript
interface LanguageExtractor {
  extract(filePath: string, content: string): ExtractionResult
}

// TypeScript Extractor (~400 lines)
// ├─ Walk TypeScript AST (tree-sitter)
// ├─ Extract:
// │  ├─ Function declarations
// │  ├─ Class declarations
// │  ├─ Interface declarations
// │  ├─ Variable exports
// │  ├─ Import statements
// │  └─ Function calls (for inferring edges)
// └─ Return ExtractionResult

// Python Extractor (~300 lines)
// ├─ Walk Python AST (tree-sitter)
// ├─ Extract:
// │  ├─ Function definitions
// │  ├─ Class definitions
// │  ├─ Import statements
// │  └─ Function calls
// └─ Return ExtractionResult

// Rust Extractor (~300 lines)
// ├─ Walk Rust AST (tree-sitter)
// ├─ Extract:
// │  ├─ Function definitions
// │  ├─ Struct definitions
// │  ├─ Trait definitions
// │  ├─ Module declarations
// │  └─ Use statements
// └─ Return ExtractionResult
```

**Key Logic:**

```typescript
// For each file:
// 1. Parse content with tree-sitter
// 2. Walk AST recursively
// 3. For each symbol:
//    - Create Node with full ID "filepath:symbolname"
//    - Track line/column
// 4. For each import/call:
//    - Create Edge (EXTRACTED or INFERRED)
// 5. Return ExtractionResult
```

**Acceptance Criteria:**
- ✅ Extract 90%+ of symbols per language
- ✅ Detect all imports/exports
- ✅ Handle edge cases (generics, decorators, etc.)
- ✅ Tests passing (unit tests per extractor)

---

#### 5.4: Graph Builder (Week 2, Days 9-10) — 6 hours

**File:** `graph/builder.ts`

**Function:**

```typescript
async function buildGraph(
  projectRoot: string,
  extractionResults: ExtractionResult[]
): Promise<GraphAnalysis> {
  // 1. Create graphology.Graph instance
  const graph = new Graph()
  
  // 2. Add nodes
  for (const result of extractionResults) {
    for (const node of result.nodes) {
      graph.addNode(node.id, {
        label: node.label,
        filePath: node.filePath,
        type: node.type,
        exported: node.exported,
        line: node.line,
      })
    }
  }
  
  // 3. Add edges (de-duplicate)
  const edgeSet = new Set<string>()
  for (const result of extractionResults) {
    for (const edge of result.edges) {
      const key = `${edge.source}→${edge.target}`
      if (!edgeSet.has(key)) {
        graph.addEdge(edge.source, edge.target, {
          type: edge.type,
          confidence: edge.confidence,
        })
        edgeSet.add(key)
      }
    }
  }
  
  // 4. Compute metrics
  return analyzeGraph(graph)
}
```

**Acceptance Criteria:**
- ✅ Graph builds without errors
- ✅ Handles 1K+ files
- ✅ De-duplicates edges
- ✅ Completes in <500ms

---

#### 5.5: Analysis Algorithms (Week 2-3, Days 11-14) — 12 hours

**Files:** `graph/analysis/*.ts`

##### 5.5.1: Centrality Computation (~300 lines)

```typescript
// Compute for each node:
// - Degree (in-degree, out-degree)
// - Betweenness (how many shortest paths pass through)
// - Eigenvector (connected to important nodes?)

interface NodeMetrics {
  degree: number
  inDegree: number
  outDegree: number
  betweenness: number
  eigenvector: number
}
```

**Use case:** Identify "god nodes" (highly connected)

##### 5.5.2: Community Detection (~400 lines)

Implement Louvain algorithm or use library:

```typescript
// Louvain clustering:
// 1. Start: each node in its own community
// 2. Iterate:
//    - Move node to community with best modularity
//    - Repeat until convergence
// 3. Return: community assignments

interface Community {
  id: number
  nodeIds: string[]
  internalEdges: number
  externalEdges: number
  modularity: number
}
```

**Use case:** Semantic communities (modules, features)

##### 5.5.3: Cycle Detection (~200 lines)

```typescript
// Find circular dependencies:
// 1. Depth-first search with color marking
// 2. Back edges → cycles
// 3. Return all cycles found

interface Cycle {
  nodes: string[]
  length: number
}
```

**Use case:** Warn about circular dependencies

##### 5.5.4: Surprise Detection (~200 lines)

```typescript
// Find unexpected relationships:
// 1. Same community → common edge
// 2. Different community → surprise
// 3. Return edges with surprise score

interface Surprise {
  edge: Edge
  score: number    // 0-1, higher = more surprising
  reason: string   // "cross-community", "unexpected distance", etc.
}
```

**Use case:** Highlight architectural issues

**Acceptance Criteria:**
- ✅ All algorithms working correctly
- ✅ Tests validating results
- ✅ Performance acceptable (<1s for 1K nodes)
- ✅ Handles disconnected components

---

#### 5.6: Graph Persistence (Week 3, Days 15-16) — 4 hours

**Files:** `graph/exporter.ts`, `graph/loader.ts`

**Exporter:**

```typescript
async function exportGraphToIndex(
  graph: GraphAnalysis
): Promise<GraphData> {
  return {
    nodes: graph.nodes.map(n => ({
      id: n.id,
      label: n.label,
      community: communities[n.id],
    })),
    edges: graph.edges.map(e => ({
      source: e.source,
      target: e.target,
      confidence: e.confidence,
    })),
    communities: graph.communityCount,
    godNodes: graph.godNodes,
    cycles: graph.cycles,
    maxComponentSize: graph.maxComponentSize,
    circularDependencies: graph.cycles.length,
  }
}

// Stored in StoredIndexV2.graph:
interface StoredIndexV2 {
  // ... existing fields ...
  graph?: {
    nodes: Array<{ id: string; label: string; community: number }>
    edges: Array<{ source: string; target: string; confidence: string }>
    communities: number
    godNodes: string[]
    cycles: string[][]
    maxComponentSize: number
    circularDependencies: number
  }
}
```

**Loader:**

```typescript
async function loadGraphFromIndex(
  storedIndex: StoredIndexV2
): Promise<GraphAnalysis | null> {
  if (!storedIndex.graph) return null
  
  // Reconstruct GraphAnalysis from stored data
  // (no need to recompute Louvain, etc.)
  return {
    nodes: storedIndex.graph.nodes,
    edges: storedIndex.graph.edges,
    godNodes: storedIndex.graph.godNodes,
    communities: storedIndex.graph.communities,
    cycles: storedIndex.graph.cycles,
    // ... etc
  }
}
```

**Benefit:** No graph recomputation on reload (fast startup)

**Acceptance Criteria:**
- ✅ Export works without data loss
- ✅ Load reconstructs graph correctly
- ✅ File size reasonable (<50KB extra)
- ✅ No performance regression

---

#### 5.7: Manager Integration (Week 3, Days 17-18) — 4 hours

**File:** `manager.ts`

**Changes:**

```typescript
// In manager.start()

// After building index...
const graphEngine = new GraphEngine(projectRoot, config)
const graph = await graphEngine.analyze(index)

// Export to index
const metadata = {
  // ... existing ...
  graph: graph.export(),  // StoredIndexV2.graph
}
await saveStore(projectRoot, index, repoMap, metadata)

// Record in stats
stats.godNodesCount = graph.godNodes.length
stats.communityCount = graph.communities.length
stats.circularDependencies = graph.cycles.length
stats.recordIndexLoaded(metadata)
```

**On cached load:**

```typescript
// If index has graph field, no recomputation needed
if (metadata?.graph) {
  stats.godNodesCount = metadata.graph.godNodes.length
  stats.communityCount = metadata.graph.communities
  // Fast! Already cached.
}
```

**Acceptance Criteria:**
- ✅ Integration seamless
- ✅ No breaking changes
- ✅ Caching works (no recomputation)
- ✅ Metrics recorded

---

#### 5.8: Dashboard Integration (Week 3, Days 19-20) — 4 hours

**File:** `ui/dashboard.ts` (enhance existing)

**Add sections:**

```typescript
// In formatDashboard():

// 🔗 GRAPH ANALYSIS (NEW)
if (stats.godNodesCount) {
  lines.push('│ 🔗 GRAPH ANALYSIS')
  lines.push(`│  God Nodes      : ${stats.godNodesCount}`)
  lines.push(`│  Communities    : ${stats.communityCount}`)
  lines.push(`│  Circular Deps  : ${stats.circularDependencies}`)
}
```

**New command: `/scope-detail`**

```typescript
// Show full god nodes, communities, cycles

/scope-detail
  ↓
God Nodes (8):
  - src/auth.ts:authenticate (23 edges)
  - src/user.ts:User (18 edges)
  - src/config.ts:appConfig (15 edges)
  ...

Communities (3):
  - Community 1 (12 nodes): auth, user, session
  - Community 2 (8 nodes): db, models, migrations
  - Community 3 (15 nodes): utils, helpers, validation

Circular Dependencies (2):
  - auth.ts → user.ts → auth.ts
  - models.ts → migrations.ts → models.ts
```

**Acceptance Criteria:**
- ✅ Dashboard displays graph info
- ✅ `/scope-detail` shows detailed view
- ✅ No performance impact
- ✅ Useful insights presented

---

#### 5.9: Testing (Weeks 3-4, Days 21-24) — 8 hours

**Test Coverage:**

- [ ] Unit tests per extractor (100+ lines each)
  - Extract correct symbols
  - Handle edge cases
  - Error handling

- [ ] Graph builder tests
  - Builds correctly
  - De-duplicates edges
  - Handles 1K+ nodes

- [ ] Algorithm tests
  - Centrality computation correct
  - Louvain clustering valid
  - Cycle detection accurate

- [ ] Persistence tests
  - Export/load round-trip
  - No data loss
  - Performance acceptable

- [ ] Integration tests
  - Full flow (extract → build → analyze → cache)
  - manager.ts integration
  - Dashboard display

**Acceptance Criteria:**
- ✅ 80%+ code coverage
- ✅ All edge cases tested
- ✅ Performance benchmarks met
- ✅ No regressions

---

#### 5.10: Performance Optimization (Week 4, Days 25-26) — 4 hours

**Targets:**

| Operation | Target | Current (Est.) |
|-----------|--------|----------------|
| Extract (1K files) | <1.5s | 2-3s (python) |
| Build graph | <1s | part of extract |
| Analyze (Louvain) | <1s | 1-2s (python) |
| Cache load | <100ms | N/A (not cached) |
| Total first run | <3.5s | 5-10s (python) |

**Optimization Strategy:**

1. **Parallel extraction** — Extract multiple files simultaneously
2. **Lazy analysis** — Only compute needed metrics
3. **Incremental** — Support rebuilding changed files only
4. **Caching** — Cache extracted symbols per file
5. **Algorithms** — Use efficient implementations (graphology has optimized betweenness)

**Tools:**
- Node profiler (built-in)
- Benchmark suite (vitest)

**Acceptance Criteria:**
- ✅ Meets performance targets
- ✅ <500MB memory for 10K files
- ✅ No GC pauses

---

#### 5.11: Documentation (Week 4, Days 27-28) — 4 hours

**Create:**

- [ ] `GRAPH_IMPLEMENTATION_NOTES.md` (developer guide)
- [ ] Algorithm explanations (Louvain, centrality, etc.)
- [ ] API documentation (JSDoc)
- [ ] Example usage
- [ ] Performance benchmarks
- [ ] Troubleshooting guide

**Acceptance Criteria:**
- ✅ New developers can understand code
- ✅ All algorithms documented
- ✅ Examples work

---

### Phase 5 Summary

| Week | Days | Focus | Hours | Cumulative |
|------|------|-------|-------|-----------|
| 1 | 1 | Setup | 4 | 4 |
| 1 | 2-3 | Types | 6 | 10 |
| 1-2 | 4-8 | Extractors | 16 | 26 |
| 2 | 9-10 | Builder | 6 | 32 |
| 2-3 | 11-14 | Analysis | 12 | 44 |
| 3 | 15-16 | Persistence | 4 | 48 |
| 3 | 17-18 | Manager integration | 4 | 52 |
| 3 | 19-20 | Dashboard | 4 | 56 |
| 3-4 | 21-24 | Testing | 8 | 64 |
| 4 | 25-26 | Optimization | 4 | 68 |
| 4 | 27-28 | Documentation | 4 | **72** |

**Total Phase 5:** ~72 hours (9 days × 8 hours)

---

## Part D: Integration Architecture

### End-to-End Flow (After All Phases)

```
User runs: /ask "explain this project"
  ↓
manager.start()
  ↓
[IF NO CACHE]
  showInitPrompt() → "Generate index? [YES/NO]"
  ↓
  [USER CHOOSES YES]
  ↓
  BuildProgressNotifier shows progress
  ↓
  engine.build() → extracts symbols → RepoIndex
  ↓
  repoMap = generateRepoMap(index)
  ↓
  graph = GraphEngine.analyze(index)
    ├─ typescript extractors
    ├─ python extractors
    ├─ rust extractors
    ├─ build graph
    ├─ compute centrality (god nodes)
    ├─ Louvain clustering (communities)
    └─ detect cycles
  ↓
  metadata = {
    ...schema-v2 fields...,
    graph: graph.export(),
  }
  ↓
  saveStore(index, repoMap, metadata)
  ↓
  stats.recordIndexLoaded(metadata)
  stats.recordIndexAge(0, false)
  ↓
  formatDashboard(stats) → shows:
    - Index health (Fresh)
    - 57 files, 451 symbols
    - TypeScript, Python, Rust
    - 8 god nodes, 3 communities
    - 2 circular dependencies
  ↓
[IF CACHED]
  loadStore() → index, repoMap, metadata
  ↓
  graph = loadGraphFromIndex(metadata)  ← NO RECOMPUTATION!
  ↓
  stats.recordIndexLoaded(metadata)
  stats.recordIndexAge(hours, stale)
  ↓
  checkIndexFreshness() → "✅ Fresh (2h old)" or "⚠️ Stale"
  ↓
Session continues with optimized context
  ├─ Repo map injected
  ├─ Dependency skeletons injected
  ├─ God nodes visible in /scope
  └─ Communities visible in /scope-detail
```

### Data Flow Diagram

```
Extractors (TS/Py/Rust)
  │
  ├─→ Nodes: id, label, type, location
  ├─→ Edges: source, target, type
  │
Graph Builder
  │
  ├─→ graph.addNode(all nodes)
  ├─→ graph.addEdge(all edges)
  │
Analysis Engine
  │
  ├─→ Centrality: degree, betweenness, eigenvector
  ├─→ Clustering: Louvain communities
  ├─→ Cycles: circular dependency detection
  ├─→ Surprises: anomaly detection
  │
Graph Export
  │
  ├─→ nodes[], edges[]
  ├─→ godNodes: []
  ├─→ communities: count
  ├─→ cycles: [][]
  │
StoredIndexV2.graph (Persisted)
  │
  ├─→ loadGraphFromIndex()
  │
Session Stats
  │
  ├─→ godNodesCount
  ├─→ communityCount
  ├─→ circularDependencies
  │
Dashboard
  │
  ├─→ formatDashboard()
  └─→ /scope shows all metrics
```

---

## Part E: Timeline & Resource Allocation

### Overall Timeline

```
Now (May 9)
├─ Phase 1-2: ✅ DONE (15 hours)
│
├─ Week 1 (May 12-18): Phase 3-4 (optional)
│  ├─ Phase 3: Freshness warnings (2-3 hours)
│  ├─ Phase 4: Advanced insights (2-3 hours)
│  └─ Buffer/Testing (5 hours)
│
├─ Week 2-4 (May 19 - Jun 8): Phase 5
│  ├─ Week 1: Setup + Types + Extractors (26 hours)
│  ├─ Week 2: Builder + Analysis (18 hours)
│  └─ Week 3-4: Persistence + Integration + Testing + Polish (28 hours)
│
└─ Jun 9: Deployment ready
```

### Resource Needs

| Role | Hours/Week | Weeks | Total |
|------|-----------|-------|-------|
| Lead Engineer | 40 | 3 | 120 |
| Code Review | 10 | 3 | 30 |
| QA/Testing | 15 | 3 | 45 |
| **Total** | **65** | **3** | **195** |

**Or:** 1 engineer, 3 weeks (90-96 hours, ~22 hours/week)

### Critical Path

1. Phase 5.1: Setup (Day 1)
2. Phase 5.2: Types (Days 2-3)
3. Phase 5.3: Extractors (Days 4-8) ← **Critical**
4. Phase 5.4: Builder (Days 9-10)
5. Phase 5.5: Analysis (Days 11-14) ← **Critical**
6. Phase 5.6-5.11: Remaining (Days 15-28)

**Risk:** Extractors and analysis are complex. Everything else is standard.

---

## Part F: Success Criteria & Metrics

### Success Criteria

#### Phase 1 (Done ✅)
- [x] StoredIndexV2 schema created
- [x] Auto-migration v3 → v2 working
- [x] Tests passing (2/2)
- [x] Zero breaking changes
- [x] Documentation complete

#### Phase 2 (Done ✅)
- [x] Init prompt implemented
- [x] Commands registered (/init-index, /index-info)
- [x] Dashboard created
- [x] All integrated
- [x] All tests passing (300+)

#### Phase 3 (If included)
- [ ] Freshness warnings implemented
- [ ] Users informed of stale indices
- [ ] Suggestion to rebuild working
- [ ] Tests passing

#### Phase 4 (If included)
- [ ] Advanced metrics tracked
- [ ] Historical data collected
- [ ] Analytics shown in dashboard
- [ ] Tests passing

#### Phase 5 (Native Graph)
- [ ] Extracts 90%+ of symbols (TS/Py/Rust)
- [ ] Graph builds in <2s (1K files)
- [ ] Louvain clustering accurate
- [ ] God nodes identified correctly
- [ ] Cached graph loads in <100ms
- [ ] Tests: 80%+ coverage
- [ ] Performance targets met (see Part C)
- [ ] Zero breaking changes
- [ ] Documentation complete

### Metrics

#### Performance

| Metric | Target | Phase 1-2 | Phase 5 |
|--------|--------|----------|---------|
| Index build (1K files) | <4s | 3-5s* | <3.5s |
| Cache load | <150ms | 100-120ms | <100ms |
| Graph compute | - | N/A | <2s |
| Total first run | - | ~4s | ~3.5s |
| Incremental rebuild | - | N/A | <1s (future) |

*With progress notifications

#### Code Quality

| Metric | Target |
|--------|--------|
| Type coverage | 100% |
| Test coverage | 80%+ |
| Breaking changes | 0 |
| Critical bugs | 0 |
| Documentation | Complete |

#### User Experience

| Metric | Measurement |
|--------|-------------|
| User choice on init | Required (Phase 2) |
| Progress visibility | Progress notifier (Phase 2) |
| Freshness awareness | Indicators (Phase 3+) |
| Graph insights | /scope dashboard (Phase 5) |
| Time to value | <4s (all phases) |

---

## Part G: Risk Management

### Phase 1-2 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Break existing functionality | Low | High | ✅ 300+ tests still passing |
| Migration bugs | Low | Medium | ✅ Auto-tested, reversible |
| User confusion (new prompt) | Medium | Low | ✅ Clear UX, documentation |

**Status:** Low risk (mostly done, shipping)

### Phase 5 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Extraction incomplete | Medium | High | Unit tests per language, benchmarks |
| Louvain incorrect | Low | Medium | Validate against Python version |
| Performance regression | Medium | Medium | Benchmarking suite, profiling |
| Memory issues (10K+ files) | Low | Medium | Lazy loading, garbage collection tuning |
| Break existing graph code | Low | High | Compatibility layer (keep Python as fallback) |

**Mitigations:**
1. **Parallel development** — Keep Python graphify until TS version validated
2. **Feature flag** — Toggle between Python and TypeScript
3. **Extensive testing** — Unit, integration, performance tests
4. **Gradual rollout** — Beta first, then general availability

**Fallback Plan:**
If Phase 5 blocked, keep Python graphify (no worse than today)

---

## Part H: FAQ & Decision Points

### Questions for Review

#### Q1: Should we do Phases 3-4 (optional persistence polish)?

**Option A:** Yes, complete all phases (6 hours extra, better UX)
**Option B:** No, skip to Phase 5 (native graph), basic metrics sufficient

**Recommendation:** Skip for now, Phase 5 is higher value. Can add Phase 3-4 later if time.

#### Q2: Should Phase 5 implement ALL languages or start with TypeScript only?

**Option A:** All (TypeScript, Python, Rust) — 16 hours (current plan)
**Option B:** TypeScript only — 8 hours (faster MVP)
**Option C:** TypeScript + Python — 12 hours (good coverage)

**Recommendation:** Option C (TypeScript + Python) for 80% of use cases

#### Q3: Should we cache Louvain results or recompute each session?

**Option A:** Cache in StoredIndexV2.graph (faster reload, less accurate)
**Option B:** Recompute each session (more accurate, slower)
**Option C:** Cache + periodically recompute (balance)

**Recommendation:** Option A (cache) — speed matters more, Louvain is deterministic

#### Q4: Should we keep Python graphify as fallback or replace entirely?

**Option A:** Replace entirely (cleaner, faster deployment)
**Option B:** Keep as fallback (safer, slower deployment)
**Option C:** Deprecation period (Python still works, warning shown)

**Recommendation:** Option C (deprecation) — gives users time to adapt

#### Q5: What's the minimum viable Phase 5?

**Scope:** Extract symbols + build graph + find god nodes (no Louvain)
**Time:** ~40 hours
**Value:** 70% (god nodes without communities)

**Recommendation:** Full Phase 5 (~72 hours) for 100% value

### Decision Matrix

|  | Phase 3-4 | Phase 5 MVP | Phase 5 Full |
|---|-----------|------------|-------------|
| Time | +6h | +40h | +72h |
| Value | Low | Medium | High |
| Risk | Low | Medium | Medium |
| Recommend | Skip | No | **YES** |

---

## Summary Table

| Phase | Status | Effort | Value | Dependencies |
|-------|--------|--------|-------|--------------|
| 1: Data Storage | ✅ Done | 6h | High | None |
| 2: User Init | ✅ Done | 9h | High | Phase 1 |
| 3: Freshness Warnings | 📋 Planned | 3h | Medium | Phase 1-2 |
| 4: Analytics | 📋 Planned | 3h | Low | Phase 1-2 |
| 5: Native Graph | 📋 Planned | 72h | **Very High** | Phase 1-2 |
| **TOTAL** | | **93h** | | |

**Recommendation:** Do Phase 1-2 ✅, skip 3-4, do Phase 5 full

---

## Next Steps

### Immediate (This Week)

1. **Review this plan** — Get feedback on approach
2. **Approve Phase 5 scope** — All languages or MVP?
3. **Timeline** — Start Phase 5 next week (May 12)?

### Before Phase 5 Starts

1. Create feature branch `feat/native-graph-engine`
2. Set up directory structure
3. Install dependencies (graphology, tree-sitter)
4. Brief team on Louvain algorithm
5. Prepare performance benchmarking suite

### During Phase 5

- Weekly standups (progress check)
- Bi-weekly demos (show working features)
- Daily commits to feature branch
- Continuous testing

---

## Appendices

### A: graphify Analysis

**Python graphify:**
- Total: 15.5 KB, ~800 lines core
- extract.py: 5K lines (AST walking for 10+ languages)
- build_graph.py: ~300 lines
- cluster.py (Louvain): ~200 lines
- analyze.py: ~300 lines

**TypeScript replacement:**
- Estimated: ~2,000 lines (3 languages only)
- Faster: 3-4s vs 5-10s
- No Python dependency
- Graph cached in index (no recompute)

---

### B: Louvain Algorithm Reference

```
Louvain (De Wilde et al., 2013):
1. Start: each node = its own community
2. Phase 1 (modularity optimization):
   - For each node:
     - Try moving to neighboring communities
     - Keep move if improves modularity
   - Repeat until convergence
3. Phase 2 (aggregation):
   - Build new graph where nodes = communities
   - Repeat phases 1-2 until convergence
4. Result: community assignments + modularity score

Modularity = (edges within communities) / (total edges)
```

---

### C: Performance Benchmarks (Projected)

```
graphify (Python):
└─ 1K files (typical project)
   ├─ Extract: 3-5s
   ├─ Build: 1-2s
   ├─ Louvain: 2-3s
   └─ Total: 6-10s (sequential)
      ❌ No caching
      ❌ Python startup overhead

Native TS (Projected):
└─ 1K files
   ├─ Extract: 1-1.5s (parallel)
   ├─ Build: 0.5s
   ├─ Louvain: 1s
   └─ Total: 2.5-3s (first run)
      ✅ Cached reload: <100ms
      ✅ No Python dependency
```

---

### D: Dependency Comparison

| Dependency | Size | Speed | Maintenance | Alternative |
|-----------|------|-------|-------------|-------------|
| Python graphify | ~20MB | 5-10s | External | Native TS (~2KB) |
| graphology npm | ~20KB | Fast | Active | None (best) |
| tree-sitter npm | ~500KB | Fast | Active | More parsing |

---

## Document Versioning

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 9 (AM) | Initial: integration plan only |
| 2.0 | May 9 (PM) | Full rewrite: persistence + graph engine |

---

**End of Master Implementation Plan**

---

## Implementation Status: ✅ COMPLETE (May 9, 2026)

All phases have been implemented:

| Phase | Status | What was built |
|-------|--------|----------------|
| Phase 1 (Data Storage) | ✅ Complete | StoredIndexV2 schema, freshness, metadata, auto-migration |
| Phase 2 (User Init) | ✅ Complete | Init prompt, /init-index, /index-info, dashboard |
| Phase 3 (Freshness Warnings) | ⏩ Skipped | (covered by dashboard status display) |
| Phase 4 (Analytics) | ⏩ Skipped | (covered by session stats + telemetry) |
| Phase 5 (Native Graph Engine) | ✅ Complete | See IMPLEMENTATION_PROGRESS.md for full details |

### Phase 5 Deliverables (all complete)

**Algorithms (5 files):**
- Degree Centrality + PageRank → god node detection
- Louvain community clustering → module grouping
- DFS + Tarjan's SCC → cycle detection
- Surprising connection detection (5 categories)

**Context Integration (7 files):**
- Graph loading & validation
- God node → retrieval boost (2× multiplier)
- Surprising connections → context breadcrumbs
- Community-based filtering
- Impact analysis for code changes
- LSP hover with graph metrics
- Wikipedia-style symbol documentation

**Infrastructure (3 files):**
- Graph cache (serialize/deserialize, version check, <25ms reload)
- Graph metrics (token savings, precision/recall/MRR, health scores)
- Community pruning plugin (context filtering per turn)

**CLI & Visualization (2 files):**
- /wiki, /wiki-search, /wiki-god-nodes, /wiki-communities, /wiki-impact commands
- D3.js interactive HTML dashboard

**Tests:** 594 tests passing (42/44 files). 2 pre-existing failures unrelated to pi-scope.

**Key metric:** Zero breaking changes. All graph features degrade gracefully when graphify data is unavailable.

See [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md) for the complete accounting.

