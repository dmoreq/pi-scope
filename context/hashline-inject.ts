/**
 * Inject hashline anchor snippets into dep-context for in-focus files.
 */

import { closeSync, openSync, readSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { formatHashLines } from '../hashline/line-hash.js'
import type { LineRegionHint } from './hashline-region.js'
import { estimateTokens } from '../shared/token.js'

export interface HashlineInjectOptions {
  enabled: boolean
  maxLinesPerFile: number
  recordOnRead: boolean
  annotateBySymbolRange?: boolean
  annotateRangePaddingLines?: number
  /** absPath → region from citations / tool refs */
  regionHints?: Map<string, LineRegionHint>
}

export const HASHLINE_ANCHOR_LINE_RE = /\b\d+[a-z]{2}\|/

export function contentHasHashlineAnchors(text: string): boolean {
  return HASHLINE_ANCHOR_LINE_RE.test(text)
}

interface AnchorWindow {
  lines: string[]
  start: number
  end: number
  label: string
}

function resolveRequestedBounds(
  opts: HashlineInjectOptions,
  region?: LineRegionHint
): { start: number; end: number; label: string } {
  const padding = opts.annotateRangePaddingLines ?? 15
  const maxLines = Math.max(1, opts.maxLinesPerFile)

  if (opts.annotateBySymbolRange !== false && region) {
    const paddedStart = Math.max(1, region.startLine - padding)
    const paddedEnd = Math.max(paddedStart, region.endLine + padding)
    const span = paddedEnd - paddedStart + 1
    if (span > maxLines) {
      const center = Math.floor((paddedStart + paddedEnd) / 2)
      const half = Math.floor(maxLines / 2)
      const start = Math.max(1, center - half)
      const end = start + maxLines - 1
      return {
        start,
        end,
        label: `lines ${start}–${end} (around citation ${region.startLine})`,
      }
    }
    return {
      start: paddedStart,
      end: paddedEnd,
      label: `lines ${paddedStart}–${paddedEnd} (around citation ${region.startLine})`,
    }
  }

  const end = maxLines
  return { start: 1, end, label: `lines 1–${end}` }
}

function readLineWindowSync(absPath: string, startLine: number, endLine: number): string[] {
  const fd = openSync(absPath, 'r')
  const buffer = Buffer.allocUnsafe(64 * 1024)
  const lines: string[] = []
  let carry = ''
  let currentLine = 1

  try {
    while (currentLine <= endLine) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, null)
      if (bytesRead === 0) break

      const text = carry + buffer.toString('utf-8', 0, bytesRead)
      const parts = text.split(/\r?\n/)
      carry = parts.pop() ?? ''

      for (const line of parts) {
        if (currentLine >= startLine && currentLine <= endLine) {
          lines.push(line)
        }
        currentLine++
        if (currentLine > endLine) break
      }
    }

    if (carry.length > 0 && currentLine >= startLine && currentLine <= endLine) {
      lines.push(carry)
    }

    return lines
  } finally {
    closeSync(fd)
  }
}

function readAnchorWindow(absPath: string, opts: HashlineInjectOptions): AnchorWindow | null {
  const region = opts.regionHints?.get(absPath)
  const bounds = resolveRequestedBounds(opts, region)
  if (bounds.end < bounds.start) return null

  const lines = readLineWindowSync(absPath, bounds.start, bounds.end)
  if (lines.length === 0) return null

  const actualEnd = bounds.start + lines.length - 1
  const label = actualEnd === bounds.end ? bounds.label : bounds.label.replace(`–${bounds.end}`, `–${actualEnd}`)
  return { lines, start: bounds.start, end: actualEnd, label }
}

/**
 * Build a fenced hashline block (sync; requires initHash at session start).
 */
export function buildHashlineAnchorBlock(
  absPath: string,
  projectRoot: string,
  opts: HashlineInjectOptions
): string | null {
  if (!opts.enabled) return null

  try {
    const window = readAnchorWindow(absPath, opts)
    if (!window) return null

    const annotated = formatHashLines(window.lines.join('\n'), window.start)
    const rel = relative(projectRoot, absPath)
    return (
      `#### Hashline anchors (${window.label})\n` +
      `Use \`LINE+bigram\` refs with \`hashline_edit\` (\`dry_run: true\` first). ` +
      `Full file or range: \`hashline_read\` or \`/hashline-read ${rel}\`.\n` +
      '```\n' +
      `${annotated}\n` +
      '```'
    )
  } catch {
    return null
  }
}

export function appendHashlineToEntry(
  entry: string,
  absPath: string,
  projectRoot: string,
  opts: HashlineInjectOptions,
  tokenBudget: number
): { entry: string; cost: number; hasAnchors: boolean } {
  const block = buildHashlineAnchorBlock(absPath, projectRoot, opts)
  if (!block) return { entry, cost: estimateTokens(entry), hasAnchors: false }

  const combined = `${entry}\n\n${block}`
  const cost = estimateTokens(combined)
  if (cost > tokenBudget) return { entry, cost: estimateTokens(entry), hasAnchors: false }

  return { entry: combined, cost, hasAnchors: true }
}

/** Resolve a tool path against project root when relative. */
export function resolveProjectPath(projectRoot: string, filePath: string): string {
  return resolve(projectRoot, filePath)
}

/** Extract file path from common built-in read/edit tool inputs. */
export function extractToolPath(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined
  for (const key of ['path', 'filePath', 'file', 'target', 'file_path', 'relativePath']) {
    const v = input[key]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return undefined
}
