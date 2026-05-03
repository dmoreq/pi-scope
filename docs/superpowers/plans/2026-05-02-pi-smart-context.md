# pi-smart-context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pi coding-agent extension that injects AST-based project context (global repo map + per-turn dependency skeletons) into the system prompt automatically.

**Architecture:** A TypeScript ESM package with five components — `DiskCache` (hash-based persistent index), `LanguageParser` implementations (TypeScript/Python/Rust via tree-sitter), `IndexEngine` (orchestrates parsing + dependency graph), `RepoMapGenerator` (global skeleton for session start), and `ContextInjector` (per-turn deep skeleton for in-focus files). The extension registers on pi's `before_agent_start` event to append context to the system prompt.

**Tech Stack:** Node.js 20+ ESM, TypeScript 5.7, tree-sitter (npm), tree-sitter-typescript, tree-sitter-python, tree-sitter-rust, ignore (npm), Vitest

**Spec:** `docs/superpowers/specs/2026-05-02-pi-smart-context-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/types.ts` | All shared interfaces: `FileIndex`, `RepoIndex`, `SmartContextConfig`, `CacheFile` |
| `src/disk-cache.ts` | SHA-256 hash cache: load, save (atomic), get, set |
| `src/parsers/language-parser.ts` | `LanguageParser` interface |
| `src/parsers/typescript-parser.ts` | tree-sitter TypeScript/TSX: skeletons + import extraction |
| `src/parsers/python-parser.ts` | tree-sitter Python: skeletons + relative import extraction |
| `src/parsers/rust-parser.ts` | tree-sitter Rust: skeletons + mod/crate import extraction |
| `src/index-engine.ts` | Walk project dir, dispatch parsers, resolve imports → `RepoIndex` |
| `src/repo-map-generator.ts` | Compress `RepoIndex` → compact global skeleton string |
| `src/context-injector.ts` | Scan messages for in-focus files → deep skeleton string |
| `src/index.ts` | pi extension entry point — registers `before_agent_start` handler |
| `tests/disk-cache.test.ts` | Unit tests for `DiskCache` |
| `tests/parsers/typescript-parser.test.ts` | Unit tests for `TypeScriptParser` |
| `tests/parsers/python-parser.test.ts` | Unit tests for `PythonParser` |
| `tests/parsers/rust-parser.test.ts` | Unit tests for `RustParser` |
| `tests/index-engine.test.ts` | Unit tests for `IndexEngine` |
| `tests/repo-map-generator.test.ts` | Unit tests for `RepoMapGenerator` |
| `tests/context-injector.test.ts` | Unit tests for `ContextInjector` |

---

## Task 1: Scaffold the package

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@pi/smart-context",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ignore": "^6.0.2",
    "tree-sitter": "^0.21.1",
    "tree-sitter-python": "^0.21.0",
    "tree-sitter-rust": "^0.21.2",
    "tree-sitter-typescript": "^0.21.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.7.3",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts
git commit -m "feat: scaffold pi-smart-context package"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export interface FileIndex {
  path: string
  skeleton: string
  imports: string[]
  contentHash: string
}

export interface RepoIndex {
  skeletons: Map<string, string>
  deps: Map<string, Set<string>>
  reverseDeps: Map<string, Set<string>>
}

export interface SmartContextConfig {
  enabled: boolean
  maxRepoMapTokens: number
  maxInjectionTokens: number
  scanLastNMessages: number
  exclude: string[]
}

export const DEFAULT_CONFIG: SmartContextConfig = {
  enabled: true,
  maxRepoMapTokens: 4000,
  maxInjectionTokens: 8000,
  scanLastNMessages: 10,
  exclude: ['**/node_modules/**', '**/.git/**', '**/.pi-cache/**', '**/dist/**'],
}

export interface CacheFile {
  version: number
  entries: Record<string, FileIndex>
}

export const CACHE_VERSION = 1
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types"
```

---

## Task 3: DiskCache (TDD)

**Files:**
- Create: `src/disk-cache.ts`
- Create: `tests/disk-cache.test.ts`

- [ ] **Step 1: Write failing tests in `tests/disk-cache.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DiskCache } from '../src/disk-cache.js'
import type { FileIndex } from '../src/types.js'

