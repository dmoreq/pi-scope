/**
 * Built-in automation triggers for pi-slim.
 *
 * Each trigger monitors session state and generates human-readable
 * suggestions for the user when appropriate conditions are met.
 *
 * Triggers:
 * 1. recap-hint    — Suggest /recap after 20+ messages with 10min cooldown
 * 2. context-warning — Suggest /compact when context window > 80%
 * 3. file-tracking   — Suggest handoff prep when 10+ files modified
 * 4. high-activity   — Suggest recap when 50+ tool calls
 */

import type { AutomationTrigger } from './automation-manager.js';
import type { ExtensionContext } from '../extension.js';

// ── Helper: Get current timestamp for recap eligibility check ─────────────

function minSince(lastTimestamp: number): number {
  return (Date.now() - lastTimestamp) / 60000;
}

// ── Built-in Triggers ─────────────────────────────────────────────────────

export const BUILT_IN_TRIGGERS: AutomationTrigger[] = [
  // ── 1. Recap Hint ─────────────────────────────────────────────────────
  {
    id: 'recap-hint',
    check: (stats: Record<string, unknown>, _ctx: ExtensionContext): string | null => {
      const messageCount = (stats.messageCount as number) ?? 0;
      const lastRecapAt = (stats.lastRecapAt as number) ?? Date.now();

      if (messageCount > 20 && minSince(lastRecapAt) > 10) {
        return `\u2728 Consider \`/recap\` to summarize ${messageCount} messages and prepare for next steps`;
      }
      return null;
    },
    cooldownMs: 5 * 60 * 1000, // 5 minutes between suggestions
  },

  // ── 2. Context Warning ─────────────────────────────────────────────────
  {
    id: 'context-warning',
    check: (stats: Record<string, unknown>, _ctx: ExtensionContext): string | null => {
      const tokenUsage = (stats as any).tokenUsage as Record<string, unknown> | undefined;
      if (!tokenUsage) return null;

      const total = (tokenUsage.total as number) ?? 0;
      const contextWindow = (tokenUsage.contextWindow as number) ?? 0;
      if (contextWindow <= 0) return null;

      const ratio = total / contextWindow;
      if (ratio >= 0.9) {
        return `\u26a0\ufe0f Context window ${Math.round(ratio * 100)}% full \u2014 consider \`/compact\` to free up space`;
      }
      if (ratio >= 0.8) {
        return `\u26a0\ufe0f Context window ${Math.round(ratio * 100)}% full \u2014 \`/compact\` recommended soon`;
      }
      return null;
    },
    cooldownMs: 2 * 60 * 1000, // 2 minutes between warnings
  },

  // ── 3. File Tracking ──────────────────────────────────────────────────
  {
    id: 'file-tracking',
    check: (stats: Record<string, unknown>, _ctx: ExtensionContext): string | null => {
      const touchedFiles = (stats as any).touchedFiles as string[] | undefined;
      if (!touchedFiles) return null;

      const fileCount = touchedFiles.length;
      if (fileCount > 10) {
        return `\ud83d\udcdd ${fileCount} files modified this session \u2014 consider \`/handoff\` to prepare context transfer`;
      }
      return null;
    },
    cooldownMs: 10 * 60 * 1000, // 10 minutes
  },

  // ── 4. High Activity ──────────────────────────────────────────────────
  {
    id: 'high-activity',
    check: (stats: Record<string, unknown>, _ctx: ExtensionContext): string | null => {
      const toolCallCount = (stats.toolCallCount as number) ?? 0;
      const bashCallCount = (stats.bashCallCount as number) ?? 0;

      if (toolCallCount > 50) {
        return `\ud83d\udd27 High tool activity detected (${toolCallCount} calls, ${bashCallCount} bash) \u2014 auto-recap might help organize progress`;
      }
      return null;
    },
    cooldownMs: 5 * 60 * 1000, // 5 minutes
  },
];
