# GraphIFY ↔ Wikipedia Integration Analysis

**Document:** Feature Analysis for Native Graph Engine  
**Date:** 2026-05-09  
**Purpose:** Identify existing features to leverage + new "wikipedia" features enabled by graphify  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part A: Features Existing in pi-scope Today](#part-a-features-existing-in-pi-scope-today)
3. [Part B: How Native GraphIFY Leverages Existing Features](#part-b-how-native-graphify-leverages-existing-features)
4. [Part C: New "Wikipedia" Features Enabled by GraphIFY](#part-c-new-wikipedia-features-enabled-by-graphify)
5. [Part D: Wikipedia Architecture](#part-d-wikipedia-architecture)
6. [Part E: Implementation Roadmap](#part-e-implementation-roadmap)
7. [Part F: Data Dictionary](#part-f-data-dictionary)

---

## Executive Summary

### Current Situation

pi-scope already has **powerful infrastructure** that native graphify can leverage:

```
Existing Features:
├─ RepoIndex (symbol extraction + dependency tracking)
├─ Index Store (persistence to .pi/slim/)
├─ Session Tracker (metrics & stats)
├─ Context Injector (what's relevant for LLM?)
├─ Retrieval Engine (find symbols by name)
└─ Repo Map (visual file tree)

Missing:
└─ Graph structure understanding (what we're adding)
```

### New Opportunity: "Wikipedia"

Once we have a graph, we unlock a **"wikipedia" subsystem** that:

```
Wikipedia = Living Documentation Database
├─ Auto-generated from code graph
├─ Symbols as "pages" (with relationships)
├─ Relationships as "links" (with context)
├─ Metrics as "info boxes" (god nodes, centrality)
├─ Anomalies as "notes" (circular deps, surprises)
└─ Searchable by structure (find symbols by role)
```

**Example:**
```
Wikipedia Entry: src/auth.ts:authenticate

SUMMARY
  Type: Function
  Exports: Yes
  Centrality: God Node (23 in-edges)
  Community: Auth Module
  
REFERENCES (What uses this?)
  ← src/user.ts:User (calls authenticate)
  ← src/session.ts:Session (calls authenticate)
  ← src/api.ts:POST /login (calls authenticate)

DEPENDENCIES (What does this use?)
  → src/utils.ts:validateJWT (calls)
  → src/db.ts:queryUser (calls)
  → src/config.ts:CONFIG (uses)

METRICS
  God Node: Yes (highly connected)
  Community: Auth Module (3 nodes)
  Surprising Connections: None
  Used By: 7 places

RELATED SYMBOLS
  Similar centrality: User class, Session class
  Same module: validatePassword, generateToken
  Same community: All auth symbols
```

---

## Part A: Features Existing in pi-scope Today

### A.1: RepoIndex (Symbol Extraction)

**What it does:**
```typescript
interface RepoIndex {
  skeletons: Map<string, string>       // file → AST skeleton
  deps: Map<string, Set<string>>       // file → files it imports
  reverseDeps: Map<string, Set<string>>// file → files that import it
  symbolIndex: Map<string, string[]>   // symbol → files containing it
}
```

**Current capabilities:**
- ✅ Extract symbols from files
- ✅ Track file-level dependencies
- ✅ Find symbols by name
- ❌ **Graph structure missing** (no symbol-to-symbol relationships)

**How graphify leverages this:**
- Takes RepoIndex as input
- Converts file-level deps → symbol-level deps
- Enriches with type information
- Builds graph on top

**Example:**
```
Current (file-level):
  src/auth.ts imports src/utils.ts ← coarse

New (symbol-level):
  src/auth.ts:authenticate imports src/utils.ts:validateJWT ← fine
```

### A.2: Index Store (Persistence)

**What it does:**
- Saves RepoIndex to `.pi/slim/index.json.gz` (gzip)
- Loads on next session
- Enables fast startups

**Current structure (v2):**
```typescript
interface StoredIndexV2 {
  skeletons, deps, reverseDeps, symbolIndex,  // from RepoIndex
  graph?: {...}                              // [NEW] graphify data
}
```

**How graphify leverages this:**
```typescript
// After building graph, export it:
const graphData = {
  nodes: graph.nodes,      // symbols
  edges: graph.edges,      // relationships
  godNodes: [...],         // highly connected
  communities: {...},      // clusters
  cycles: [...]            // circular deps
}

// Store in index:
await saveStore(index, repoMap, {
  ...metadata,
  graph: graphData         // cached!
})

// On next session:
const graph = loadGraphFromIndex(metadata)
// ← NO RECOMPUTATION!
```

### A.3: Session Tracker (Metrics)

**What it does:**
```typescript
class SessionStats {
  indexedFiles: number
  symbolCount: number        // [PHASE 1]
  depEdges: number
  
  // [PHASE 2]
  godNodesCount?: number
  communityCount?: number
  circularDependencies?: number
}
```

**Current capabilities:**
- ✅ Track what was indexed
- ✅ Count files & symbols
- ✅ Count dependencies
- ❌ **No graph metrics** (god nodes, communities)

**How graphify leverages this:**
```typescript
// graphify fills in these fields:
stats.godNodesCount = graph.godNodes.length
stats.communityCount = graph.communities.length
stats.circularDependencies = graph.cycles.length
stats.symbolCount = graph.nodeCount
```

### A.4: Context Injector (Relevance)

**What it does:**
```typescript
class ContextInjector {
  // Given: file paths mentioned by user
  // Returns: which OTHER files are relevant?
  
  findRelevantFiles(mentionedPaths: string[]): string[]
}
```

**Current logic:**
```
For mentioned file:
  1. Get direct imports (deps)
  2. Get files that import it (reverseDeps)
  3. Get transitive dependencies (2-3 hops)
  4. Return most relevant
```

**How graphify leverages this:**
```
Old (file-level):
  User mentions: src/auth.ts
  Context: [src/utils.ts, src/db.ts] (files it imports)

New (symbol-level):
  User mentions: src/auth.ts:authenticate
  Context:
    - Direct: [validateJWT, queryUser, CONFIG] (symbols it uses)
    - Callers: [User class, Session class, API handler] (symbols calling it)
    - Community: [validatePassword, generateToken] (same module)
    - Similar: [User class, Session class] (similar centrality)
```

### A.5: Retrieval Engine (Symbol Lookup)

**What it does:**
```typescript
class RetrievalEngine {
  // Find symbols by name
  findSymbols(name: string): Symbol[]
  
  // Find symbols used by file
  getSymbolsIn(filePath: string): Symbol[]
}
```

**Current capabilities:**
- ✅ Lookup symbols by name
- ✅ Get symbols in a file
- ❌ **No relationship queries** (what calls X? what does X call?)

**How graphify leverages this:**
```typescript
// Extend RetrievalEngine:

findCallers(symbolId: string): Symbol[] {
  // In graph: who has edges pointing to symbolId?
  return graph.getInboundNeighbors(symbolId)
}

findCalls(symbolId: string): Symbol[] {
  // In graph: who does symbolId point to?
  return graph.getOutboundNeighbors(symbolId)
}

findSimilarSymbols(symbolId: string): Symbol[] {
  // In graph: who has similar centrality/community?
  return graph.getSymbolsByMetrics(...)
}
```

### A.6: Repo Map (Visual Tree)

**What it does:**
```
src/
├─ auth/
│  ├─ authenticate.ts
│  ├─ validate.ts
│  └─ types.ts
├─ user/
│  ├─ User.ts
│  └─ models.ts
└─ db/
   ├─ connection.ts
   └─ queries.ts
```

**Current capabilities:**
- ✅ Show file structure
- ❌ **No symbol structure within files**

**How graphify leverages this:**
```
New: Symbol tree view (in Wikipedia)

src/auth/authenticate.ts
├─ authenticate() [GOD NODE]
│  ├─ uses: validateJWT, queryUser
│  ├─ called by: User class, Session class
│  └─ community: Auth Module
├─ validatePassword()
│  ├─ uses: bcrypt
│  └─ called by: authenticate
└─ generateToken()
   ├─ uses: jwt
   └─ called by: authenticate

[Shows relationship structure at symbol level]
```

---

## Part B: How Native GraphIFY Leverages Existing Features

### B.1: Input Pipeline

```
Files (source code)
  ↓
Extract symbols (RepoIndex)
  ├─ Get: file → symbols
  ├─ Get: file → file dependencies
  ├─ Index by name
  └─ RepoIndex ready
  ↓
[GraphIFY Input]
  ├─ Input 1: RepoIndex.skeletons (AST)
  ├─ Input 2: RepoIndex.deps (file deps)
  └─ Input 3: RepoIndex.symbolIndex (symbol names)
```

### B.2: Core GraphIFY Logic

```
Convert file-level to symbol-level:
  RepoIndex.deps (file → file)
    ↓
  GraphIFY.extractors (find symbol references)
    ↓
  Graph.edges (symbol → symbol)
```

### B.3: Output Pipeline

```
Graph (nodes + edges)
  ↓
Analyze (centrality, communities, cycles)
  ↓
Export GraphData
  ├─ nodes: Symbol[]
  ├─ edges: Relationship[]
  ├─ godNodes: Symbol[]
  ├─ communities: Cluster[]
  └─ cycles: Path[][]
  ↓
Store in StoredIndexV2.graph
  ↓
SessionStats updated
  ├─ godNodesCount
  ├─ communityCount
  ├─ circularDependencies
  └─ symbolCount
  ↓
Dashboard displays
  ├─ /scope (overview)
  ├─ /scope-detail (full graph)
  └─ /wikipedia (new!)
```

### B.4: Caching Architecture

```
Session 1:
  Files → RepoIndex → GraphIFY → Graph Analysis
  ↓
  Save to StoredIndexV2
  ├─ skeletons (RepoIndex)
  ├─ deps (RepoIndex)
  └─ graph (GraphIFY output) ← CACHED
  ↓

Session 2:
  Load from StoredIndexV2
  ├─ RepoIndex restored ✅
  ├─ Graph restored ✅ (NO RECOMPUTATION!)
  └─ Metrics available immediately
```

---

## Part C: New "Wikipedia" Features Enabled by GraphIFY

### C.1: What is "Wikipedia"?

**Definition:**
```
Wikipedia = Living documentation system powered by code graph

Characteristics:
├─ Auto-generated (from graph, not manual)
├─ Always in sync (updates with code)
├─ Structured (organized by relationships)
├─ Searchable (find by symbol, role, metric)
├─ Contextual (shows why/how things connect)
├─ Intelligent (uses graph metrics)
└─ LLM-aware (optimized for context injection)
```

**Analogy:**
```
Traditional Wikipedia:
  Article: "Authentication in Web Apps"
  Links: Password hashing, JWT, OAuth
  Info box: Created 2020, edited 100 times

Code Wikipedia:
  Article: "authenticate() function"
  Links: validateJWT, queryUser, Config
  Info box: Centrality: 23 edges, Community: Auth
```

### C.2: Core Wikipedia Features

#### C.2.1: Symbol Pages

```
GET /wikipedia/src/auth.ts:authenticate

Response:
{
  id: "src/auth.ts:authenticate",
  label: "authenticate",
  type: "function",
  
  SUMMARY:
  {
    description: "Validates user credentials and returns JWT token",
    location: "src/auth.ts:42-68",
    exports: true,
    
    METRICS: {
      centrality: {
        degree: 23,
        inDegree: 12,        // 12 places call this
        outDegree: 11,       // calls 11 other things
        betweenness: 0.87    // important hub
      },
      classification: "god_node",  // highly connected
      community: "auth_module",     // which cluster?
      role: "public_api"            // exported, heavily used
    }
  },
  
  INBOUND:
  {
    // Things that call this function
    callers: [
      { id: "src/user.ts:User.constructor", count: 3, type: "class_method" },
      { id: "src/session.ts:Session.login", count: 2, type: "function" },
      { id: "src/api.ts:POST_login", count: 1, type: "api_handler" }
    ]
  },
  
  OUTBOUND:
  {
    // Things this function calls/uses
    dependencies: [
      { id: "src/utils.ts:validateJWT", type: "function_call" },
      { id: "src/db.ts:queryUser", type: "function_call" },
      { id: "src/config.ts:CONFIG", type: "variable_access" }
    ]
  },
  
  COMMUNITY:
  {
    id: "auth_module",
    members: [
      "src/auth.ts:authenticate",
      "src/auth.ts:validatePassword",
      "src/auth.ts:generateToken",
      "src/auth.ts:refreshToken"
    ],
    internalEdges: 8,
    externalEdges: 23  // many connections out
  },
  
  ANOMALIES:
  {
    circular_dependencies: [],
    surprising_connections: [
      {
        target: "src/admin.ts:checkPermission",
        surprise_score: 0.8,
        reason: "different_community"
      }
    ]
  },
  
  RELATED:
  {
    similar_centrality: [
      "src/user.ts:User.constructor",
      "src/session.ts:Session.login"
    ],
    same_module: [
      "src/auth.ts:validatePassword",
      "src/auth.ts:generateToken"
    ]
  },
  
  USAGE:
  {
    export_percentage: 100,  // all usages are external
    test_coverage: true,
    documentation: "Missing JSDoc comment"
  }
}
```

#### C.2.2: Community Pages

```
GET /wikipedia/community/auth_module

Response:
{
  id: "auth_module",
  name: "Authentication Module",
  
  MEMBERS: [
    { id: "src/auth.ts:authenticate", centrality: 23 },
    { id: "src/auth.ts:validatePassword", centrality: 8 },
    { id: "src/auth.ts:generateToken", centrality: 7 },
    { id: "src/auth.ts:refreshToken", centrality: 5 }
  ],
  
  INTERNAL_EDGES: 8,      // connections within module
  EXTERNAL_EDGES: 23,     // connections to other modules
  
  INTERFACES: {
    inbound: [
      "src/api.ts (7 calls)",
      "src/user.ts (5 calls)",
      "src/session.ts (4 calls)"
    ],
    outbound: [
      "src/db.ts (querying users)",
      "src/utils.ts (validation helpers)",
      "src/config.ts (JWT secrets)"
    ]
  },
  
  COHESION: 0.75,  // 0-1, how tightly coupled?
  
  PURPOSE: "Handle user authentication and token generation"
}
```

#### C.2.3: Anomaly Pages

```
GET /wikipedia/anomalies

Response:
{
  circular_dependencies: [
    {
      path: ["src/models.ts", "src/migrations.ts", "src/models.ts"],
      severity: "warning",
      affected_symbols: 12
    }
  ],
  
  god_nodes: [
    { id: "src/auth.ts:authenticate", edges: 23, description: "Too central" },
    { id: "src/user.ts:User", edges: 19, description: "Too central" },
    { id: "src/config.ts:CONFIG", edges: 18, description: "Too central" }
  ],
  
  surprising_connections: [
    {
      from: "src/auth.ts:authenticate",
      to: "src/admin.ts:checkPermission",
      score: 0.8,
      reason: "different_communities"
    }
  ],
  
  isolated_symbols: [
    "src/utils.ts:unsedHelper1",
    "src/utils.ts:unsedHelper2"
  ]
}
```

#### C.2.4: Role-Based Pages

```
GET /wikipedia/roles

Response:
{
  god_nodes: [
    "src/auth.ts:authenticate",
    "src/user.ts:User",
    "src/config.ts:CONFIG"
  ],
  
  hub_nodes: [
    // Connected to multiple modules
  ],
  
  leaf_nodes: [
    // Called but don't call others
  ],
  
  boundary_symbols: [
    // Exported public API
  ],
  
  internal_only: [
    // Never exported
  ]
}
```

### C.3: Wikipedia Queries (Search/Filter)

```
GET /wikipedia/search?
  - name: "authenticate"           // symbol name
  - community: "auth_module"       // cluster
  - min_centrality: 5              // at least 5 connections
  - type: "function"               // symbol type
  - has_tests: true                // test coverage
  - exported: true                 // public API
  - anomaly: "circular_dep"        // part of cycle

Response: Matching symbols with metadata
```

### C.4: Integration with Context Injection

**Current flow:**
```
User: /ask "How do I authenticate?"
  ↓
ContextInjector.findRelevant(["auth"])
  ↓
Returns: [src/auth.ts, src/utils.ts]
  ↓
Inject files into context
```

**New flow with Wikipedia:**
```
User: /ask "How do I authenticate?"
  ↓
ContextInjector.findRelevant(["auth"])
  ↓
GraphIFY enriches with:
  ├─ Related symbols (authenticate, validatePassword)
  ├─ God nodes in auth community
  ├─ Anomalies (circular deps?)
  ├─ External interfaces (who calls what?)
  └─ Community structure
  ↓
Wikipedia pages generated inline
  ├─ "authenticate() function"
  ├─ "Auth Module cluster"
  ├─ "User.constructor (related god node)"
  └─ "Anomalies (if any)"
  ↓
Inject enriched context
```

**Example injected context:**
```
<wikipedia>
  <symbol id="src/auth.ts:authenticate">
    <type>function</type>
    <centrality>god_node</centrality>
    <community>auth_module</community>
    <description>Main authentication entry point</description>
    <callers>
      - User.constructor (3 calls)
      - Session.login (2 calls)
      - POST /login handler (1 call)
    </callers>
    <dependencies>
      - validateJWT (validation)
      - queryUser (database)
      - CONFIG (JWT secret)
    </dependencies>
  </symbol>
  
  <community id="auth_module">
    <members>authenticate, validatePassword, generateToken, refreshToken</members>
    <size>4 symbols</size>
    <cohesion>0.75</cohesion>
    <external_interfaces>
      - api.ts (7 calls)
      - user.ts (5 calls)
    </external_interfaces>
  </community>
</wikipedia>
```

---

## Part D: Wikipedia Architecture

### D.1: Data Model

```typescript
interface WikipediaSymbol {
  id: string                    // "src/auth.ts:authenticate"
  label: string                 // "authenticate"
  type: SymbolType              // function, class, interface, variable
  
  // Metrics from graph
  metrics: {
    centrality: CentralityMetrics
    classification: "god_node" | "hub" | "leaf" | "bridge"
    community: string           // which cluster?
    role: "public_api" | "internal" | "utility"
  }
  
  // Relationships
  inbound: {
    callers: SymbolRef[]        // what calls this?
    readers: SymbolRef[]        // what reads this variable?
  }
  
  outbound: {
    callees: SymbolRef[]        // what does this call?
    dependencies: SymbolRef[]   // what does it depend on?
  }
  
  // Context
  community: CommunityInfo
  related: {
    similar: string[]           // similar centrality
    same_module: string[]       // same file/module
  }
  
  // Quality
  anomalies: {
    circular_dependencies: Path[]
    surprising_connections: Surprise[]
    coverage: TestCoverage
  }
  
  // Source info
  location: {
    filePath: string
    line: number
    column: number
  }
}

interface WikipediaCommunity {
  id: string
  members: string[]             // symbol IDs
  edges_internal: number
  edges_external: number
  cohesion: number              // 0-1
  purpose?: string              // inferred description
  interfaces: {
    inbound: ModuleRef[]
    outbound: ModuleRef[]
  }
}
```

### D.2: Storage

```
Wikipedia data is derived (not stored separately):
  Source: StoredIndexV2 (index.json.gz)
           ├─ skeletons (RepoIndex)
           ├─ deps (RepoIndex)
           └─ graph (GraphIFY)
  
  Derived: Wikipedia pages
           ├─ Generated on-demand OR
           ├─ Cached in session memory
           └─ Serialized to session stats

Real-time generation:
  Wikipedia page = Query graph + apply metrics
                 = O(1) to O(k) where k = node degree
```

### D.3: Querying

```typescript
// Interface
interface WikipediaDB {
  // Symbol pages
  getSymbol(id: string): WikipediaSymbol
  searchSymbols(query: SymbolQuery): WikipediaSymbol[]
  getSymbolsInCommunity(communityId: string): WikipediaSymbol[]
  
  // Community pages
  getCommunity(id: string): WikipediaCommunity
  getAllCommunities(): WikipediaCommunity[]
  
  // Anomaly pages
  getAnomalies(): AnomalyReport
  getCircularDeps(): Cycle[]
  getGodNodes(): WikipediaSymbol[]
  getSurprises(): Surprise[]
}

// Implementation: backed by graph
class WikipediaDB {
  constructor(private graph: GraphAnalysis) {}
  
  getSymbol(id: string): WikipediaSymbol {
    const node = this.graph.getNode(id)
    const inbound = this.graph.getInboundEdges(id)
    const outbound = this.graph.getOutboundEdges(id)
    const community = this.graph.getNodeCommunity(id)
    
    return {
      id,
      label: node.label,
      type: node.type,
      metrics: {
        centrality: this.computeCentrality(id),
        classification: this.classify(id),
        community,
        role: this.inferRole(id)
      },
      inbound: { callers: inbound },
      outbound: { callees: outbound },
      ...
    }
  }
}
```

---

## Part E: Implementation Roadmap

### Phase 5A: Core Wikipedia (Week 3, Days 19-20)

**After Phase 5.8 (Dashboard Integration)**

**Tasks:**
- [ ] Create `wikipedia/types.ts` (data models)
- [ ] Create `wikipedia/db.ts` (query engine)
- [ ] Create `wikipedia/formatter.ts` (display)
- [ ] Integrate with manager.ts
- [ ] Add `/wikipedia` command
- [ ] Add `/wiki-search` command

**Effort:** 4-6 hours

**Output:**
```
/wikipedia src/auth.ts:authenticate
  ↓
Displays symbol page in terminal/UI
```

### Phase 5B: Enhanced Context Injection (Week 4, Days 21-24)

**Integrated with Phase 5.9 (Testing)**

**Tasks:**
- [ ] Enhance ContextInjector with graph awareness
- [ ] Inline Wikipedia snippets in context
- [ ] Test with sample projects

**Effort:** 2-3 hours

**Output:**
```
/ask "How does auth work?"
  ↓
Returns answer with
  - authenticate() function page
  - Auth module community info
  - God node warnings
```

### Phase 5C: Wikipedia Search (Week 4, Days 25-26)

**During Phase 5.10 (Optimization)**

**Tasks:**
- [ ] Implement `/wiki-search` command
- [ ] Support queries: name, community, role, centrality
- [ ] Fuzzy matching for symbol names

**Effort:** 2-3 hours

**Output:**
```
/wiki-search god_nodes auth_module
  ↓
Lists all god nodes in auth community
```

---

## Part F: Data Dictionary

### F.1: What Wikipedia Stores/Computes

| Data | Computed From | Used For | Cached? |
|------|---------------|----------|---------|
| Symbol metadata | Graph nodes | Symbol pages | No (O(1) lookup) |
| Callers/callees | Graph edges | Relationship view | No (O(k) traversal) |
| Centrality metrics | Graph structure | God node identification | Yes (in graph) |
| Communities | Louvain algorithm | Community pages | Yes (in graph) |
| Anomalies | Graph analysis | Anomaly detection | Yes (in graph) |
| Similar symbols | Metrics comparison | Related symbols | No (computed) |

### F.2: Wikipedia vs RepoIndex vs Graph

```
RepoIndex (file-level):
  - "src/auth.ts imports src/utils.ts"
  - File-level dependencies
  - Symbol names

Graph (symbol-level):
  - "authenticate() calls validateJWT()"
  - Symbol relationships
  - Metrics (centrality, communities)

Wikipedia (enriched):
  - "authenticate() is a god node"
  - "authenticate() is in auth_module"
  - "authenticate() is called by User.constructor"
  - Contextual information
  - Search interface
```

### F.3: Wikipedia Enabling New Queries

**Impossible before GraphIFY:**
- "What are the god nodes?" (need centrality)
- "What's in the auth module?" (need communities)
- "Who calls authenticate()?" (need symbol edges)
- "Are there circular dependencies?" (need graph)

**Enabled by Wikipedia:**
- All of the above, plus:
- "Show me all functions similar to User.constructor"
- "Find symbols not covered by tests"
- "Show unexpected connections across communities"
- "What's the most important symbol in the codebase?"

---

## Summary: Integration Points

### Leveraged Features

| Feature | How GraphIFY Uses It | Enhanced Output |
|---------|-------------------|-----------------|
| RepoIndex | Input for extractors | Symbol-level graph |
| Index Store | Cache storage | Persisted graph data |
| Session Stats | Metrics collection | Graph metrics |
| Context Injector | Find relevant code | Wikipedia-enriched context |
| Retrieval Engine | Symbol lookup | Graph-aware queries |
| Repo Map | File tree | Symbol tree |

### New "Wikipedia" Capabilities

| Capability | Enabled By | Value |
|-----------|-----------|-------|
| Symbol pages | Graph nodes + edges | Self-documenting |
| Community pages | Louvain clustering | Understand architecture |
| Anomaly pages | Cycle detection | Detect issues |
| Role classification | Centrality metrics | Understand impact |
| Smart context | Graph relationships | LLM gets better info |
| Advanced search | All of above | Find anything structurally |

---

## Recommendation

### Implement Wikipedia in Phases:

**Phase 5A (Week 3, Days 19-20): 4-6 hours**
- Core Wikipedia pages
- `/wikipedia` command
- Basic symbol/community/anomaly pages

**Phase 5B (Week 4, Days 21-24): 2-3 hours**
- Integrate with context injection
- Inline Wikipedia in LLM context

**Phase 5C (Week 4, Days 25-26): 2-3 hours**
- Search interface
- Fuzzy matching

**Total:** 8-12 hours (built into Phase 5 timeline)

---

## Decision for You

Should we:

**Option A: Full Wikipedia** (8-12 hours)
- Symbol pages
- Community pages
- Anomaly pages
- Search interface
- Context injection integration

**Option B: Minimal Wikipedia** (4-6 hours)
- Symbol pages only
- `/wikipedia` command
- Skip search/integration

**Option C: Skip Wikipedia** (0 hours)
- Just have the graph
- Users access graph metrics via `/scope`

**Recommendation:** **Option A (Full Wikipedia)**
- Only 8-12 hours on top of Phase 5
- Massive value: makes graph discoverable
- Enables new capabilities for LLM
- Self-documenting codebase