const SAMPLE: FileIndex = {
  path: '/project/src/foo.ts',
  skeleton: 'export function foo(): void { ... }',
  imports: ['./bar'],
  contentHash: 'abc123',
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'pi-cache-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('DiskCache', () => {
  it('returns undefined for missing entries before load', () => {
    const cache = new DiskCache(tmpDir)
    expect(cache.get('/project/src/foo.ts')).toBeUndefined()
  })

  it('persists entries across save and load', async () => {
    const cache = new DiskCache(tmpDir)
    cache.set(SAMPLE)
    await cache.save()

    const cache2 = new DiskCache(tmpDir)
    await cache2.load()
    expect(cache2.get(SAMPLE.path)).toEqual(SAMPLE)
  })

  it('returns empty cache if file does not exist', async () => {
    const cache = new DiskCache(tmpDir)
    await cache.load()
    expect(cache.get('/nonexistent')).toBeUndefined()
  })

  it('discards cache on version mismatch', async () => {
    const cache = new DiskCache(tmpDir)
    cache.set(SAMPLE)
    await cache.save()

    // Tamper with version
    const { readFile, writeFile } = await import('node:fs/promises')
    const cachePath = join(tmpDir, '.pi-cache', 'smart-context.json')
    const data = JSON.parse(await readFile(cachePath, 'utf-8'))
    data.version = 999
    await writeFile(cachePath, JSON.stringify(data))

    const cache2 = new DiskCache(tmpDir)
    await cache2.load()
    expect(cache2.get(SAMPLE.path)).toBeUndefined()
  })

  it('deletes entries', async () => {
    const cache = new DiskCache(tmpDir)
    cache.set(SAMPLE)
    cache.delete(SAMPLE.path)
    await cache.save()

    const cache2 = new DiskCache(tmpDir)
    await cache2.load()
    expect(cache2.get(SAMPLE.path)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/disk-cache.test.ts
```

Expected: FAIL — `Cannot find module '../src/disk-cache.js'`

- [ ] **Step 3: Implement `src/disk-cache.ts`**

```typescript
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { FileIndex, CacheFile } from './types.js'
import { CACHE_VERSION } from './types.js'

export class DiskCache {
  private readonly cachePath: string
  private entries: Map<string, FileIndex> = new Map()

  constructor(projectRoot: string) {
    this.cachePath = join(projectRoot, '.pi-cache', 'smart-context.json')
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.cachePath, 'utf-8')
      const data: CacheFile = JSON.parse(raw)
      if (data.version !== CACHE_VERSION) {
        this.entries = new Map()
        return
      }
      this.entries = new Map(Object.entries(data.entries))
    } catch {
      this.entries = new Map()
    }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.cachePath), { recursive: true })
    const data: CacheFile = {
      version: CACHE_VERSION,
      entries: Object.fromEntries(this.entries),
    }
    const tmp = this.cachePath + '.tmp'
    await writeFile(tmp, JSON.stringify(data), 'utf-8')
    await rename(tmp, this.cachePath)
  }

  get(path: string): FileIndex | undefined {
    return this.entries.get(path)
  }

  set(index: FileIndex): void {
    this.entries.set(index.path, index)
  }

  delete(path: string): void {
    this.entries.delete(path)
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/disk-cache.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/disk-cache.ts tests/disk-cache.test.ts
git commit -m "feat: implement DiskCache with hash-based persistence"
```

---

## Task 4: LanguageParser interface + TypeScript parser (TDD)

**Files:**
- Create: `src/parsers/language-parser.ts`
- Create: `src/parsers/typescript-parser.ts`
- Create: `tests/parsers/typescript-parser.test.ts`

- [ ] **Step 1: Create `src/parsers/language-parser.ts`**

```typescript
import type { FileIndex } from '../types.js'

export interface LanguageParser {
  readonly extensions: string[]
  parseFile(path: string, content: string): FileIndex
}
```

- [ ] **Step 2: Write failing tests in `tests/parsers/typescript-parser.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { TypeScriptParser } from '../../src/parsers/typescript-parser.js'

const parser = new TypeScriptParser()

describe('TypeScriptParser', () => {
  it('declares .ts and .tsx extensions', () => {
    expect(parser.extensions).toContain('.ts')
    expect(parser.extensions).toContain('.tsx')
  })

  it('extracts function declaration skeleton', () => {
    const result = parser.parseFile('/src/foo.ts', `
export function greet(name: string): string {
  return 'Hello ' + name
}
`)
    expect(result.skeleton).toContain('greet')
    expect(result.skeleton).toContain('{ ... }')
    expect(result.skeleton).not.toContain("return 'Hello'")
  })

  it('extracts class declaration skeleton', () => {
    const result = parser.parseFile('/src/foo.ts', `
export class Agent {
  private name: string
  constructor(name: string) { this.name = name }
  run(): void { console.log(this.name) }
}
`)
    expect(result.skeleton).toContain('Agent')
    expect(result.skeleton).toContain('{ ... }')
    expect(result.skeleton).not.toContain('console.log')
  })

  it('extracts interface skeleton', () => {
    const result = parser.parseFile('/src/foo.ts', `
export interface Config {
  name: string
  timeout: number
}
`)
    expect(result.skeleton).toContain('Config')
  })

  it('extracts type alias skeleton', () => {
    const result = parser.parseFile('/src/foo.ts', `
export type Status = 'idle' | 'running' | 'done'
`)
    expect(result.skeleton).toContain('Status')
  })

  it('extracts relative imports', () => {
    const result = parser.parseFile('/src/foo.ts', `
import { bar } from './bar'
import { baz } from '../utils/baz'
import { something } from 'external-pkg'
`)
    expect(result.imports).toContain('./bar')
    expect(result.imports).toContain('../utils/baz')
    expect(result.imports).toContain('external-pkg')
  })

  it('computes a non-empty contentHash', () => {
    const result = parser.parseFile('/src/foo.ts', 'export const x = 1')
    expect(result.contentHash).toHaveLength(64) // SHA-256 hex
  })

  it('sets the correct path', () => {
    const result = parser.parseFile('/src/foo.ts', 'export const x = 1')
    expect(result.path).toBe('/src/foo.ts')
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- tests/parsers/typescript-parser.test.ts
```

Expected: FAIL — `Cannot find module '../../src/parsers/typescript-parser.js'`

- [ ] **Step 4: Implement `src/parsers/typescript-parser.ts`**

```typescript
import { createHash } from 'node:crypto'
import Parser from 'tree-sitter'
import TypeScript from 'tree-sitter-typescript'
import type { SyntaxNode } from 'tree-sitter'
import type { LanguageParser } from './language-parser.js'
import type { FileIndex } from '../types.js'

const BODY_TYPES = new Set([
  'statement_block',
  'class_body',
  'enum_body',
  'object_type',
  'interface_body',
])

const DECLARATION_TYPES = new Set([
  'function_declaration',
  'class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'abstract_class_declaration',
  'function_signature',
  'method_signature',
])

function nodeSignature(node: SyntaxNode, source: string): string | null {
  if (!DECLARATION_TYPES.has(node.type)) return null
  const body = node.children.find(c => BODY_TYPES.has(c.type))
  if (body) {
    return source.slice(node.startIndex, body.startIndex).trimEnd() + ' { ... }'
  }
  return source.slice(node.startIndex, node.endIndex)
}

function walk(
  node: SyntaxNode,
  source: string,
  signatures: string[],
  imports: string[],
): void {
  if (node.type === 'import_statement') {
    const src = node.childForFieldName('source')
    if (src) imports.push(src.text.slice(1, -1))
    return
  }

  if (node.type === 'export_statement') {
    const decl = node.children.find(c => DECLARATION_TYPES.has(c.type))
    if (decl) {
      const sig = nodeSignature(decl, source)
      if (sig) { signatures.push('export ' + sig); return }
    }
    for (const child of node.children) walk(child, source, signatures, imports)
    return
  }

  const sig = nodeSignature(node, source)
  if (sig) { signatures.push(sig); return }

  for (const child of node.children) walk(child, source, signatures, imports)
}

export class TypeScriptParser implements LanguageParser {
  readonly extensions = ['.ts', '.tsx']
  private readonly tsParser = new Parser()
  private readonly tsxParser = new Parser()

  constructor() {
    this.tsParser.setLanguage(TypeScript.typescript)
    this.tsxParser.setLanguage(TypeScript.tsx)
  }

  parseFile(path: string, content: string): FileIndex {
    const parser = path.endsWith('.tsx') ? this.tsxParser : this.tsParser
    const tree = parser.parse(content)
    const signatures: string[] = []
    const imports: string[] = []

    walk(tree.rootNode, content, signatures, imports)

    return {
      path,
      skeleton: signatures.join('\n'),
      imports,
      contentHash: createHash('sha256').update(content).digest('hex'),
    }
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- tests/parsers/typescript-parser.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/parsers/language-parser.ts src/parsers/typescript-parser.ts tests/parsers/typescript-parser.test.ts
git commit -m "feat: implement LanguageParser interface and TypeScriptParser"
```

---

## Task 5: Python parser (TDD)

**Files:**
- Create: `src/parsers/python-parser.ts`
- Create: `tests/parsers/python-parser.test.ts`

- [ ] **Step 1: Write failing tests in `tests/parsers/python-parser.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { PythonParser } from '../../src/parsers/python-parser.js'

const parser = new PythonParser()

describe('PythonParser', () => {
  it('declares .py extension', () => {
    expect(parser.extensions).toContain('.py')
  })

  it('extracts function signature without body', () => {
    const result = parser.parseFile('/src/main.py', `
def greet(name: str) -> str:
    return f"Hello {name}"
`)
    expect(result.skeleton).toContain('def greet(name: str) -> str: ...')
    expect(result.skeleton).not.toContain('return')
  })

  it('extracts class with method signatures', () => {
    const result = parser.parseFile('/src/agent.py', `
class Agent:
    def __init__(self, name: str) -> None:
        self.name = name

    def run(self) -> None:
        print(self.name)
`)
    expect(result.skeleton).toContain('class Agent:')
    expect(result.skeleton).toContain('def __init__')
    expect(result.skeleton).toContain('def run')
    expect(result.skeleton).not.toContain('print')
  })

  it('extracts relative imports', () => {
    const result = parser.parseFile('/src/main.py', `
from .utils import helper
from ..base import Base
import os
from pathlib import Path
`)
    expect(result.imports).toContain('.utils')
    expect(result.imports).toContain('..base')
    expect(result.imports).not.toContain('os')
    expect(result.imports).not.toContain('pathlib')
  })

  it('computes a non-empty contentHash', () => {
    const result = parser.parseFile('/src/main.py', 'x = 1')
    expect(result.contentHash).toHaveLength(64)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/parsers/python-parser.test.ts
```

Expected: FAIL — `Cannot find module '../../src/parsers/python-parser.js'`

- [ ] **Step 3: Implement `src/parsers/python-parser.ts`**

```typescript
import { createHash } from 'node:crypto'
import Parser from 'tree-sitter'
import Python from 'tree-sitter-python'
import type { SyntaxNode } from 'tree-sitter'
import type { LanguageParser } from './language-parser.js'
import type { FileIndex } from '../types.js'

const parser = new Parser()
parser.setLanguage(Python as unknown as Parameters<typeof parser.setLanguage>[0])

function extractFunctionSig(node: SyntaxNode, source: string): string {
  // function_definition: def name(params) -> return: body
  // We want everything up to the colon that precedes the body
  const body = node.childForFieldName('body')
  if (body) {
    return source.slice(node.startIndex, body.startIndex).trimEnd() + ' ...'
  }
  return source.slice(node.startIndex, node.endIndex)
}

function walk(
  node: SyntaxNode,
  source: string,
  lines: string[],
  imports: string[],
  indent = '',
): void {
  if (node.type === 'import_from_statement') {
    // from .module import something
    const moduleNode = node.childForFieldName('module_name')
    if (moduleNode) {
      const text = moduleNode.text
      // Only keep relative imports (starting with .)
      if (text.startsWith('.')) imports.push(text)
    }
    return
  }

  if (node.type === 'function_definition') {
    lines.push(indent + extractFunctionSig(node, source))
    return
  }

  if (node.type === 'class_definition') {
    const name = node.childForFieldName('name')
    lines.push(indent + `class ${name?.text ?? '?'}:`)
    const body = node.childForFieldName('body')
    if (body) {
      for (const child of body.children) {
        walk(child, source, lines, imports, indent + '    ')
      }
    }
    return
  }

  for (const child of node.children) {
    walk(child, source, lines, imports, indent)
  }
}

export class PythonParser implements LanguageParser {
  readonly extensions = ['.py']

  parseFile(path: string, content: string): FileIndex {
    const tree = parser.parse(content)
    const lines: string[] = []
    const imports: string[] = []

    walk(tree.rootNode, content, lines, imports)

    return {
      path,
      skeleton: lines.join('\n'),
      imports,
      contentHash: createHash('sha256').update(content).digest('hex'),
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/parsers/python-parser.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parsers/python-parser.ts tests/parsers/python-parser.test.ts
git commit -m "feat: implement PythonParser"
```

---

## Task 6: Rust parser (TDD)

**Files:**
- Create: `src/parsers/rust-parser.ts`
- Create: `tests/parsers/rust-parser.test.ts`

- [ ] **Step 1: Write failing tests in `tests/parsers/rust-parser.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { RustParser } from '../../src/parsers/rust-parser.js'

const parser = new RustParser()

describe('RustParser', () => {
  it('declares .rs extension', () => {
    expect(parser.extensions).toContain('.rs')
  })

  it('extracts function signature without body', () => {
    const result = parser.parseFile('/src/lib.rs', `
pub fn parse(input: &str) -> Result<Ast, Error> {
    todo!()
}
`)
    expect(result.skeleton).toContain('pub fn parse')
    expect(result.skeleton).toContain('{ ... }')
    expect(result.skeleton).not.toContain('todo!')
  })

  it('extracts struct declaration', () => {
    const result = parser.parseFile('/src/lib.rs', `
pub struct Parser {
    input: String,
    pos: usize,
}
`)
    expect(result.skeleton).toContain('pub struct Parser')
    expect(result.skeleton).toContain('{ ... }')
    expect(result.skeleton).not.toContain('input: String')
  })

  it('extracts enum declaration', () => {
    const result = parser.parseFile('/src/lib.rs', `
pub enum Status {
    Idle,
    Running,
    Done,
}
`)
    expect(result.skeleton).toContain('pub enum Status')
  })

  it('extracts trait declaration', () => {
    const result = parser.parseFile('/src/lib.rs', `
pub trait Visitor {
    fn visit(&self, node: &Node);
}
`)
    expect(result.skeleton).toContain('pub trait Visitor')
  })

  it('extracts mod imports', () => {
    const result = parser.parseFile('/src/lib.rs', `
mod utils;
mod parser;
use std::collections::HashMap;
use crate::types::Ast;
`)
    expect(result.imports).toContain('mod:utils')
    expect(result.imports).toContain('mod:parser')
    expect(result.imports).toContain('crate::types::Ast')
    // std is external, not included
    expect(result.imports).not.toContain('std::collections::HashMap')
  })

  it('computes a non-empty contentHash', () => {
    const result = parser.parseFile('/src/lib.rs', 'fn main() {}')
    expect(result.contentHash).toHaveLength(64)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/parsers/rust-parser.test.ts
```

Expected: FAIL — `Cannot find module '../../src/parsers/rust-parser.js'`

- [ ] **Step 3: Implement `src/parsers/rust-parser.ts`**

```typescript
import { createHash } from 'node:crypto'
import Parser from 'tree-sitter'
import Rust from 'tree-sitter-rust'
import type { SyntaxNode } from 'tree-sitter'
import type { LanguageParser } from './language-parser.js'
import type { FileIndex } from '../types.js'

const parser = new Parser()
parser.setLanguage(Rust as unknown as Parameters<typeof parser.setLanguage>[0])

const BLOCK_TYPES = new Set(['block', 'declaration_list', 'field_declaration_list', 'enum_variant_list'])

const SIGNATURE_TYPES = new Set([
  'function_item',
  'struct_item',
  'enum_item',
  'trait_item',
  'impl_item',
  'type_item',
])

function nodeSig(node: SyntaxNode, source: string): string | null {
  if (!SIGNATURE_TYPES.has(node.type)) return null
  const body = node.children.find(c => BLOCK_TYPES.has(c.type))
  if (body) {
    return source.slice(node.startIndex, body.startIndex).trimEnd() + ' { ... }'
  }
  return source.slice(node.startIndex, node.endIndex)
}

function walk(node: SyntaxNode, source: string, sigs: string[], imports: string[]): void {
  if (node.type === 'mod_item') {
    // mod utils; — inline mod declarations
    const name = node.childForFieldName('name')
    if (name) imports.push('mod:' + name.text)
    return
  }

  if (node.type === 'use_declaration') {
    const arg = node.childForFieldName('argument')
    if (arg) {
      const text = arg.text
      // Only keep crate:: and super:: — discard std::, external crates
      if (text.startsWith('crate::') || text.startsWith('super::')) {
        imports.push(text)
      }
    }
    return
  }

  const sig = nodeSig(node, source)
  if (sig) { sigs.push(sig); return }

  for (const child of node.children) walk(child, source, sigs, imports)
}

export class RustParser implements LanguageParser {
  readonly extensions = ['.rs']

  parseFile(path: string, content: string): FileIndex {
    const tree = parser.parse(content)
    const sigs: string[] = []
    const imports: string[] = []

    walk(tree.rootNode, content, sigs, imports)

    return {
      path,
      skeleton: sigs.join('\n'),
      imports,
      contentHash: createHash('sha256').update(content).digest('hex'),
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/parsers/rust-parser.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parsers/rust-parser.ts tests/parsers/rust-parser.test.ts
git commit -m "feat: implement RustParser"
```

---

## Task 7: IndexEngine (TDD)

**Files:**
- Create: `src/index-engine.ts`
- Create: `tests/index-engine.test.ts`

- [ ] **Step 1: Write failing tests in `tests/index-engine.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { IndexEngine } from '../src/index-engine.js'
import { DEFAULT_CONFIG } from '../src/types.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'pi-index-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

async function writeFixture(rel: string, content: string): Promise<void> {
  const full = join(tmpDir, rel)
  await mkdir(join(full, '..'), { recursive: true })
  await writeFile(full, content, 'utf-8')
}

describe('IndexEngine', () => {
  it('builds skeleton for a TypeScript file', async () => {
    await writeFixture('src/foo.ts', `
export function add(a: number, b: number): number {
  return a + b
}
`)
    const engine = new IndexEngine(tmpDir, DEFAULT_CONFIG)
    await engine.build()
    const index = engine.getRepoIndex()

    const fooPath = join(tmpDir, 'src/foo.ts')
    expect(index.skeletons.has(fooPath)).toBe(true)
    expect(index.skeletons.get(fooPath)).toContain('add')
  })

  it('resolves TypeScript relative imports into dependency edges', async () => {
    await writeFixture('src/foo.ts', `import { bar } from './bar'`)
    await writeFixture('src/bar.ts', `export function bar() {}`)

    const engine = new IndexEngine(tmpDir, DEFAULT_CONFIG)
    await engine.build()
    const index = engine.getRepoIndex()

    const fooPath = join(tmpDir, 'src/foo.ts')
    const barPath = join(tmpDir, 'src/bar.ts')
    expect(index.deps.get(fooPath)?.has(barPath)).toBe(true)
    expect(index.reverseDeps.get(barPath)?.has(fooPath)).toBe(true)
  })

  it('ignores node_modules', async () => {
    await writeFixture('node_modules/pkg/index.ts', `export function x() {}`)
    await writeFixture('src/foo.ts', `export const y = 1`)

    const engine = new IndexEngine(tmpDir, DEFAULT_CONFIG)
    await engine.build()
    const index = engine.getRepoIndex()

    for (const key of index.skeletons.keys()) {
      expect(key).not.toContain('node_modules')
    }
  })

  it('uses cache for unchanged files on second build', async () => {
    await writeFixture('src/foo.ts', `export function foo() {}`)

    const engine1 = new IndexEngine(tmpDir, DEFAULT_CONFIG)
    await engine1.build()

    // Second build — should hit cache
    const engine2 = new IndexEngine(tmpDir, DEFAULT_CONFIG)
    await engine2.build()

    const fooPath = join(tmpDir, 'src/foo.ts')
    expect(engine2.getRepoIndex().skeletons.has(fooPath)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/index-engine.test.ts
```

Expected: FAIL — `Cannot find module '../src/index-engine.js'`

- [ ] **Step 3: Implement `src/index-engine.ts`**

```typescript
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, extname, dirname, resolve, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import ignore, { type Ignore } from 'ignore'
import { DiskCache } from './disk-cache.js'
import { TypeScriptParser } from './parsers/typescript-parser.js'
import { PythonParser } from './parsers/python-parser.js'
import { RustParser } from './parsers/rust-parser.js'
import type { LanguageParser, } from './parsers/language-parser.js'
import type { FileIndex, RepoIndex, SmartContextConfig } from './types.js'

const DEFAULT_IGNORES = ['node_modules', '.git', '.pi-cache', 'dist', 'build']

function buildIgnore(projectRoot: string): Ignore {
  const ig = ignore()
  ig.add(DEFAULT_IGNORES)
  try {
    const gitignore = require('node:fs').readFileSync(join(projectRoot, '.gitignore'), 'utf-8')
    ig.add(gitignore)
  } catch { /* no .gitignore */ }
  return ig
}

async function* walkDir(dir: string, root: string, ig: Ignore): AsyncGenerator<string> {
  let entries: Awaited<ReturnType<typeof readdir>>
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch { return }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    const rel = relative(root, full)
    if (ig.ignores(rel)) continue
    if (entry.isDirectory()) {
      yield* walkDir(full, root, ig)
    } else if (entry.isFile()) {
      yield full
    }
  }
}

function resolveImport(raw: string, fromFile: string, ext: string): string | null {
  if (ext === '.ts' || ext === '.tsx') {
    if (!raw.startsWith('.') && !raw.startsWith('/')) return null
    const base = resolve(dirname(fromFile), raw)
    for (const candidate of [
      base + '.ts', base + '.tsx',
      join(base, 'index.ts'), join(base, 'index.tsx'),
      base,
    ]) {
      if (existsSync(candidate)) return candidate
    }
    return null
  }

  if (ext === '.py') {
    if (!raw.startsWith('.')) return null
    const dots = raw.match(/^\.+/)?.[0].length ?? 0
    const module = raw.slice(dots).replace(/\./g, '/')
    let dir = dirname(fromFile)
    for (let i = 1; i < dots; i++) dir = dirname(dir)
    const candidate = join(dir, module + '.py')
    return existsSync(candidate) ? candidate : null
  }

  if (ext === '.rs') {
    if (raw.startsWith('mod:')) {
      const name = raw.slice(4)
      const sibling = join(dirname(fromFile), name + '.rs')
      const modFile = join(dirname(fromFile), name, 'mod.rs')
      if (existsSync(sibling)) return sibling
      if (existsSync(modFile)) return modFile
      return null
    }
    if (raw.startsWith('crate::') || raw.startsWith('super::')) {
      // Best-effort: map crate::a::b to src/a/b.rs
      const parts = raw.replace(/^(crate|super)::/, '').split('::')
      const candidate = join(dirname(fromFile), ...parts) + '.rs'
      return existsSync(candidate) ? candidate : null
    }
    return null
  }

  return null
}

export class IndexEngine {
  private readonly projectRoot: string
  private readonly config: SmartContextConfig
  private readonly parsers: Map<string, LanguageParser> = new Map()
  private readonly cache: DiskCache
  private repoIndex: RepoIndex = {
    skeletons: new Map(),
    deps: new Map(),
    reverseDeps: new Map(),
  }

  constructor(projectRoot: string, config: SmartContextConfig) {
    this.projectRoot = projectRoot
    this.config = config
    this.cache = new DiskCache(projectRoot)

    for (const p of [new TypeScriptParser(), new PythonParser(), new RustParser()]) {
      for (const ext of p.extensions) this.parsers.set(ext, p)
    }
  }

  async build(): Promise<void> {
    await this.cache.load()
    const ig = buildIgnore(this.projectRoot)
    const fileIndexes: FileIndex[] = []

    for await (const filePath of walkDir(this.projectRoot, this.projectRoot, ig)) {
      const ext = extname(filePath)
      const parser = this.parsers.get(ext)
      if (!parser) continue

      const content = await readFile(filePath, 'utf-8')
      const hash = createHash('sha256').update(content).digest('hex')
      const cached = this.cache.get(filePath)

      if (cached && cached.contentHash === hash) {
        fileIndexes.push(cached)
      } else {
        const index = parser.parseFile(filePath, content)
        this.cache.set(index)
        fileIndexes.push(index)
      }
    }

    await this.cache.save()
    this.repoIndex = this.buildGraph(fileIndexes)
  }

  private buildGraph(files: FileIndex[]): RepoIndex {
    const skeletons = new Map<string, string>()
    const deps = new Map<string, Set<string>>()
    const reverseDeps = new Map<string, Set<string>>()

    for (const f of files) {
      skeletons.set(f.path, f.skeleton)
      deps.set(f.path, new Set())
      reverseDeps.set(f.path, new Set())
    }

    for (const f of files) {
      const ext = extname(f.path)
      for (const raw of f.imports) {
        const resolved = resolveImport(raw, f.path, ext)
        if (resolved && skeletons.has(resolved)) {
          deps.get(f.path)!.add(resolved)
          if (!reverseDeps.has(resolved)) reverseDeps.set(resolved, new Set())
          reverseDeps.get(resolved)!.add(f.path)
        }
      }
    }

    return { skeletons, deps, reverseDeps }
  }

  getRepoIndex(): RepoIndex {
    return this.repoIndex
  }
}
```

- [ ] **Step 4: Fix the `readFileSync` import — replace `require('node:fs')` with a proper import at the top of `src/index-engine.ts`**

Add this import at the top of the file:

```typescript
import { readFileSync } from 'node:fs'
```

And replace the `require('node:fs').readFileSync(...)` call with:

```typescript
const gitignore = readFileSync(join(projectRoot, '.gitignore'), 'utf-8')
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- tests/index-engine.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/index-engine.ts tests/index-engine.test.ts
git commit -m "feat: implement IndexEngine with parser registry and dependency graph"
```

---

## Task 8: RepoMapGenerator (TDD)

**Files:**
- Create: `src/repo-map-generator.ts`
- Create: `tests/repo-map-generator.test.ts`

- [ ] **Step 1: Write failing tests in `tests/repo-map-generator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { RepoMapGenerator } from '../src/repo-map-generator.js'
import type { RepoIndex } from '../src/types.js'

function makeIndex(files: Record<string, string>): RepoIndex {
  const skeletons = new Map(Object.entries(files))
  return {
    skeletons,
    deps: new Map(),
    reverseDeps: new Map(),
  }
}

describe('RepoMapGenerator', () => {
  it('produces a non-empty map for a single file', () => {
    const index = makeIndex({
      '/project/src/foo.ts': 'export function foo(): void { ... }',
    })
    const gen = new RepoMapGenerator('/project', 4000)
    const map = gen.generate(index)
    expect(map).toContain('foo.ts')
    expect(map).toContain('foo')
  })

  it('groups files by directory', () => {
    const index = makeIndex({
      '/project/src/core/agent.ts': 'export class Agent { ... }',
      '/project/src/utils/helper.ts': 'export function help(): void { ... }',
    })
    const gen = new RepoMapGenerator('/project', 4000)
    const map = gen.generate(index)
    expect(map).toContain('src/core/')
    expect(map).toContain('src/utils/')
  })

  it('wraps output in <repo-map> tags', () => {
    const index = makeIndex({ '/project/src/foo.ts': 'export function foo() { ... }' })
    const gen = new RepoMapGenerator('/project', 4000)
    const map = gen.generate(index)
    expect(map).toMatch(/^<repo-map>/)
    expect(map).toMatch(/<\/repo-map>$/)
  })

  it('respects token budget by trimming entries', () => {
    // Create many files to exceed a tiny budget
    const files: Record<string, string> = {}
    for (let i = 0; i < 50; i++) {
      files[`/project/src/file${i}.ts`] = `export function fn${i}(): void { ... }`
    }
    const index = makeIndex(files)
    const gen = new RepoMapGenerator('/project', 100) // very small budget
    const map = gen.generate(index)
    // Should still produce output but under budget
    const estimatedTokens = map.length / 4
    expect(estimatedTokens).toBeLessThanOrEqual(120) // small tolerance
  })

  it('returns empty map for empty index', () => {
    const index = makeIndex({})
    const gen = new RepoMapGenerator('/project', 4000)
    const map = gen.generate(index)
    expect(map).toBe('<repo-map>\n</repo-map>')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/repo-map-generator.test.ts
```

Expected: FAIL — `Cannot find module '../src/repo-map-generator.js'`

- [ ] **Step 3: Implement `src/repo-map-generator.ts`**

```typescript
import { relative, dirname } from 'node:path'
import type { RepoIndex } from './types.js'

function extractNames(skeleton: string): string {
  // Pull top-level names from skeleton lines (class/function/type names)
  return skeleton
    .split('\n')
    .map(line => {
      const m =
        line.match(/(?:export\s+)?(?:class|function|interface|type|enum|struct|trait|impl|pub fn|def|pub struct|pub enum)\s+(\w+)/) ??
        line.match(/^(?:class|def)\s+(\w+)/)
      return m ? m[1] : null
    })
    .filter(Boolean)
    .join(', ')
}

export class RepoMapGenerator {
  private readonly projectRoot: string
  private readonly maxTokens: number

  constructor(projectRoot: string, maxTokens: number) {
    this.projectRoot = projectRoot
    this.maxTokens = maxTokens
  }

  generate(index: RepoIndex): string {
    // Group files by relative directory
    const byDir = new Map<string, Array<{ name: string; names: string }>>()

    for (const [absPath, skeleton] of index.skeletons) {
      const rel = relative(this.projectRoot, absPath)
      const dir = dirname(rel) === '.' ? '' : dirname(rel) + '/'
      const fileName = rel.slice(dir.length)
      const names = extractNames(skeleton)

      if (!byDir.has(dir)) byDir.set(dir, [])
      byDir.get(dir)!.push({ name: fileName, names })
    }

    // Build lines, trimming when over budget
    const lines: string[] = []
    const maxChars = this.maxTokens * 4

    const sortedDirs = [...byDir.keys()].sort()
    for (const dir of sortedDirs) {
      const headerLine = dir ? dir : '(root)'
      const fileLine = byDir.get(dir)!

      lines.push('  ' + headerLine)
      for (const { name, names } of fileLine) {
        const entry = `    ${name}${names ? '  ' + names : ''}`
        lines.push(entry)
      }

      const currentSize = lines.join('\n').length
      if (currentSize > maxChars) {
        // Trim last entries to fit budget
        while (lines.join('\n').length > maxChars && lines.length > 0) {
          lines.pop()
        }
        break
      }
    }

    return `<repo-map>\n${lines.join('\n')}\n</repo-map>`
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/repo-map-generator.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repo-map-generator.ts tests/repo-map-generator.test.ts
git commit -m "feat: implement RepoMapGenerator"
```

---

## Task 9: ContextInjector (TDD)

**Files:**
- Create: `src/context-injector.ts`
- Create: `tests/context-injector.test.ts`

- [ ] **Step 1: Write failing tests in `tests/context-injector.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { ContextInjector } from '../src/context-injector.js'
import type { RepoIndex } from '../src/types.js'

const ROOT = '/project'
const FOO = join(ROOT, 'src/foo.ts')
const BAR = join(ROOT, 'src/bar.ts')
const BAZ = join(ROOT, 'src/baz.ts')

function makeIndex(overrides: Partial<RepoIndex> = {}): RepoIndex {
  return {
    skeletons: new Map([
      [FOO, 'export function foo(): void { ... }'],
      [BAR, 'export function bar(): string { ... }'],
      [BAZ, 'export function baz(): number { ... }'],
    ]),
    deps: new Map([
      [FOO, new Set([BAR])],
      [BAR, new Set()],
      [BAZ, new Set()],
    ]),
    reverseDeps: new Map([
      [BAR, new Set([FOO])],
      [FOO, new Set()],
      [BAZ, new Set()],
    ]),
    ...overrides,
  }
}

describe('ContextInjector', () => {
  it('detects file paths mentioned in messages', () => {
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Please edit src/foo.ts' }]
    const result = injector.buildInjection(makeIndex(), messages as never)
    expect(result).toContain('foo.ts')
    expect(result).toContain('foo()')
  })

  it('includes 1st-degree dependencies of in-focus files', () => {
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Edit src/foo.ts' }]
    const result = injector.buildInjection(makeIndex(), messages as never)
    // bar.ts is a dep of foo.ts
    expect(result).toContain('bar.ts')
    expect(result).toContain('bar()')
  })

  it('does not duplicate files already in active section', () => {
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Edit src/foo.ts and src/bar.ts' }]
    const result = injector.buildInjection(makeIndex(), messages as never)
    // bar.ts appears once even though it's both active and a dep of foo
    const count = (result.match(/bar\.ts/g) ?? []).length
    expect(count).toBe(1)
  })

  it('returns empty string when no files are in focus', () => {
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Hello!' }]
    const result = injector.buildInjection(makeIndex(), messages as never)
    expect(result).toBe('')
  })

  it('wraps output in <dep-context> tags', () => {
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Edit src/foo.ts' }]
    const result = injector.buildInjection(makeIndex(), messages as never)
    expect(result).toMatch(/^<dep-context>/)
    expect(result).toMatch(/<\/dep-context>$/)
  })

  it('respects scanLastNMessages limit', () => {
    const injector = new ContextInjector(ROOT, 8000, 1)
    // Only last 1 message is scanned — baz.ts mentioned only in earlier message
    const messages = [
      { role: 'user', content: 'Edit src/baz.ts' },
      { role: 'user', content: 'Hello' },
    ]
    const result = injector.buildInjection(makeIndex(), messages as never)
    expect(result).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/context-injector.test.ts
```

Expected: FAIL — `Cannot find module '../src/context-injector.js'`

- [ ] **Step 3: Implement `src/context-injector.ts`**

```typescript
import { relative } from 'node:path'
import type { RepoIndex } from './types.js'

// Matches Unix-style paths with at least one slash and a known extension
const FILE_PATH_RE = /(?:^|[\s'"`(])([./\w-]+\/[\w./-]+\.(?:ts|tsx|py|rs))/g

interface Message {
  role: string
  content: string | Array<{ type: string; text?: string }>
}

function textContent(msg: Message): string {
  if (typeof msg.content === 'string') return msg.content
  return msg.content
    .filter(c => c.type === 'text')
    .map(c => c.text ?? '')
    .join(' ')
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export class ContextInjector {
  private readonly projectRoot: string
  private readonly maxTokens: number
  private readonly scanLastN: number

  constructor(projectRoot: string, maxTokens: number, scanLastN: number) {
    this.projectRoot = projectRoot
    this.maxTokens = maxTokens
    this.scanLastN = scanLastN
  }

  buildInjection(index: RepoIndex, messages: Message[]): string {
    const inFocus = this.detectInFocusFiles(index, messages)
    if (inFocus.size === 0) return ''

    const sections: string[] = []
    let tokenBudget = this.maxTokens

    // Active files section
    const activeLines: string[] = ['## Active files']
    for (const absPath of inFocus) {
      const skeleton = index.skeletons.get(absPath)
      if (!skeleton) continue
      const rel = relative(this.projectRoot, absPath)
      const entry = `### ${rel}\n${skeleton}`
      if (estimateTokens(entry) > tokenBudget) continue
      activeLines.push(entry)
      tokenBudget -= estimateTokens(entry)
    }
    sections.push(activeLines.join('\n'))

    // Dependencies section
    const depPaths = new Set<string>()
    for (const absPath of inFocus) {
      for (const dep of index.deps.get(absPath) ?? []) {
        if (!inFocus.has(dep)) depPaths.add(dep)
      }
    }

    if (depPaths.size > 0) {
      const depLines: string[] = ['## Direct dependencies']
      for (const dep of depPaths) {
        const skeleton = index.skeletons.get(dep)
        if (!skeleton) continue
        const rel = relative(this.projectRoot, dep)
        const entry = `### ${rel}\n${skeleton}`
        if (estimateTokens(entry) > tokenBudget) continue
        depLines.push(entry)
        tokenBudget -= estimateTokens(entry)
      }
      sections.push(depLines.join('\n'))
    }

    const body = sections.join('\n\n')
    return `<dep-context>\n${body}\n</dep-context>`
  }

  private detectInFocusFiles(index: RepoIndex, messages: Message[]): Set<string> {
    const recent = messages.slice(-this.scanLastN)
    const mentioned = new Set<string>()

    for (const msg of recent) {
      const text = textContent(msg)
      for (const match of text.matchAll(FILE_PATH_RE)) {
        mentioned.add(match[1])
      }
    }

    // Match mentioned relative/partial paths to absolute paths in index
    const inFocus = new Set<string>()
    for (const absPath of index.skeletons.keys()) {
      const rel = relative(this.projectRoot, absPath)
      for (const mention of mentioned) {
        if (rel.endsWith(mention) || rel === mention || absPath.endsWith(mention)) {
          inFocus.add(absPath)
        }
      }
    }

    return inFocus
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/context-injector.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context-injector.ts tests/context-injector.test.ts
git commit -m "feat: implement ContextInjector"
```

---

## Task 10: Extension entry point

**Files:**
- Create: `src/index.ts`

This file wires everything together as a pi extension. It:
1. On `session_start` — runs `IndexEngine.build()`, generates the repo map, stores it
2. On `before_agent_start` — appends repo map (first turn) + dep context (every turn) to system prompt

- [ ] **Step 1: Create `src/index.ts`**

```typescript
import { IndexEngine } from './index-engine.js'
import { RepoMapGenerator } from './repo-map-generator.js'
import { ContextInjector } from './context-injector.js'
import { DEFAULT_CONFIG } from './types.js'
import type { SmartContextConfig } from './types.js'

// pi extension factory — called by pi's extension loader
export default async function smartContextExtension(api: {
  on: (event: string, handler: (...args: unknown[]) => unknown) => void
  registerFlag: (name: string, opts: { type: string; default: unknown; description: string }) => void
}): Promise<void> {
  // Register config flags so users can override via pi config
  api.registerFlag('smart-context.enabled', {
    type: 'boolean',
    default: DEFAULT_CONFIG.enabled,
    description: 'Enable smart context injection',
  })
  api.registerFlag('smart-context.maxRepoMapTokens', {
    type: 'number',
    default: DEFAULT_CONFIG.maxRepoMapTokens,
    description: 'Token budget for global repo map',
  })
  api.registerFlag('smart-context.maxInjectionTokens', {
    type: 'number',
    default: DEFAULT_CONFIG.maxInjectionTokens,
    description: 'Token budget for per-turn dependency injection',
  })

  let repoMap = ''
  let engine: IndexEngine | null = null
  let injector: ContextInjector | null = null
  let repoMapInjected = false

  api.on('session_start', async (event: unknown) => {
    const ctx = event as { cwd?: string; flags?: Record<string, unknown> }
    const projectRoot = ctx.cwd ?? process.cwd()
    const flags = ctx.flags ?? {}

    const config: SmartContextConfig = {
      ...DEFAULT_CONFIG,
      enabled: (flags['smart-context.enabled'] as boolean | undefined) ?? DEFAULT_CONFIG.enabled,
      maxRepoMapTokens: (flags['smart-context.maxRepoMapTokens'] as number | undefined) ?? DEFAULT_CONFIG.maxRepoMapTokens,
      maxInjectionTokens: (flags['smart-context.maxInjectionTokens'] as number | undefined) ?? DEFAULT_CONFIG.maxInjectionTokens,
    }

    if (!config.enabled) return

    engine = new IndexEngine(projectRoot, config)
    await engine.build()

    const mapGen = new RepoMapGenerator(projectRoot, config.maxRepoMapTokens)
    repoMap = mapGen.generate(engine.getRepoIndex())
    repoMapInjected = false

    injector = new ContextInjector(projectRoot, config.maxInjectionTokens, config.scanLastNMessages)
  })

  api.on('before_agent_start', (event: unknown) => {
    if (!engine || !injector) return undefined

    const e = event as {
      systemPrompt: string
      systemPromptOptions?: unknown
      messages?: Array<{ role: string; content: unknown }>
    }

    let systemPrompt = e.systemPrompt

    // Inject repo map once per session
    if (!repoMapInjected && repoMap) {
      systemPrompt = systemPrompt + '\n\n' + repoMap
      repoMapInjected = true
    }

    // Inject per-turn dependency context
    const messages = (e.messages ?? []) as Array<{ role: string; content: string }>
    const depContext = injector.buildInjection(engine.getRepoIndex(), messages)
    if (depContext) {
      systemPrompt = systemPrompt + '\n\n' + depContext
    }

    return { systemPrompt }
  })
}
```

- [ ] **Step 2: Verify the full test suite passes**

```bash
npm test
```

Expected: all tests PASS across all test files.

- [ ] **Step 3: Build the package**

```bash
npm run build
```

Expected: `dist/` directory created with compiled JS and `.d.ts` files, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: implement pi extension entry point"
```

- [ ] **Step 5: Manual integration test**

To test the extension in a real pi session:
1. Add `"@pi/smart-context": "file:../pi-smart-context"` to the target project's `package.json` dependencies
2. Add the extension to the pi config:
   ```json
   {
     "extensions": ["@pi/smart-context"]
   }
   ```
3. Start a pi session in a TypeScript project
4. Ask: "What files exist in the src directory?" — the LLM should reference the repo map
5. Ask: "Edit src/foo.ts" — the system prompt should contain `<dep-context>` with foo's deps
6. Verify in pi's debug output or by asking the LLM to summarize the context it received

---

## Self-Review Checklist

- [x] **Spec coverage:** All 5 components from spec implemented (DiskCache, LanguageParser ×3, IndexEngine, RepoMapGenerator, ContextInjector). Extension entry point registers `before_agent_start` and `session_start`. Token budget guards present in both RepoMapGenerator and ContextInjector. `.pi-cache/` atomic write implemented.
- [x] **No placeholders:** All steps contain actual code.
- [x] **Type consistency:** `FileIndex`, `RepoIndex`, `SmartContextConfig` defined in Task 2, used consistently across all tasks. `LanguageParser` interface defined in Task 4, implemented in Tasks 4-6, consumed in Task 7. `RepoIndex` produced by `IndexEngine.getRepoIndex()` consumed by `RepoMapGenerator.generate()` and `ContextInjector.buildInjection()`.
