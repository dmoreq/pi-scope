import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildHashlineAnchorBlock, contentHasHashlineAnchors } from '../../context/hashline-inject.js'
import { initHash } from '../../hashline/line-hash.js'

describe('buildHashlineAnchorBlock', () => {
  let root: string
  let filePath: string

  beforeEach(async () => {
    await initHash()
    root = join(tmpdir(), `pi-scope-hashline-inject-${Date.now()}`)
    await mkdir(root, { recursive: true })
    filePath = join(root, 'foo.ts')
    await writeFile(filePath, 'const a = 1\nconst b = 2\nconst c = 3\n')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns null when disabled', () => {
    const block = buildHashlineAnchorBlock(filePath, root, {
      enabled: false,
      maxLinesPerFile: 80,
      recordOnRead: false,
    })
    expect(block).toBeNull()
  })

  it('includes anchors and hashline-read hint when enabled', () => {
    const block = buildHashlineAnchorBlock(filePath, root, {
      enabled: true,
      maxLinesPerFile: 2,
      recordOnRead: false,
    })
    expect(block).not.toBeNull()
    expect(block).toContain('Hashline anchors')
    expect(block).toContain('hashline_read')
    expect(block).toMatch(/\d+[a-z]{2}\|/)
  })

  it('reads only the configured anchor window', async () => {
    const bigPath = join(root, 'big.ts')
    const lines = Array.from({ length: 200 }, (_, i) => `const line${i + 1} = ${i + 1}`)
    await writeFile(bigPath, lines.join('\n'), 'utf-8')

    const block = buildHashlineAnchorBlock(bigPath, root, {
      enabled: true,
      maxLinesPerFile: 3,
      recordOnRead: true,
    })

    expect(block).toContain('lines 1–3')
    expect(block).toContain('line1')
    expect(block).toContain('line3')
    expect(block).not.toContain('line4')
    expect(block).not.toContain('line200')
  })

  it('centers bounded windows around region hints', async () => {
    const bigPath = join(root, 'region.ts')
    const lines = Array.from({ length: 60 }, (_, i) => `const regionLine${i + 1} = ${i + 1}`)
    await writeFile(bigPath, lines.join('\n'), 'utf-8')

    const block = buildHashlineAnchorBlock(bigPath, root, {
      enabled: true,
      maxLinesPerFile: 5,
      recordOnRead: false,
      annotateRangePaddingLines: 2,
      regionHints: new Map([[bigPath, { startLine: 30, endLine: 30 }]]),
    })

    expect(block).toContain('around citation 30')
    expect(block).toContain('regionLine28')
    expect(block).toContain('regionLine32')
    expect(block).not.toContain('regionLine27')
    expect(block).not.toContain('regionLine33')
  })

  it('contentHasHashlineAnchors detects anchor lines', () => {
    expect(contentHasHashlineAnchors('1tz|import x')).toBe(true)
    expect(contentHasHashlineAnchors('plain text')).toBe(false)
  })
})
