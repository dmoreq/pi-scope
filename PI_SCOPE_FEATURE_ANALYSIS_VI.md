# Báo Cáo Phân Tích Toàn Diện: pi-scope — Tính Năng & Hệ Thống Thông Báo

> **Phiên bản phân tích:** dựa trên codebase hiện tại (v0.9.0)  
> **Ngôn ngữ báo cáo:** Tiếng Việt  
> **Mục tiêu:** Đánh giá toàn bộ các tính năng, các thông điệp (messages) hiện có, và đề xuất thêm thông điệp để chứng minh pi-scope đang hoạt động tốt và mang lại giá trị thực sự.

---

## I. Tổng Quan Kiến Trúc

pi-scope là một **extension thông minh** dành cho AI coding assistant (Claude, etc.), hoạt động như một lớp context-injection nằm giữa codebase và AI. Nó không chỉ "đọc code" mà còn **phân tích cấu trúc đồ thị** (graph analysis) của toàn bộ codebase để:

1. **Nén context thông minh** — chỉ inject những file/symbol thực sự cần thiết thay vì gửi toàn bộ code
2. **Cảnh báo rủi ro** — phát hiện god nodes, circular deps, bottlenecks trước khi AI sửa code
3. **Hướng dẫn tool usage** — steers AI dùng đúng tool (LSP, hashline) thay vì grep/read thủ công
4. **Tiết kiệm token** — đo lường và báo cáo lượng token tiết kiệm được mỗi session

### Luồng Chính (High-Level Flow)

```
User opens project
       ↓
[start()] → IndexService builds index (files, symbols, deps)
       ↓
       → GraphService analyzes index (god nodes, communities, cycles, surprises)
       ↓
       → Plugins registered (CommunityPruning, GraphSteer, LspSteer, HashlineSteer, HashlineValidate)
       ↓
Per-turn: handleBeforeAgentStart() → inject system prompt (repo map, graph insights, intelligence, tools block)
       ↓
Per-turn: handleContext() → inject dep-context (key files + deps + hashline anchors)
       ↓
       → Plugins run: steer tool calls, prune old context, warn about cycles
       ↓
[shutdown()] → persist stats, notify token savings summary
```

---

## II. Phân Tích Chi Tiết Từng Tính Năng & Thông Điệp

### 📌 Feature 1: Session Startup — Indexing & Graph Loading

**Mô tả:** Khi session bắt đầu, pi-scope tự động quét toàn bộ codebase, build index (hoặc load từ cache), và chạy graph analysis.

#### Thông điệp hiện có:

| Tình huống | Message | Level |
|-----------|---------|-------|
| Load từ cache thành công | `[scope] ✓ Loaded {N} files from cache` | success ✅ |
| Build index mới | `[scope] Building index...` | info ℹ️ |
| Build xong | `[scope] ✓ Indexed {N} files in {T}s` | success ✅ |
| Cache bị stale | `[scope] ⚠ Cached index stale, rebuilding ({reasons})` | warning ⚠️ |
| Lỗi build | `[scope] ✗ Error: {message}` | error ❌ |
| Graph analysis xong | `[scope] Graph: {N} nodes, {M} edges, {K} communities` | info ℹ️ |
| Graph quality cao (≥80) | `[scope] Graph quality {score}/100 · {analysis}[· N cycles]` | info ℹ️ |
| Graph quality thấp | `[scope] ⚠ Graph quality {score}/100 · {analysis}` | warning ⚠️ |
| LSP không available | `[scope] ⚠ {installSuggestion}` | warning ⚠️ |
| LSP OK + có circular deps | Log to console: `[pi-scope] Graph: {N} circular dependencies detected` | console.warn |

#### Phân tích:
- ✅ Tốt: User biết ngay khi index xong và graph được load
- ✅ Tốt: Phân biệt rõ cache hit vs fresh build
- ⚠️ Thiếu: Không có thông báo khi graph analysis **bắt đầu** (chỉ có khi xong) — với codebase lớn, có thể user không biết đang chờ gì

---

### 📌 Feature 2: Status Bar (Thanh trạng thái realtime)

**Mô tả:** `SmartCtx` entry trên status bar hiển thị live stats mỗi lần context được inject.

#### Format:
```
SmartCtx: {N} files | map ~{M}t | {K} inj | {ctx} ctx | {guid} guid | {C} comm | Q{score} | saved ~{S}t
```

#### Các thành phần:

| Field | Ý nghĩa | Hiển thị khi nào |
|-------|---------|-----------------|
| `{N} files` | Số file đã index | indexedFiles > 0 |
| `map ~{M}t` | Token của repo map | repoMapTokens > 0 |
| `{K} inj` | Số lần dep-context được inject session này | depContextTriggers > 0 |
| `{ctx} ctx` | Số context files (AGENTS.local.md) | > 0 |
| `{guid} guid` | Số provider guidance files | > 0 |
| `{C} comm` | Số graph communities | > 1 |
| `Q{score}` | Graph quality score 0–100 | luôn hiển thị khi graph loaded |
| `saved ~{S}t` | Token đã tiết kiệm | totalTokensSaved > 0 |

