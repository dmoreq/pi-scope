/**
 * AutoCompactor — compresses long conversation transcripts by
 * applying pruning rules and summarizing older turns.
 *
 * Usage:
 * ```typescript
 * const compactor = new AutoCompactor();
 * const compacted = await compactor.compact(messages, pluginManager);
 * ```
 */

import type { PluginManager } from '../shared/plugin-manager.js';
import { applyPruningRules, DEFAULT_RULE_CONFIG } from '../plugins/pruning-rules.js';
import { getTelemetry } from 'pi-telemetry';

// ── Message Types ─────────────────────────────────────────────────────────

interface Message {
  role?: string;
  content?: unknown;
  [key: string]: unknown;
}

// ── AutoCompactor ─────────────────────────────────────────────────────────

export class AutoCompactor {
  /**
   * Compact messages by applying pruning rules and optionally
   * summarizing older turns.
   *
   * @param messages    - Array of context messages (modified in-place)
   * @param pluginManager - PluginManager to run context plugins
   * @param maxMessages   - Optional hard limit on message count
   */
  async compact(
    messages: Message[],
    pluginManager: PluginManager,
    maxMessages?: number,
  ): Promise<void> {
    if (messages.length < 2) return;

    const before = messages.length;

    // Apply pruning rules via plugin system
    await pluginManager.runHook('onContext', messages);

    // If still too long, apply core pruning rules as a second pass
    const { pruned, removed } = applyPruningRules(messages as any, DEFAULT_RULE_CONFIG);
    if (removed > 0) {
      messages.length = 0;
      messages.push(...pruned);
    }

    // Apply hard message limit (compress oldest turns)
    if (maxMessages && messages.length > maxMessages) {
      // Keep the last maxMessages messages
      const trimmed = messages.slice(messages.length - maxMessages);
      messages.length = 0;
      messages.push(...trimmed);
    }

    const after = messages.length;

    // Record telemetry
    try {
      getTelemetry()?.recordToolInvocation('pi-slim', 'auto-compact');
      getTelemetry()?.recordToolResult('pi-slim', 'auto-compact', 0, false);
    } catch {
      // Telemetry is best-effort
    }

    if (before > after) {
      console.error(`[auto-compact] Compacted ${before} \u2192 ${after} messages (-${before - after})`);
    }
  }

  /**
   * Get a human-readable compact instruction string for prompts.
   */
  getCompactInstructions(customInstructions?: string): string {
    const lines = [
      '## Compact Instructions',
      '',
      'The following messages contain conversation history.',
      'Please summarize these messages concisely while preserving:',
      '  - Key decisions and their rationale',
      '  - File paths that were modified',
      '  - Open tasks or unresolved issues',
      '  - Error messages and how they were resolved',
    ];

    if (customInstructions) {
      lines.push('');
      lines.push(customInstructions);
    }

    return lines.join('\n');
  }
}
