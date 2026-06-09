/**
 * Append hashline anchor hints to LSP hover output.
 */

import { relative } from 'node:path'
import { computeLineHash, formatHashLine, initHash } from './line-hash.js'
import { readLineWindow } from '../shared/line-window.js'

let hashlineHoverEnabled = true

export function setHashlineHoverEnabled(enabled: boolean): void {
  hashlineHoverEnabled = enabled
}

export async function appendHashlineHoverSection(
  absPath: string,
  line: number,
  projectRoot: string,
  markdownBody: string
): Promise<string> {
  if (!hashlineHoverEnabled || line < 0) return markdownBody

  await initHash()

  const anchorLineNumber = line + 1
  let lineText: string
  try {
    const window = await readLineWindow(absPath, {
      startLine: anchorLineNumber,
      endLine: anchorLineNumber,
      countTotalLines: false,
    })
    if (window.lines.length === 0) return markdownBody
    lineText = window.lines[0] ?? ''
  } catch {
    return markdownBody
  }

  const anchorLine = formatHashLine(anchorLineNumber, lineText)
  const tag = `${anchorLineNumber}${computeLineHash(anchorLineNumber, lineText)}`
  const rel = relative(projectRoot, absPath)

  return (
    `${markdownBody}\n\n### Hashline anchor\n` +
    `- Cursor line **${anchorLineNumber}**: use anchor \`${tag}\` with \`hashline_edit\` (\`dry_run: true\` first).\n` +
    `- Full context: \`hashline_read\` path=\`${rel}\` start_line=${Math.max(1, anchorLineNumber - 5)} end_line=${anchorLineNumber + 5}\`\n` +
    '```\n' +
    `${anchorLine}\n` +
    '```'
  )
}
