/**
 * AutoRecapper — generates session recap summaries.
 *
 * When triggered, builds a condensed summary of recent activity
 * that can be used for handoff between sessions or quick reference.
 *
 * Usage:
 * ```typescript
 * const recapper = new AutoRecapper();
 * const recap = await recapper.recap(messages, 'recap-hint');
 * ```
 */

import { getTelemetry } from 'pi-telemetry';

// ── Message Types ─────────────────────────────────────────────────────────

interface Message {
  role?: string;
  content?: unknown;
  [key: string]: unknown;
}

// ── AutoRecapper ──────────────────────────────────────────────────────────

export class AutoRecapper {
  /**
   * Generate a session recap.
   *
   * @param messages - Session messages to summarize
   * @param trigger  - The trigger that initiated this recap (for telemetry)
   * @returns A recap text summary
   */
  async recap(messages: Message[], trigger: string): Promise<string> {
    const messageCount = messages.length;

    // Count tool calls
    let toolCalls = 0;
    const toolNames = new Set<string>();
    for (const msg of messages) {
      if ((msg as any).toolName) {
        toolCalls++;
        toolNames.add((msg as any).toolName);
      }
    }

    // Count file paths mentioned
    const filePaths = new Set<string>();
    for (const msg of messages) {
      const content = typeof msg.content === 'string' ? msg.content : '';
      const matches = content.match(/[\w./-]+\.[a-z]+/g);
      if (matches) {
        for (const m of matches) {
          if (m.includes('/') || m.includes('.')) {
            filePaths.add(m);
          }
        }
      }
    }

    // Build recap summary
    const lines: string[] = [
      '## Session Recap',
      '',
      `Messages: ${messageCount}`,
      `Tool calls: ${toolCalls} (${Array.from(toolNames).sort().join(', ')})`,
      `Files referenced: ${filePaths.size}`,
      `Trigger: ${trigger}`,
    ];

    if (filePaths.size > 0) {
      lines.push('');
      lines.push('### Files');
      for (const f of Array.from(filePaths).sort().slice(0, 20)) {
        lines.push(`- \`${f}\``);
      }
      if (filePaths.size > 20) {
        lines.push(`- ... and ${filePaths.size - 20} more`);
      }
    }

    // Record telemetry
    try {
      getTelemetry()?.recordToolInvocation('pi-slim', 'auto-recap');
      getTelemetry()?.recordToolResult('pi-slim', 'auto-recap', 0, false);
    } catch {
      // Telemetry is best-effort
    }

    return lines.join('\n');
  }

  /**
   * Build a handoff context string for transferring context to a new session.
   *
   * @param messages - Session messages to summarize for handoff
   * @param goal     - The goal or task being worked on
   * @returns Handoff context text
   */
  async buildHandoffContext(messages: Message[], goal: string): Promise<string> {
    const recap = await this.recap(messages, 'handoff');

    const lines: string[] = [
      '# Context Handoff',
      '',
      `## Goal: ${goal}`,
      '',
      recap,
      '',
      '---',
      'This handoff was automatically generated. Review and adjust as needed.',
    ];

    return lines.join('\n');
  }
}
