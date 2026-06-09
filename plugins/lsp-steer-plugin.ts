/**
 * Steer manual grep/read navigation toward LSP tools when servers are available.
 */

import { resolve } from 'node:path'
import { extractToolPath } from '../context/hashline-inject.js'
import type { SessionState } from '../manager.js'
import type { Plugin, PluginToolCallResult } from './plugin.js'

const GREP_TOOLS = new Set(['grep', 'rg', 'ripgrep', 'search', 'codebase_search'])

function pathIsIndexed(state: SessionState, filePath: string): boolean {
  const abs = resolve(state.projectRoot, filePath)
  if (state.index.skeletons.has(abs)) return true
  for (const key of state.index.skeletons.keys()) {
    if (key.endsWith(filePath) || key.endsWith('/' + filePath)) return true
  }
  return false
}

function readLooksLikeNavigation(input: Record<string, unknown> | undefined): boolean {
  if (!input) return false
  for (const key of ['offset', 'start_line', 'line', 'startLine', 'line_number']) {
    if (input[key] != null) return true
  }
  return false
}

export class LspSteerPlugin implements Plugin {
  readonly name = 'lsp-steer'
  readonly version = '1.0.0'

  constructor(private readonly getState: () => SessionState | null) {}

  async onToolCall(event: {
    toolName: string
    input: Record<string, unknown> | undefined
  }): Promise<PluginToolCallResult | undefined> {
    const state = this.getState()
    if (!state?.config.lsp.enabled || !state.config.lsp.steerFromManualSearch) {
      return undefined
    }

    const tool = event.toolName.toLowerCase()
    const path = extractToolPath(event.input)

    if (GREP_TOOLS.has(tool)) {
      const reason =
        '`lsp_go_to_definition` or `lsp_find_references` is recommended over text search for navigating symbols in indexed files.'
      if (state.config.lsp.strictNavigation) {
        return { allowed: false, reason }
      }
      return { allowed: true, reason }
    }

    if (tool === 'read' && path && pathIsIndexed(state, path) && readLooksLikeNavigation(event.input)) {
      const reason =
        `You can use \`lsp_hover\` on \`${path}\` to inspect type definitions and codebase impact at a specific line/column.`
      if (state.config.lsp.strictNavigation) {
        return { allowed: false, reason }
      }
      return { allowed: true, reason }
    }

    return undefined
  }
}
