/**
 * `/hashline-read` and shared formatter for `hashline_read` tool.
 */

import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { AnchorStateManager } from '../hashline/state-manager.js'
import { formatHashLines, initHash } from '../hashline/line-hash.js'
import { streamHashLinesFromLines } from '../hashline/streaming.js'
import { createPathPolicy } from '../shared/path-policy.js'

export interface HashlineReadOptions {
  recordOnRead?: boolean
  maxLines?: number
  /** 1-based inclusive start line */
  startLine?: number
  /** 1-based inclusive end line */
  endLine?: number
  /** Use chunked streaming when slice length >= this (default 500). */
  streamAnnotateThresholdLines?: number
  streamChunkLines?: number
}

async function formatAnnotatedSlice(
  lines: string[],
  startLine: number,
  options: HashlineReadOptions
): Promise<{ body: string; chunked: boolean; chunkCount: number }> {
  const threshold = options.streamAnnotateThresholdLines ?? 500
  if (lines.length < threshold) {
    return {
      body: formatHashLines(lines.join('\n'), startLine),
      chunked: false,
      chunkCount: 1,
    }
  }

  const chunks: string[] = []
  for await (const chunk of streamHashLinesFromLines(lines, {
    startLine,
    maxChunkLines: options.streamChunkLines ?? 200,
  })) {
    chunks.push(chunk)
  }

  return {
    body: chunks.join('\n'),
    chunked: true,
    chunkCount: chunks.length,
  }
}

function resolveSliceBounds(
  totalLines: number,
  options: HashlineReadOptions
): { start: number; end: number; label: string } {
  const start1 = options.startLine != null ? Math.max(1, Math.min(options.startLine, totalLines)) : 1
  let end1 =
    options.endLine != null
      ? Math.max(start1, Math.min(options.endLine, totalLines))
      : options.maxLines != null
        ? Math.min(totalLines, start1 + options.maxLines - 1)
        : totalLines

  if (options.startLine == null && options.endLine == null && options.maxLines != null) {
    end1 = Math.min(totalLines, options.maxLines)
  }

  return {
    start: start1,
    end: end1,
    label:
      start1 === 1 && end1 === totalLines
        ? `lines 1–${totalLines}`
        : `lines ${start1}–${end1} of ${totalLines}`,
  }
}

async function readLineWindow(
  absPath: string,
  options: HashlineReadOptions
): Promise<{ lines: string[]; totalLines: number; start: number; end: number }> {
  const requestedStart = options.startLine != null ? Math.max(1, options.startLine) : 1
  const requestedEnd =
    options.endLine != null
      ? Math.max(requestedStart, options.endLine)
      : options.maxLines != null
        ? requestedStart + options.maxLines - 1
        : Number.POSITIVE_INFINITY

  const lines: string[] = []
  let totalLines = 0
  const rl = createInterface({
    input: createReadStream(absPath, { encoding: 'utf-8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  for await (const line of rl) {
    totalLines++
    if (totalLines >= requestedStart && totalLines <= requestedEnd) {
      lines.push(line)
    }
  }

  const boundedTotal = Math.max(totalLines, 1)
  const start = Math.max(1, Math.min(requestedStart, boundedTotal))
  const end = lines.length ? start + lines.length - 1 : start
  return { lines, totalLines: boundedTotal, start, end }
}

export async function formatHashlineRead(
  projectRoot: string,
  fileArg: string,
  options: HashlineReadOptions = {}
): Promise<string> {
  const trimmed = fileArg.trim()
  if (!trimmed) {
    return 'Usage: /hashline-read <path> [start] [end]\nExample: /hashline-read src/auth.ts 40 60'
  }

  await initHash()
  const resolved = createPathPolicy(projectRoot).resolveProjectFile(trimmed)
  if (!resolved.ok) {
    return `Could not read file: ${trimmed}\n${resolved.reason}`
  }

  const shouldStreamWindow = options.startLine != null || options.endLine != null || options.maxLines != null
  let lines: string[]
  let totalLines: number
  let start: number
  let end: number
  let label: string
  let recorded = false

  try {
    if (shouldStreamWindow) {
      const window = await readLineWindow(resolved.absPath, options)
      lines = window.lines
      totalLines = window.totalLines
      start = window.start
      end = window.end
      label = start === 1 && end === totalLines ? `lines 1–${totalLines}` : `lines ${start}–${end} of ${totalLines}`
    } else {
      const raw = await readFile(resolved.absPath, 'utf-8')
      if (options.recordOnRead !== false) {
        AnchorStateManager.record(resolved.absPath, raw)
        recorded = true
      }

      const rawLines = raw.split('\n')
      const bounds = resolveSliceBounds(rawLines.length, options)
      lines = rawLines.slice(bounds.start - 1, bounds.end)
      totalLines = rawLines.length
      start = bounds.start
      end = bounds.end
      label = bounds.label
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Could not read file: ${trimmed}\n${msg}`
  }

  const { body: annotated, chunked, chunkCount } = await formatAnnotatedSlice(lines, start, options)

  const header = [
    `## Hashline read: ${trimmed}`,
    `${totalLines} line(s) — showing ${label}.`,
    shouldStreamWindow && options.recordOnRead !== false && !recorded
      ? 'Anchor state was not recorded for this ranged read; `hashline_edit` will validate against the current file.'
      : null,
    chunked ? `Large slice (${lines.length} lines) — streamed in ${chunkCount} anchor chunk(s).` : null,
    'Edit with `hashline_edit` using anchors like `42nd` (line + bigram). Use `dry_run: true` to preview.',
    '',
    '```',
    annotated,
    '```',
  ].filter((line): line is string => line != null)

  if (end < totalLines) {
    header.push(
      '',
      `_(File continues to line ${totalLines}. Use \`hashline_read\` with start_line/end_line or \`/hashline-read ${trimmed} <start> <end>\`.)_`
    )
  }

  return header.join('\n')
}

/** Parse `/hashline-read path [start] [end]` command args. */
export function parseHashlineReadArgs(args: string): HashlineReadOptions & { path: string } {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const path = parts[0] ?? ''
  const startLine = parts[1] ? Number.parseInt(parts[1], 10) : undefined
  const endLine = parts[2] ? Number.parseInt(parts[2], 10) : undefined
  return {
    path,
    startLine: Number.isFinite(startLine) && startLine! > 0 ? startLine : undefined,
    endLine: Number.isFinite(endLine) && endLine! > 0 ? endLine : undefined,
    recordOnRead: true,
  }
}

export function formatHashlineReadFromArgs(
  projectRoot: string,
  args: string,
  recordOnRead: boolean,
  streamOptions?: Pick<HashlineReadOptions, 'streamAnnotateThresholdLines' | 'streamChunkLines'>
): Promise<string> {
  const parsed = parseHashlineReadArgs(args)
  if (!parsed.path) {
    return Promise.resolve('Usage: /hashline-read <path> [startLine] [endLine]\nExample: /hashline-read src/auth.ts 40 60')
  }
  return formatHashlineRead(projectRoot, parsed.path, {
    startLine: parsed.startLine,
    endLine: parsed.endLine,
    recordOnRead,
    ...streamOptions,
  })
}