#### Phân tích:
- ✅ Rất compact, cung cấp overview nhanh
- ⚠️ Thiếu: Không hiển thị số god nodes (quan trọng để biết độ phức tạp codebase)
- ⚠️ Thiếu: Không có indicator khi đang reindex (user không biết PI đang "bận")

---

### 📌 Feature 3: Dashboard `/scope` — Bảng điều khiển trong session

**Mô tả:** User gõ `/scope` để xem full dashboard. Đây là feature **trực tiếp nhất** để user thấy pi-scope đang làm gì.

#### Cấu trúc dashboard hiện tại:

```
┌──── pi-scope Session Dashboard ─────────────────────────┐
│ 📇 INDEX                                                 │
│   Source          : Cached / Fresh build                 │
│   Files           : {N}                                  │
│   Symbols         : {N}                                  │
│   Dependencies    : {N}                                  │
│   Dep depth       : {0-3}                               │
│ ⏱️  SESSION                                               │
│   Duration        : {T}                                  │
│   Index load      : {N}ms                               │
│   Index stale     : yes/no                              │
│ 📊 GRAPH ANALYSIS                                        │
│   Nodes / Edges   : {N} / {M}                           │
│   God Nodes       : {N}                                  │
│   Communities     : {N}                                  │
│   Circular Deps   : {N}                                  │
│   Bottlenecks     : {N}                                  │
│   Surprises       : {N}                                  │
│ 📈 GRAPH QUALITY                                         │
│   Score           : {N}/100                              │
│   Analysis        : cache hit / {N}ms fresh             │
│   Cycles          : {N}   (chỉ khi > 0)                 │
│   Est. savings    : ~{N}t (community filter heuristic)  │
│ 💉 CONTEXT INJECTION                                     │
│   Repo Map        : ~{N}t (once)                        │
│   Graph Insights  : ~{N}t                               │
│   Graph Pulse     : ~{N}t  (khi > 0)                   │
│   Graph steer     : {N}    (khi > 0)                   │
│   Graph retrieval : {N} boosted  (khi > 0)             │
│   Active community: {id}   (khi có)                    │
│   Intelligence    : ~{N}t                               │
│   Smart Dep Ctx   : ~{N}t                               │
│   Dep Context     : {N}x, ~{N}t total                  │
│   Total injected  : ~{N}t                               │
│   Breakdown       : repo-map {%} · graph {%} · ...     │
│   Community prune : {N} msgs ({community})              │
│ 🧭 LSP                                                  │
│   go_to_definition  : {N}                               │
│   find_references   : {N}                               │
│   hover             : {N}                               │
│   workspace_symbol  : {N}                               │
│   document_symbol   : {N}                               │
│   implementation    : {N}                               │
│   batch goto-def    : {N}                               │
│   errors            : {N}                               │
│   last error        : {text}                            │
│   status            : disabled / servers (ok): {ids}   │
│   install {id}      : {command}                         │
│ 🔗 HASHLINE                                             │
│   hashline_edit     : {N} ({K} dry_run)                │
│   apply (no dry)    : {N}                               │
│   anchor turns      : {N}                               │
│   builtin steered   : {N}                               │
│   mismatches        : {N}  (khi > 0)                   │
│ 💰 TOKEN SAVINGS                                        │
│   Saved           : ~{N}t ({%}% vs full reads)         │
│ 📁 TOP FILES (dep-context)                              │
│   {N}×  {path/to/file}                                  │
│ 📋 PROVIDER GUIDANCE                                    │
│   - {short/path.md}                                     │
└────────────────────────────────────────────────────────┘
Tip: `/scope history` for trends · `/scope graph` for architecture detail.
```

#### Phân tích:
- ✅ Rất chi tiết — user thấy toàn bộ hoạt động của pi-scope
- ✅ `TOKEN SAVINGS` section là **proof of value** mạnh nhất
- ✅ `TOP FILES` cho thấy pi-scope đang tập trung vào đâu
- ⚠️ Thiếu: Không có section về **Languages** (ngôn ngữ được index)
- ⚠️ Thiếu: Không có phần giải thích ngắn **"pi-scope đang làm gì cho bạn"** cho user mới

---

### 📌 Feature 4: `/scope graph` — Chi tiết kiến trúc đồ thị

**Mô tả:** Dashboard chi tiết về graph analysis.

#### Format:
```
┌──── pi-scope Graph Detail ─────────────────────────────┐
│ Nodes {N} · Edges {M} · Communities {K}                 │
│ Cycles {C} · Anomalies {A} · Surprises {S}              │
│ Active community : {id}                                 │
│ Pruned messages  : {N}                                  │
│ Top god nodes:                                          │
│   {label} ({CRITICAL/IMPORTANT/NORMAL}, {N} in)        │
│ Communities:                                            │
│   {label}: {N} nodes                                   │
│ Notable connections:                                    │
│   {source} → {target}                                  │
│ Anomalies:                                              │
│   [{severity}] {type}                                  │
└────────────────────────────────────────────────────────┘
```

---

### 📌 Feature 5: `/scope history` — Lịch sử session

**Mô tả:** Xem trends qua nhiều session.

