import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readLineWindow, readLineWindowSync } from '../../shared/line-window.js'

describe('line window readers', () => {
  let root: string
  let filePath: string

  beforeEach(async () => {
    root = join(tmpdir(), `pi-line-window-${Date.now()}`)
    await mkdir(root, { recursive: true })
    filePath = join(root, 'sample.txt')
    await writeFile(filePath, 'one\r\ntwo\r\nthree\r\nfour\r\n', 'utf-8')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reads an async bounded line window without requiring total lines', async () => {
    const result = await readLineWindow(filePath, { startLine: 2, endLine: 3 })

    expect(result).toEqual({
      lines: ['two', 'three'],
      start: 2,
      end: 3,
    })
  })

  it('counts total lines only when requested', async () => {
    const result = await readLineWindow(filePath, {
      startLine: 2,
      endLine: 3,
      countTotalLines: true,
    })

    expect(result.lines).toEqual(['two', 'three'])
    expect(result.totalLines).toBe(4)
  })

  it('reads a sync bounded line window', () => {
    expect(readLineWindowSync(filePath, 1, 2)).toEqual(['one', 'two'])
  })
})
