import { createReadStream, closeSync, openSync, readSync } from 'node:fs'
import { createInterface } from 'node:readline'

export interface LineWindowOptions {
  startLine: number
  endLine: number
  countTotalLines?: boolean
}

export interface LineWindowResult {
  lines: string[]
  start: number
  end: number
  totalLines?: number
}

function normalizeBounds(startLine: number, endLine: number): { start: number; end: number } {
  const start = Math.max(1, Math.floor(startLine))
  const end = Math.max(start, Math.floor(endLine))
  return { start, end }
}

export async function readLineWindow(
  absPath: string,
  options: LineWindowOptions
): Promise<LineWindowResult> {
  const { start, end } = normalizeBounds(options.startLine, options.endLine)
  const lines: string[] = []
  let current = 0

  const rl = createInterface({
    input: createReadStream(absPath, { encoding: 'utf-8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  for await (const line of rl) {
    current++
    if (current >= start && current <= end) lines.push(line)
    if (!options.countTotalLines && current >= end) {
      rl.close()
      break
    }
  }

  return {
    lines,
    start,
    end: lines.length > 0 ? start + lines.length - 1 : start,
    ...(options.countTotalLines ? { totalLines: Math.max(current, 1) } : {}),
  }
}

export function readLineWindowSync(absPath: string, startLine: number, endLine: number): string[] {
  const { start, end } = normalizeBounds(startLine, endLine)
  const fd = openSync(absPath, 'r')
  const buffer = Buffer.allocUnsafe(64 * 1024)
  const lines: string[] = []
  let carry = ''
  let current = 1

  try {
    while (current <= end) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, null)
      if (bytesRead === 0) break

      const text = carry + buffer.toString('utf-8', 0, bytesRead)
      const parts = text.split(/\r?\n/)
      carry = parts.pop() ?? ''

      for (const line of parts) {
        if (current >= start && current <= end) lines.push(line)
        current++
        if (current > end) break
      }
    }

    if (carry.length > 0 && current >= start && current <= end) lines.push(carry)
    return lines
  } finally {
    closeSync(fd)
  }
}