#### Format:
```
┌──── pi-scope Session History ──────────────────────────┐
│ Last {N} session(s) · averages below                   │
│   Avg savings     : ~{N}t ({%}%)                       │
│   Avg dep-context : {N}x                               │
│   Avg injected    : ~{N}t                              │
│                                                        │
│   {date} · {N} files · saved ~{N}t · {K} inj · {dur} · Q{score} │
└────────────────────────────────────────────────────────┘
```

#### Phân tích:
- ✅ Cực kỳ valuable — user thấy xu hướng cải thiện theo thời gian
- ⚠️ Thiếu: Không có "best session" highlight
- ⚠️ Thiếu: Không có comparison "hôm nay vs trung bình"

---

### 📌 Feature 6: System Prompt Injection — Graph Analysis Insights

**Mô tả:** Khi session bắt đầu (lần đầu tiên AI nhận prompt), pi-scope inject một block **Graph Analysis Insights** vào system prompt để AI hiểu kiến trúc codebase.

#### Nội dung inject (AI-visible):
```markdown
## Graph Analysis Insights

**Graph:** {N} nodes, {M} edges, {K} communities
**Circular Dependencies:** {N}  ← chỉ khi có

**God Nodes (most depended-on symbols):**
  - `{label}` ({N} in, {M} out, {CRITICAL/IMPORTANT/NORMAL})
  - ... and {N} more

**Communities:**
  - {label}: {N} nodes

**Bottlenecks (high betweenness):**
  - `{label}` ({N} dependents, {score} betweenness)

**Anomalies:**
  - [{ERROR/WARNING/INFO}] {type}: {description} ({nodes})

**Notable connections:**
  - `{source}` → `{target}` ({reason})
```

#### Phân tích:
- ✅ AI nhận được "bản đồ kiến trúc" ngay từ đầu, không cần đọc từng file
- ✅ God nodes được highlight rõ để AI biết đâu là điểm nhạy cảm
- ✅ Circular deps được cảnh báo sớm

---

### 📌 Feature 7: Context Intelligence Engine — Workflow Optimization

**Mô tả:** Mỗi turn, pi-scope phân tích hội thoại để phát hiện intent (editing, navigation, overview) và inject hướng dẫn phù hợp cho AI.

#### Các blocks inject vào context:

**Block 1: `🎯 WORKFLOW OPTIMIZATION`**
```
Mode navigation:
  - Use `lsp_go_to_definition` or `lsp_find_references` instead of manual search
  - Use `lsp_hover` for type info and graph impact at the cursor

Mode editing:
  - When editing code: Use `hashline_edit` with `dry_run: true` first when anchors are present
  - Before large edits on shared symbols: `lsp_find_references` then `lsp_hover`

Mode idle:
  - Editing: `hashline_edit` (dry_run first) · Navigation: LSP tools · Types: `lsp_hover`

Nếu có hash annotations:
  - Hash anchors detected: use `hashline_edit` with dry_run: true

Nếu có navigation request:
  - Navigation: `lsp_go_to_definition` — jump to the canonical declaration
```

**Block 2: `⚠️ HIGH-IMPACT SYMBOLS (edit carefully)`**  
*(Chỉ khi mode = editing và có god nodes bị ảnh hưởng)*
```
- 🔥 `{label}` ({N} dependents, {K} communities)   ← CRITICAL
- ⚠️ `{label}` ({N} dependents, {K} communities)   ← IMPORTANT
- 🔍 `{label}` ({N} dependents, {K} communities)   ← NORMAL
```

**Block 3: `💡 OPTIMIZATION SUGGESTIONS`**  
*(Khi phát hiện suboptimal patterns)*
```
- {recommendation từ pattern detector}
```

**Block 4: `💡 CURRENT CONTEXT SUGGESTIONS`**
```
Editing intent for "{symbols}":
1. `lsp_go_to_definition` to confirm the symbol
2. `lsp_find_references` before applying changes
3. God nodes overlap — treat as high-impact edit  ← khi có god nodes

Navigation for "{symbols}": use `lsp_find_references`
```

**Block 5: `⚠️ IMPACT UNKNOWN (no graph loaded)`**  
*(Khi không có graph analysis)*
```
- Symbols: `{symbols}`
- Run `lsp_find_references` before editing; use `lsp_hover` for local context
```

#### Phân tích:
- ✅ Cực kỳ valuable — AI được "coach" đúng tool cho đúng tình huống
- ✅ Có 4 mode khác nhau: editing, navigation, overview, idle
- ✅ Risk warnings với 3 mức severity (🔥/⚠️/🔍)
- ⚠️ User không thấy những messages này — chúng chỉ dành cho AI

---

### 📌 Feature 8: Smart Repository Map

**Mô tả:** Thay vì inject repo map tĩnh, pi-scope **ưu tiên hóa** theo graph để AI biết cần đọc đâu trước.

#### Nội dung inject:
```markdown
📍 GRAPH-PRIORITIZED NAVIGATION
- **{Community Label}** (`{id}`, {N} nodes) — start here when working in this domain

🎯 FOCUS AREAS (graph impact)
- `{label}` — {CRITICAL/IMPORTANT/NORMAL}, {N} inbound deps (community: {community})

---
{static repo map}
```

#### Phân tích:
- ✅ AI biết community nào relevant với task hiện tại
- ✅ God nodes được đặt lên đầu để AI ưu tiên đọc

---

