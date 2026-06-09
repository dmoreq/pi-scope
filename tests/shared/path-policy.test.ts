import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPathPolicy, hasParserSupport, isSupportedSourcePath } from '../../shared/path-policy.js'

describe('path policy', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pi-path-policy-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('allows normal project files', () => {
    const policy = createPathPolicy(root)
    const resolved = policy.resolveProjectFile('src/app.ts')
    expect(resolved.ok).toBe(true)
    if (resolved.ok) {
      expect(resolved.absPath).toBe(resolve(root, 'src/app.ts'))
      expect(resolved.relPath).toBe('src/app.ts')
    }
  })

  it('rejects paths outside the project root', () => {
    const policy = createPathPolicy(root)
    const resolved = policy.resolveProjectFile('../outside.ts')
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.reason).toContain('escapes project root')
  })

  it('ignores common temporary and generated directories', () => {
    const policy = createPathPolicy(root)
    for (const rel of [
      '.pi',
      '.pi/pi-scope/index.json.gz',
      '.venv',
      '.venv/lib/site-packages/pkg.py',
      '__pycache__/module.pyc',
      '.pytest_cache/v/cache/nodeids',
      'coverage/lcov.info',
      '.next/server/app.js',
      'target/debug/app',
      'tmp/generated.ts',
    ]) {
      expect(policy.shouldIgnore(rel), rel).toBe(true)
    }
  })

  it('respects .gitignore entries', async () => {
    await writeFile(join(root, '.gitignore'), 'generated/\n*.snap\n', 'utf-8')
    const policy = createPathPolicy(root)
    expect(policy.shouldIgnore('generated/out.ts')).toBe(true)
    expect(policy.shouldIgnore('src/view.snap')).toBe(true)
  })

  it('separates source-like files from parser-supported files', () => {
    expect(isSupportedSourcePath('src/app.go')).toBe(true)
    expect(hasParserSupport('src/app.go')).toBe(false)
    expect(hasParserSupport('src/app.ts')).toBe(true)
  })
})
