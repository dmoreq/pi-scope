import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GraphService } from '../../services/graph-service'
import type { RepoIndex } from '../../shared/types'

let cacheDir: string

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'pi-graph-fingerprint-'))
})

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true })
})

function makeIndex(projectRoot: string, variant: 'auth-to-db' | 'db-to-auth'): RepoIndex {
  const authPath = join(projectRoot, 'auth.ts')
  const dbPath = join(projectRoot, 'db.ts')
  const deps =
    variant === 'auth-to-db'
      ? new Map([[authPath, new Set([dbPath])]])
      : new Map([[dbPath, new Set([authPath])]])

  return {
    skeletons: new Map([
      [authPath, 'export function authenticate() {}'],
      [dbPath, 'export function query() {}'],
    ]),
    deps,
    reverseDeps: new Map(),
    symbolIndex: new Map(
      variant === 'auth-to-db'
        ? [
            [authPath, ['authenticate']],
            [dbPath, ['query']],
          ]
        : [
            [authPath, ['authorize']],
            [dbPath, ['lookup']],
          ]
    ),
  }
}

describe('graph cache fingerprint', () => {
  it('misses cache when dependency and symbol structure changes with identical counts', async () => {
    const projectRoot = '/tmp/pi-scope-project'
    const first = new GraphService()
    const firstResult = await first.analyzeFromIndex(makeIndex(projectRoot, 'auth-to-db'), projectRoot, cacheDir)

    expect(firstResult.cacheHit).toBe(false)

    const second = new GraphService()
    const secondResult = await second.analyzeFromIndex(makeIndex(projectRoot, 'db-to-auth'), projectRoot, cacheDir)

    expect(secondResult.cacheHit).toBe(false)
    expect(secondResult.graph.edges.some(e => e.source === 'file:db.ts' && e.target === 'file:auth.ts')).toBe(true)
    expect(secondResult.graph.nodes.some(n => n.id === 'file:auth.ts:authorize')).toBe(true)
    expect(secondResult.graph.nodes.some(n => n.id === 'file:auth.ts:authenticate')).toBe(false)
  })
})