### 📌 Feature 9: Graph Pulse — Nhắc nhở mỗi turn (compact)

**Mô tả:** Sau khi Graph Insights đã được inject lần đầu, những turn tiếp theo chỉ inject một block nhỏ "Graph Pulse" để tiết kiệm token mà vẫn giữ context.

#### Nội dung inject:
```markdown
## Graph pulse

**Active community:** {label} (`{id}`)
(hoặc) **Communities:** {N} modules detected

**Focus god nodes:**
  - `{label}` ({CRITICAL}, {N} in) — use `lsp_find_references` before editing

**Cycle:** Circular dependency involves in-focus file(s) ({files}) — avoid deepening import cycles.
```

#### Phân tích:
- ✅ Elegant — giữ AI "nhớ" graph context mà không tốn nhiều token
- ✅ Chỉ highlight god nodes **liên quan đến task hiện tại** (smart filtering)

---

### 📌 Feature 10: Dep Context — Context injection thông minh

**Mô tả:** Mỗi turn khi AI đang làm việc, pi-scope detect files được nhắc đến và inject AST skeleton + dependencies.

#### Điều kiện trigger:
- Có file path trong messages
- Có tool call
- Có tool result với files
- Symbol match score ≥ 2 (retrieval engine)
- Broad codebase query ("explain the architecture...")

#### Nội dung inject:
```xml
<dep-context>

## Codebase Overview ({N} files, {M} symbols)   ← chỉ khi broad query
## Communities (graph)                            ← chỉ khi có communities
## Module Structure                               ← directory listing

## Key files
### path/to/file.ts
{AST skeleton}  ← chỉ function signatures, types, exports — không có implementation
{hashline anchors}  ← LINE+bigram references nếu được enable

## Direct dependencies
### path/to/dep.ts
{AST skeleton}

</dep-context>
```

#### Phân tích:
- ✅ Đây là **core value** của pi-scope — inject đúng, đủ, không thừa
- ✅ Hashline anchors cho phép edit chính xác theo dòng
- ✅ Transitive deps được inject theo cấu hình `dependencyDepth` (0-3)

---

### 📌 Feature 11: Smart Dep Context — Graph-enhanced context

**Mô tả:** Layer bổ sung trên dep-context với god node prioritization và community context.

#### Nội dung inject:
```markdown
🎯 HIGH-PRIORITY SYMBOLS
- {label} ({CRITICAL/IMPORTANT/NORMAL}, {N} in)

🏘️ ACTIVE COMMUNITY: {label}
Files in focus: {file1}, {file2}, ...

🔧 TOOL PATTERNS
- `{pattern}`: {recommendation} → `{toolSuggestion}`
```

---

### 📌 Feature 12: Graph Cycle Warning

**Mô tả:** Khi file đang được edit tham gia vào circular dependency, cảnh báo được inject cho AI.

#### Messages:
```
Trường hợp 1 (file in-focus tham gia cycle):
"Circular dependency involves in-focus file(s) ({sample files}) — avoid deepening import cycles."

Trường hợp 2 (repo có cycles nhưng không trực tiếp):
"Graph reports {N} circular dependency cycle(s) in this repo — review imports before large refactors."
```

#### Block inject cho intelligence:
```
⚠️ GRAPH CYCLE RISK:
- {warning message}
```

#### Phân tích:
- ✅ Proactive warning — AI không vô tình tạo thêm circular deps
- ✅ Chỉ cảnh báo khi relevant (file đang edit có liên quan)

---

### 📌 Feature 13: LSP Hover Enhancement — Thông tin graph khi hover

**Mô tả:** Khi AI dùng `lsp_hover`, pi-scope **bổ sung** thông tin graph vào kết quả LSP.

#### Thông tin bổ sung (markdown):
```markdown
```
{base LSP info}
```

## 🌟 God Node
**Criticality:** {CRITICAL/IMPORTANT/NORMAL}
**In-Degree:** {N}
**Out-Degree:** {M}
**PageRank:** {score}
**Community:** {id}

_This is a critical hub. Changes may affect many dependent modules. Request code review._

## 📊 Graph Metrics
**Centrality:** {critical/high/medium/low/unknown}
**In-Degree:** {N}
**Out-Degree:** {M}

## 🏘️ Community
**Community:** {label}
**Members:** {N}
**Density:** {pct}%
**Role:** Interface Node (bridges communities)   ← nếu applicable
**Role:** Bottleneck Node (critical path)        ← nếu applicable

## ⚡ Unexpected Connections
**Types:** {cross-community, legacy, circular, hidden, unexpected}
**Count:** {N}

_This node has unexpected connections. Consider refactoring to improve modularity._

## 📥 Used by
- `path/to/file.ts`
- ...

## 🔗 Impact Analysis
**Criticality:** {CRITICAL/IMPORTANT/NORMAL/LOW}
**Dependents:** {N}
**Affected Communities:** {K}

_Changes here will impact {N} dependents across {K} communities. Schedule mandatory code review._
```

#### Phân tích:
- ✅ Cực kỳ valuable — AI nhận được **blast radius** của mỗi symbol ngay khi hover
- ✅ Recommendation text là actionable ("Request code review", "Schedule mandatory code review")
- ✅ Phân loại rõ 4 loại recommendations khác nhau theo criticality
- ⚠️ Messages hơi cứng nhắc (hard-coded strings) — có thể personalize hơn

