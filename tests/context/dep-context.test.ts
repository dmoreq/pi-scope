import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContextInjector } from '../../context/dep-context.js'
import { RetrievalEngine } from '../../context/retrieval.js'
import type { RepoIndex } from '../../shared/types.js'

const ROOT = '/project'
const FOO = join(ROOT, 'src/foo.ts')
const BAR = join(ROOT, 'src/bar.ts')
const BAZ = join(ROOT, 'src/baz.ts')
const EXT = join(ROOT, 'extension.ts')
const MGR = join(ROOT, 'manager.ts')

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
    reverseDeps: new Map([[BAR, new Set([FOO])]]),
    symbolIndex: new Map([
      ['foo', [FOO]],
      ['bar', [BAR]],
      ['baz', [BAZ]],
    ]),
    ...overrides,
  }
}

function makeOverviewIndex(): RepoIndex {
  return {
    skeletons: new Map([
      [EXT, 'export default function smartContextExtension(pi: ExtensionAPI): void { ... }'],
      [MGR, 'export class SessionManager { ... }'],
      [FOO, 'export function foo(): void { ... }'],
      [BAR, 'export function bar(): string { ... }'],
    ]),
    deps: new Map([
      [EXT, new Set([MGR])],
      [MGR, new Set([FOO, BAR])],
      [FOO, new Set()],
      [BAR, new Set()],
    ]),
    reverseDeps: new Map([
      [MGR, new Set([EXT])],
      [FOO, new Set([MGR])],
      [BAR, new Set([MGR])],
    ]),
    symbolIndex: new Map([
      ['smartContextExtension', [EXT]],
      ['SessionManager', [MGR]],
      ['foo', [FOO]],
      ['bar', [BAR]],
    ]),
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
    expect(result).toContain('bar.ts')
    expect(result).toContain('bar()')
  })

  it('does not duplicate files already in active section', () => {
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Edit src/foo.ts and src/bar.ts' }]
    const result = injector.buildInjection(makeIndex(), messages as never)
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
    const messages = [
      { role: 'user', content: 'Edit src/baz.ts' },
      { role: 'user', content: 'Hello' },
    ]
    const result = injector.buildInjection(makeIndex(), messages as never)
    expect(result).toBe('')
  })

  // ── Broad codebase overview queries ────────────────────────────

  it('injects top files by reverse-dependency centrality for broad codebase queries', () => {
    const index = makeOverviewIndex()
    const retrieval = new RetrievalEngine(index)
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Tell me what does this codebase do' }]
    const result = injector.buildInjection(index, messages as never, undefined, retrieval, 1)
    // Should inject manager.ts (most depended-on: 1 reverse dep) and extension.ts (entry point)
    expect(result).toContain('Codebase Overview')
    expect(result).toContain('manager.ts')
    expect(result).toContain('SessionManager')
  })

  it('injects context for architecture/structure questions', () => {
    const index = makeOverviewIndex()
    const retrieval = new RetrievalEngine(index)
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'How is this project structured?' }]
    const result = injector.buildInjection(index, messages as never, undefined, retrieval, 1)
    expect(result).toContain('Codebase Overview')
    expect(result.length).toBeGreaterThan(0)
  })

  it('injects context for "what is the purpose" queries', () => {
    const index = makeOverviewIndex()
    const retrieval = new RetrievalEngine(index)
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'What is the purpose of this project?' }]
    const result = injector.buildInjection(index, messages as never, undefined, retrieval, 1)
    expect(result).toContain('Codebase Overview')
  })

  it('does NOT inject overview for unrelated queries', () => {
    const index = makeOverviewIndex()
    const retrieval = new RetrievalEngine(index)
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Hello, how are you?' }]
    const result = injector.buildInjection(index, messages as never, undefined, retrieval, 1)
    expect(result).toBe('')
  })

  it('injects entry-point files in overview', () => {
    const index = makeOverviewIndex()
    const retrieval = new RetrievalEngine(index)
    const injector = new ContextInjector(ROOT, 8000, 10)
    const messages = [{ role: 'user', content: 'Show me the main files' }]
    const result = injector.buildInjection(index, messages as never, undefined, retrieval, 1)
    // extension.ts and manager.ts are entry points
    expect(result).toContain('extension.ts')
    expect(result).toContain('manager.ts')
  })
})
