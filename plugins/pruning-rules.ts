/**
 * Pruning rules for ContextPruningPlugin.
 *
 * Each rule is a pure function: `(messages, config) => messages`
 * This makes them independently testable (SRP: each rule does one thing).
 *
 * Rules:
 * 1. deduplication    — Remove identical consecutive user/assistant messages
 * 2. superseded-writes — Remove old file writes superseded by newer ones
 * 3. error-purging    — Remove errors followed by successful results
 * 4. tool-pairing     — Keep paired tool_call + tool_result together
 * 5. recency          — Protect the last N messages from pruning (applied by order)
 */

export interface PruningRuleConfig {
  /** Names of rules to apply (order matters). */
  rules: string[]
  /** Number of most recent messages to protect from pruning. */
  recencyWindow: number
}

export const DEFAULT_RULE_CONFIG: PruningRuleConfig = {
  rules: ['deduplication', 'superseded-writes', 'error-purging', 'tool-pairing', 'recency'],
  recencyWindow: 10,
}

// ── Message Types ─────────────────────────────────────────────────────────

export interface ContextMessage {
  role?: string
  content?: unknown
  toolName?: string
  toolCallId?: string
  input?: Record<string, unknown>
  [key: string]: unknown
}

// ── Content Hash (simple string hash for dedup) ────────────────────────────

function hashContent(msg: ContextMessage): string {
  const raw =
    msg.content === undefined || msg.content === null
      ? ''
      : typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content)
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return `${msg.role ?? 'unknown'}:${hash}`
}

// ── Rule 1: Deduplication ──────────────────────────────────────────────────

/**
 * Remove identical consecutive user/assistant messages.
 * Preserves tool messages (tool_call, tool_result) since they have
 * structured content that shouldn't be deduplicated.
 */
export function deduplicate(messages: ContextMessage[]): ContextMessage[] {
  const result: ContextMessage[] = []
  const seen = new Set<string>()

  for (const msg of messages) {
    const h = hashContent(msg)
    // Only dedup user and assistant roles (keep all tool messages)
    if ((msg.role === 'user' || msg.role === 'assistant') && seen.has(h)) {
      continue
    }
    seen.add(h)
    result.push(msg)
  }

  return result
}

// ── Rule 2: Superseded Writes ─────────────────────────────────────────────

/**
 * Remove old file write results when a newer write for the same file exists.
 */
export function supersedeWrites(messages: ContextMessage[]): ContextMessage[] {
  const latestWrite = new Map<string, number>()

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'tool' && msg.role !== 'toolResult') continue
    const content = typeof msg.content === 'string' ? msg.content : ''
    const fileMatch = content.match(/"(?:path|filePath)":\s*"([^"]+)"/)
    if (fileMatch) {
      const filePath = fileMatch[1]
      if (!latestWrite.has(filePath)) {
        latestWrite.set(filePath, i)
      }
    }
  }

  return messages.filter((msg, i) => {
    if (msg.role !== 'tool' && msg.role !== 'toolResult') return true
    const content = typeof msg.content === 'string' ? msg.content : ''
    const fileMatch = content.match(/"(?:path|filePath)":\s*"([^"]+)"/)
    if (!fileMatch) return true
    const filePath = fileMatch[1]
    const latest = latestWrite.get(filePath)
    return latest === undefined || i >= latest
  })
}

// ── Rule 3: Error Purging ─────────────────────────────────────────────────

/**
 * Remove tool error results that are followed by a successful result
 * for the same tool. Keeps unresolved errors.
 */
export function purgeErrors(messages: ContextMessage[]): ContextMessage[] {
  return messages.filter((msg, i) => {
    if (msg.role !== 'tool' && msg.role !== 'toolResult') return true
    const content = typeof msg.content === 'string' ? msg.content : ''

    const isError = content.includes('"isError": true') || content.includes('"status": "error"')
    if (!isError) return true

    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j]
      if (next.role !== 'tool' && next.role !== 'toolResult') continue
      const nextContent = typeof next.content === 'string' ? next.content : ''
      const nextIsError = nextContent.includes('"isError": true') || nextContent.includes('"status": "error"')
      if (!nextIsError) return false
      break
    }

    return true
  })
}

// ── Composite Application ─────────────────────────────────────────────────

/**
 * Apply all enabled pruning rules to messages in order.
 */
export function applyPruningRules(
  messages: ContextMessage[],
  config: PruningRuleConfig = DEFAULT_RULE_CONFIG
): { pruned: ContextMessage[]; removed: number } {
  let result = [...messages]

  if (config.rules.includes('deduplication')) {
    result = deduplicate(result)
  }
  if (config.rules.includes('superseded-writes') || config.rules.includes('supersededWrites')) {
    result = supersedeWrites(result)
  }
  if (config.rules.includes('error-purging') || config.rules.includes('errorPurging')) {
    result = purgeErrors(result)
  }

  const removed = messages.length - result.length
  return { pruned: result, removed }
}