---

### 📌 Feature 14: `graph_symbol_impact` Tool

**Mô tả:** Tool độc lập (không cần LSP) để AI query blast radius của bất kỳ symbol nào.

#### Output:
- Giống LSP hover nhưng không cần LSP server
- Fallback khi LSP không available
- Message khi không có graph: `"No graph analysis loaded for this session."`

---

### 📌 Feature 15: Community Pruning Plugin

**Mô tả:** Tự động prune các developer messages cũ không còn relevant với community đang active.

#### Notification (khi prune):
```
Community pruning: removed {N} off-community injection(s) (active: {label})
```
→ Được gửi qua `_notify()` (user thấy)

#### Console log khi shutdown:
```
[community-pruning] Session summary: {N} context messages pruned over {K} turns
```

#### Dashboard display:
```
Community prune : {N} msgs ({community id})
```

#### Phân tích:
- ✅ Thông điệp rõ ràng — user biết pi-scope đang "dọn dẹp" context
- ✅ Được track trong dashboard
- ⚠️ Message quá kỹ thuật — user không biết community label này nghĩa là gì

---

### 📌 Feature 16: GraphSteer Plugin — Chặn edit god nodes

**Mô tả:** Khi AI định edit một CRITICAL god node mà chưa chạy LSP impact tools, plugin này can thiệp.

#### Steering message (user-visible qua notify):
```
Target symbol is a CRITICAL god node — run `lsp_find_references` and `lsp_hover` 
(or `graph_symbol_impact`) before editing.
```
- **Soft mode (default):** Allow + warning
- **Strict mode:** Block tool call completely

#### Dashboard:
```
Graph steer : {N}   ← số lần đã steered
```

#### Phân tích:
- ✅ Safety net quan trọng — ngăn chặn rủi ro khi sửa code có impact cao
- ✅ Có thể config strict/soft mode
- ⚠️ User không thấy message này trực tiếp (chỉ AI thấy) — cần expose ra user

---

### 📌 Feature 17: LspSteer Plugin — Khuyến khích dùng LSP

**Mô tả:** Khi AI dùng grep/search để tìm symbol, plugin suggest dùng LSP thay thế.

#### Steering messages:
```
Trường hợp grep/search:
"Prefer `lsp_go_to_definition` or `lsp_workspace_symbol` over text search 
when locating symbols in indexed code."

Trường hợp read + line navigation:
"For type and impact at a specific line in `{path}`, use `lsp_hover` (0-based line/col) 
instead of partial `read`."
```

#### Dashboard:
```
builtin steered : {N}   ← số lần đã steered
```

---

### 📌 Feature 18: HashlineSteer Plugin — Khuyến khích dùng hashline_edit

**Mô tả:** Khi AI dùng built-in edit/write/search_replace trên file đã được index, plugin suggest dùng hashline_edit.

#### Steering message:
```
"Prefer `hashline_edit` for `{path}` — anchors are in dep-context or use `/hashline-read {path}`. 
Built-in `{tool}` can drift; hashline validates line anchors. Use `dry_run: true` on the first attempt."
```

#### Block mode (strict/contextual-strict):
- Khi strict mode: **chặn hoàn toàn** built-in edit
- Khi file đã có anchors này turn: tự động block

---

### 📌 Feature 19: HashlineValidate Plugin — Kiểm tra anchors trước khi edit

**Mô tả:** Khi AI dùng `hashline_edit` mà chưa có anchors, nhắc phải `hashline_read` trước.

#### Validation message:
```
"No hashline anchors recorded for `{path}`. Call `hashline_read` (or check dep-context) 
before applying edits."
```

---

### 📌 Feature 20: Hashline Dry-Run Follow-up

**Mô tả:** Sau khi AI chạy `hashline_edit` với `dry_run: true`, turn tiếp theo inject preview để AI review.

#### Block inject:
```markdown
#### Hashline dry-run preview
File `{path}` — changes +{N} / -{M}.
Review the diff below, then call `hashline_edit` with `dry_run: false` to apply.
```
{diff preview}
```
```

#### Tool call notification:
```
[scope] First hashline_edit on `{path}` should use dry_run: true to preview the diff.
```

---

### 📌 Feature 21: Auto-reindex Watcher

**Mô tả:** Tự động reindex khi file thay đổi (file watcher với 300ms debounce).

#### Messages:
| Tình huống | Message | Level |
|-----------|---------|-------|
| Bắt đầu reindex | `[scope] Reindexing after code changes...` | info |
| Reindex thành công | `[scope] ✓ Reindexed {N} files` | success |
| Reindex thất bại | `[scope] ⚠ Auto-reindex failed; continuing with previous index` | warning |

#### Ignore paths:
- `.git/`, `.pi/`, `node_modules/`, `dist/`

#### Phân tích:
- ✅ User luôn có index fresh nhất
- ⚠️ Không có thông báo **khi nào index bị cũ** (chỉ thông báo khi reindex xong)

---

### 📌 Feature 22: Session Shutdown Summary

**Mô tả:** Khi session kết thúc, nếu có token savings, hiển thị summary.

