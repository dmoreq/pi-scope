import { describe, expect, it } from 'vitest'
import { RetrievalEngine } from '../../context/retrieval.js'
import type { RepoIndex } from '../../shared/types.js'

// Create a mock index for testing
function createMockIndex(): RepoIndex {
  const skeletons = new Map([
    ['src/auth/service.ts', 'export function authenticate() {...}'],
    ['src/auth/models.ts', 'export class User {...}'],
    ['src/server/app.ts', 'export function startServer() {...}'],
    ['src/database/connection.ts', 'export function connectDB() {...}'],
    ['src/utils/helpers.ts', 'export function validateEmail() {...}'],
  ])

  const deps = new Map([
    ['src/auth/service.ts', new Set(['src/auth/models.ts', 'src/database/connection.ts'])],
    ['src/server/app.ts', new Set(['src/auth/service.ts'])],
  ])

  const reverseDeps = new Map([
    ['src/auth/models.ts', new Set(['src/auth/service.ts'])],
    ['src/database/connection.ts', new Set(['src/auth/service.ts'])],
    ['src/auth/service.ts', new Set(['src/server/app.ts'])],
  ])

  const symbolIndex = new Map([
    ['authenticate', ['src/auth/service.ts']],
    ['User', ['src/auth/models.ts']],
    ['startServer', ['src/server/app.ts']],
    ['connectDB', ['src/database/connection.ts']],
    ['validateEmail', ['src/utils/helpers.ts']],
  ])

  return { skeletons, deps, reverseDeps, symbolIndex }
}

describe('RetrievalEngine', () => {
  const index = createMockIndex()
  const engine = new RetrievalEngine(index)

  it('finds files by exact symbol match', () => {
    const results = engine.retrieveTopK('authenticate user', 5)

    expect(results.length).toBeGreaterThan(0)
    const authFile = results.find(r => r.file.includes('service.ts'))
    expect(authFile).toBeDefined()
    expect(authFile?.score).toBeGreaterThan(0)
    expect(authFile?.signals.some(s => s.startsWith('symbol:'))).toBe(true)
  })

  it('finds files by filename match', () => {
    const results = engine.retrieveTopK('app configuration', 5) // Use 'app' which should only match filename

    const appFile = results.find(r => r.file.includes('app.ts'))
    expect(appFile).toBeDefined()
    expect(appFile?.signals.some(s => s.startsWith('filename:'))).toBe(true)
  })

  it('finds files by short filename substring without scanning all files', () => {
    const dbIndex = createMockIndex()
    dbIndex.skeletons.set('src/database/connectDB.ts', 'export function connect(): void {...}')
    const dbEngine = new RetrievalEngine(dbIndex)

    const results = dbEngine.retrieveTopK('DB', 5)

    const dbFile = results.find(r => r.file === 'src/database/connectDB.ts')
    expect(dbFile).toBeDefined()
    expect(dbFile?.signals).toContain('filename:connectDB')
  })

  it('scores by dependency proximity', () => {
    const activeDeps = new Set(['src/auth/models.ts'])
    const results = engine.retrieveTopK('test query', 5, activeDeps)

    const depFile = results.find(r => r.file === 'src/auth/models.ts')
    expect(depFile).toBeDefined()
    expect(depFile?.signals.includes('dep-proximity')).toBe(true)
  })

  it('ranks results by score (higher first)', () => {
    const results = engine.retrieveTopK('authenticate User startServer', 10)

    // Should have multiple results
    expect(results.length).toBeGreaterThan(1)

    // Should be sorted by score descending
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score)
    }
  })

  it('limits results to k items', () => {
    const results = engine.retrieveTopK('test query with many matches', 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('handles empty queries gracefully', () => {
    const results = engine.retrieveTopK('', 5)
    expect(results).toEqual([])
  })

  it('extracts query tokens correctly', () => {
    const engine = new RetrievalEngine(index)

    // Access private method for testing (TypeScript will warn but it works)
    const extractTokens = (engine as any).extractQueryTokens.bind(engine)

    const tokens = extractTokens('getUserData from authService')
    expect(tokens.has('getuserdata')).toBe(true)
    expect(tokens.has('from')).toBe(true)
    expect(tokens.has('authservice')).toBe(true)
    expect(tokens.has('get')).toBe(true) // camelCase extraction
    expect(tokens.has('user')).toBe(true)
    expect(tokens.has('data')).toBe(true)
  })

  it('retrieves exact matches from large datasets', () => {
    const largeSkeletons = new Map()
    const largeSymbolIndex = new Map()

    // 1000 files, 10 symbols each
    for (let i = 0; i < 1000; i++) {
      const file = `src/file${i}.ts`
      largeSkeletons.set(file, `export function func${i}() {...}`)

      for (let j = 0; j < 10; j++) {
        const symbol = `func${i}_${j}`
        if (!largeSymbolIndex.has(symbol)) {
          largeSymbolIndex.set(symbol, [])
        }
        largeSymbolIndex.get(symbol).push(file)
      }
    }

    const largeIndex: RepoIndex = {
      skeletons: largeSkeletons,
      deps: new Map(),
      reverseDeps: new Map(),
      symbolIndex: largeSymbolIndex,
    }

    const largeEngine = new RetrievalEngine(largeIndex)

    const results = largeEngine.retrieveTopK('func500_5 func200', 20)

    expect(results.length).toBeGreaterThan(0)

    const exactMatch = results.find(r => r.signals.includes('symbol:func500_5'))
    expect(exactMatch).toBeDefined()
  })

  it('does not iterate all skeletons or symbols during query-time lookup', () => {
    const largeSkeletons = new Map<string, string>()
    const largeSymbolIndex = new Map<string, string[]>()

    for (let i = 0; i < 2000; i++) {
      const file = `src/module${i}/target${i}.ts`
      largeSkeletons.set(file, `export function target${i}() {...}`)
      largeSymbolIndex.set(`target${i}`, [file])
      largeSymbolIndex.set(`buildTarget${i}`, [file])
    }

    const largeIndex: RepoIndex = {
      skeletons: largeSkeletons,
      deps: new Map(),
      reverseDeps: new Map(),
      symbolIndex: largeSymbolIndex,
    }
    const largeEngine = new RetrievalEngine(largeIndex)

    largeIndex.skeletons.keys = () => {
      throw new Error('query-time skeleton scan')
    }
    largeIndex.symbolIndex[Symbol.iterator] = () => {
      throw new Error('query-time symbol scan')
    }

    const symbolResults = largeEngine.retrieveTopK('build target1999', 5)
    expect(symbolResults.some(result => result.file === 'src/module1999/target1999.ts')).toBe(true)

    const filenameResults = largeEngine.retrieveTopK('target1500', 5)
    expect(filenameResults.some(result => result.file === 'src/module1500/target1500.ts')).toBe(true)

    expect(largeEngine.findByPathMention('module1234/target1234.ts')).toEqual(['src/module1234/target1234.ts'])
  })
})