#### Message:
```
[scope] ✓ Saved ~{N}t ({pct}% vs full reads) · {files} files · {triggers} dep-context
```

#### Điều kiện: chỉ hiển thị khi `totalTokensSaved > 0` và `metrics.notifyOnShutdown = true`

#### Phân tích:
- ✅ **KPI quan trọng nhất** được highlight khi session end
- ⚠️ Message không có context về giá trị tiền tương đương (e.g., "~$0.05 saved")

---

### 📌 Feature 23: Context Files & Provider Guidance

**Mô tả:** Load AGENTS.local.md, CLAUDE.local.md (context files) và CLAUDE.md/CODEX.md/GEMINI.md (provider guidance).

#### Notification messages:
```
Context files:
[context-files] {N} file(s) loaded for "{sectionTitle}":
  {relative/path.md}

Provider guidance (khi inject):
[scope] Provider guidance: {names}
```

---

### 📌 Feature 24: Retrieval Engine — Graph-boosted file scoring

**Mô tả:** Khi tìm files relevant cho query, RetrievalEngine boost score cho god nodes và active community files.

#### Signals (hidden, chỉ hiển thị trong `/scope explain`):
- `symbol:exact` — symbol match
- `filename:match` — filename match  
- `dep:proximity` — dependency proximity
- `graph:god-node` — god node boost
- `graph:community` — active community boost

#### Dashboard:
```
Graph retrieval : {N} boosted  ← số files được boost bởi graph
```

---

## III. Tổng Hợp Tất Cả Messages Hiện Tại

### A. User-facing Notifications (qua `ctx.ui.notify`)

```
✅ SUCCESS:
1.  [scope] ✓ Loaded {N} files from cache
2.  [scope] ✓ Indexed {N} files in {T}s
3.  [scope] ✓ Reindexed {N} files
4.  [scope] ✓ Saved ~{N}t ({pct}% vs full reads) · {files} files · {triggers} dep-context

ℹ️ INFO:
5.  [scope] Building index...
6.  [scope] Graph: {N} nodes, {M} edges[, {K} communities]
7.  [scope] Graph quality {score}/100 · {analysis}  [khi score ≥ 80]
8.  [scope] Provider guidance: {names}
9.  [scope] Reindexing after code changes...
10. [scope] First hashline_edit on `{path}` should use dry_run: true...
11. Community pruning: removed {N} off-community injection(s) (active: {label})
12. [plugin steering] Target symbol is a CRITICAL god node — run...
13. [plugin steering] Prefer `lsp_go_to_definition` or `lsp_workspace_symbol`...
14. [plugin steering] For type and impact at a specific line... use `lsp_hover`
15. [plugin steering] Prefer `hashline_edit` for `{path}`...
16. [plugin steering] No hashline anchors recorded for `{path}`...

⚠️ WARNING:
17. [scope] ⚠ Cached index stale, rebuilding ({reasons})
18. [scope] ⚠ {lsp installSuggestion}
19. [scope] ⚠ Graph quality {score}/100 · ...  [khi score thấp hoặc có cycles]
20. [scope] ⚠ Auto-reindex failed; continuing with previous index

❌ ERROR:
21. [scope] ✗ Error: {message}
```

### B. AI-facing Context Injections (trong system prompt / context)

```
System prompt (once per session):
22. Repo Map (với graph prioritization nếu có)
23. Provider Guidance section
24. Graph Analysis Insights block
25. Context Intelligence block (workflow + risk warnings)
26. Context Files section
27. pi-scope Tools block (tool usage guide)
28. Hashline preamble

Per-turn context:
29. Graph Pulse (compact reminder sau turn đầu)
30. Hashline Turn Workflow block
31. Smart Dep Context (god nodes + community context)
32. Dep Context (key files + deps + hashline anchors)
33. Hashline Dry-Run Follow-up
```

### C. Dashboard Messages (`/scope`, `/scope graph`, `/scope history`)

```
34. Full session dashboard (23+ metrics)
35. Graph detail view
36. Session history + trends
```

### D. LSP Hover Enhancement

```
37. God Node section (markdown)
38. Graph Metrics section
39. Community section
40. Surprising Connections section
41. Impact Analysis section
42. "Used by" files section
```

---

## IV. Đánh Giá Giá Trị Thực Tế

### ✅ Những gì pi-scope đang làm tốt

| Tính năng | Giá trị | Mức độ hiển thị |
|----------|---------|----------------|
| Token savings tracking | **Cao nhất** — đo được ROI | `/scope`, shutdown |
| Graph quality score | Cao — báo sức khỏe codebase | status bar, `/scope` |
| God node warnings | Cao — ngăn rủi ro edit | AI context (indirect) |
| Community-based context pruning | Cao — context luôn focused | `/scope` stats |
| Auto-reindex | Cao — index luôn fresh | notifications |
| LSP hover enhancement | Cao — blast radius ngay tại cursor | AI tool result |
| Hashline steering | Trung bình | notification |
| Session history | Trung bình — trends | `/scope history` |

### ⚠️ Gaps Hiện Tại — Thông Điệp Còn Thiếu

---

## V. Đề Xuất Thêm Messages — Tăng Tính Hiển Thị Giá Trị

### 🔴 Priority 1: Critical — Thiếu hoàn toàn

#### 1.1. Graph Analysis Progress

**Hiện tại:** Không có thông báo khi graph analysis đang chạy  
**Đề xuất thêm:**
```typescript
// Trong loadGraph(), trước khi chạy analyzeFromIndex:
this._notify(nInfo('Analyzing codebase graph...'), 'info')

// Sau khi xong, thêm vào message hiện có:
// Từ: "[scope] Graph: 1200 nodes, 4500 edges, 8 communities"
// Thành: "[scope] Graph: 1200 nodes, 4500 edges, 8 communities — analyzed in 340ms"
```

#### 1.2. Context Injection Summary per Turn

**Hiện tại:** Không có thông báo khi dep-context được inject  
**Đề xuất:**
```typescript
// Trong handleContext(), sau khi build pipeline:
if (result.content && s.stats.depContextTriggers % 5 === 0 && s.stats.depContextTriggers > 0) {
  this._notify(
    nInfo(`${s.stats.depContextTriggers} dep-context injections · ~${s.stats.totalTokensSaved}t saved so far`),
    'info'
  )
}
```
→ Cứ 5 lần inject, nhắc user về tiến độ tiết kiệm token

#### 1.3. First-Time "pi-scope Active" Message

**Hiện tại:** Không có welcome/confirmation message  
**Đề xuất:**
```typescript
// Trong start(), sau khi state được init lần đầu:
const langList = config.languages?.slice(0, 3).join(', ') ?? 'TypeScript'
this._notify(
  nSuccess(
    `pi-scope v${this.version} active · ${result.fileCount} files indexed · ` +
    `${langList} · graph analysis ${graph ? 'ready' : 'skipped'}`
  ),
  'success'
)
```

#### 1.4. God Node Edit Event (user-visible)

**Hiện tại:** GraphSteerPlugin chỉ notify về steering — user không biết AI vừa cố edit god node  
**Đề xuất:**
```typescript
// Trong GraphSteerPlugin.onToolCall():
if (criticalGodForSymbols(graph, symbols)) {
  this.onUserNotify?.(
    `⚡ AI is editing CRITICAL symbol — pi-scope guided it to check impact first (${symbols.join(', ')})`
  )
}
```
→ User thấy pi-scope đang bảo vệ codebase của họ!

#### 1.5. Retrieval Boost Notification

**Hiện tại:** `Graph retrieval: {N} boosted` chỉ trong dashboard  
**Đề xuất thêm vào context khi có graph boost:**
```
// Trong smart dep context khi graphBoostedRetrievalCount tăng:
[scope] Graph-boosted context: {N} files prioritized by community membership
```

---

### 🟠 Priority 2: High — Cải thiện messages hiện có

#### 2.1. Enrich Startup Message với Languages

**Hiện tại:**
```
[scope] ✓ Indexed 247 files in 1.2s
```
**Đề xuất:**
```
[scope] ✓ Indexed 247 files in 1.2s · TypeScript, Python · 1,840 symbols
```

#### 2.2. Graph Quality Message với Context

**Hiện tại:**
```
[scope] Graph quality 78/100 · 240ms fresh · 3 cycles
```
**Đề xuất:**
```
[scope] Graph quality 78/100 · 8 communities · 3 god nodes · 3 cycles (run /scope graph for details)
```

#### 2.3. Community Pruning — Friendlier Message

**Hiện tại:**
```
Community pruning: removed 2 off-community injection(s) (active: comm-auth-module)
```
**Đề xuất:**
```
[scope] Context focused on "Auth Module" — removed 2 unrelated code blocks
```

#### 2.4. Shutdown Message với Comparison

**Hiện tại:**
```
[scope] ✓ Saved ~1,240t (62% vs full reads) · 18 files · 7 dep-context
```
**Đề xuất:**
```
[scope] ✓ Session complete: ~1,240 tokens saved (62%) · 18 unique files · 7 context injections
```

#### 2.5. `/scope` Dashboard — Thêm "Health Summary" line

**Đề xuất thêm section đầu dashboard:**
```
│ 🏥 HEALTH SUMMARY                                       │
│   Status          : Healthy                             │
│   Index           : Fresh (2 min ago)                   │
│   Graph           : Q84/100 · 0 cycles                  │
│   LSP             : Active (typescript-language-server)  │
│   Token savings   : 62% (excellent)                     │
```

---

### 🟡 Priority 3: Medium — Nice-to-have

#### 3.1. `/scope explain` — Giải thích tại sao file được inject

**Hiện tại:** `lastExplanation` được track nhưng không expose  
**Đề xuất:** Implement `/scope explain` command:
```
/scope explain

┌──── Why these files were injected ─────────────────────┐
│ src/auth/manager.ts          score: 8.5                 │
│   signals: symbol:authenticate (3×), graph:god-node    │
│ src/auth/types.ts            score: 3.0                 │
│   signals: dep:proximity (from manager.ts)              │
└────────────────────────────────────────────────────────┘
```

#### 3.2. Daily/Weekly Summary

**Đề xuất:**
```
[scope] Weekly: avg 58% token savings · 4 sessions · top file: src/manager.ts (12×)
```

#### 3.3. Cycle Alert on New File Creation

**Đề xuất:** Khi AI tạo file mới có imports tạo potential cycle:
```
[scope] ⚠ New import in {file} may extend cycle (depth: 3) — verify with lsp_find_references
```

#### 3.4. `/scope graph --community {label}` — Chi tiết community

**Đề xuất:**
```
/scope graph --community auth

┌──── Community: Auth Module ─────────────────────────────┐
│ 12 nodes · density 0.67 · 3 interface nodes             │
│ Key files: manager.ts, types.ts, validator.ts           │
│ Bottlenecks: authenticate (7 dependents)                │
│ Connected to: Core (3 edges), API (2 edges)             │
└────────────────────────────────────────────────────────┘
```

#### 3.5. Token Savings Milestone Notification

**Đề xuất:**
```typescript
// Trong recordDepContextInjection():
const milestones = [1000, 5000, 10000, 50000]
for (const m of milestones) {
  if (this.totalTokensSaved >= m && this.totalTokensSaved - delta < m) {
    this._notify(nSuccess(`Milestone: ${m}+ tokens saved this session! 🎉`), 'success')
  }
}
```

#### 3.6. Graph Steer Counter (visible to user)

**Đề xuất thêm vào status bar:**
```
SmartCtx: 247 files | ... | 🛡️ 3 steered
```
→ User thấy pi-scope đã can thiệp bao nhiêu lần để bảo vệ code quality

#### 3.7. `/scope impact {symbol}` Command

**Đề xuất:** Command mới để query impact từ terminal:
```
/scope impact authenticate

Symbol: authenticate (src/auth/manager.ts)
├── Criticality: CRITICAL god node
├── 47 direct dependents
├── Affects 4 communities
└── Recommendation: Schedule mandatory code review before editing
```

---

## VI. Bảng Tổng Hợp Đề Xuất

| # | Đề xuất | Priority | Effort | Value |
|---|---------|----------|--------|-------|
| 1.1 | Graph analysis progress message | 🔴 Critical | Low | High |
| 1.2 | Per-5-turn savings reminder | 🔴 Critical | Low | High |
| 1.3 | First-time "pi-scope active" welcome | 🔴 Critical | Low | High |
| 1.4 | User-visible god node edit event | 🔴 Critical | Medium | Very High |
| 1.5 | Graph-boost notification | 🔴 Critical | Low | Medium |
| 2.1 | Enrich startup with languages/symbols | 🟠 High | Low | Medium |
| 2.2 | Graph quality with community context | 🟠 High | Low | Medium |
| 2.3 | Friendly community pruning message | 🟠 High | Low | Medium |
| 2.4 | Shutdown with "session complete" framing | 🟠 High | Low | High |
| 2.5 | Health summary in dashboard | 🟠 High | Medium | High |
| 3.1 | `/scope explain` command | 🟡 Medium | Medium | High |
| 3.2 | Daily/weekly summary | 🟡 Medium | Medium | Medium |
| 3.3 | Cycle alert on new file | 🟡 Medium | Medium | High |
| 3.4 | `/scope graph --community` | 🟡 Medium | Medium | Medium |
| 3.5 | Token savings milestones | 🟡 Medium | Low | Medium |
| 3.6 | Steer counter in status bar | 🟡 Medium | Low | High |
| 3.7 | `/scope impact {symbol}` command | 🟡 Medium | High | High |

---

## VII. Kết Luận

### pi-scope đang hoạt động như thế nào?

**Rất tốt về mặt kỹ thuật.** Hệ thống có:
- 24 loại thông điệp user-facing khác nhau (notifications + dashboard)
- 33+ loại injections cho AI (system prompt + context)
- 6 plugins active per session
- Đầy đủ metrics tracking với persistence

### Vấn đề chính về UX thông điệp:

1. **User không thấy nhiều giá trị đang xảy ra** — phần lớn "magic" xảy ra invisible (context injection, steering, graph boost) chỉ cho AI thấy, không cho user thấy
2. **Thiếu "first impression"** — không có welcome message giải thích pi-scope đang làm gì
3. **Thiếu real-time feedback về protection** — user không biết khi nào pi-scope đã ngăn chặn một edit nguy hiểm
4. **Token savings cần được celebrate hơn** — chỉ hiển thị khi shutdown, không phải trong-session

### Nếu implement 3 suggestions Priority 1:

Sau khi thêm:
- Graph analysis progress (1.1)
- First-time welcome (1.3)  
- God node edit event (1.4)

User sẽ thấy **3 loại giá trị rõ ràng**:
1. "pi-scope đang index và analyze codebase của tôi"
2. "pi-scope đang bảo vệ code critical của tôi"
3. "pi-scope đang tiết kiệm token cho tôi"

Đây là 3 proof points mạnh nhất để user tin tưởng và tiếp tục dùng pi-scope.

---

*Báo cáo được generate từ phân tích toàn bộ source code của pi-scope v0.9.0*  
*Cập nhật 2026-06-09: 5 module mới (path-policy, concurrency, line-window, index-fingerprint, graph-lookup-index), indexer song song 12 workers, lazy pipeline, O(1) graph lookups*  
*Tổng: ~5,500 dòng code được phân tích, 13 nhóm tính năng, ~730 tests*
