/**
 * AutomationManager — triggers intelligent actions based on session state.
 *
 * Evaluates registered triggers on session events and generates
 * human-readable suggestions for the user.
 *
 * Each trigger has:
 *   - id: Unique identifier
 *   - check(stats, ctx) → string | null (null = no suggestion)
 *   - cooldownMs: Minimum time between firings
 *
 * Usage:
 * ```typescript
 * const automation = new AutomationManager();
 * automation.register(BUILT_IN_TRIGGERS[0]);
 * const suggestions = await automation.evaluate(stats, ctx);
 * ```
 */

import type { ExtensionContext } from '../extension.js';

// ── Trigger Definition ─────────────────────────────────────────────────────

export interface AutomationTrigger {
  /** Unique trigger identifier. */
  id: string;

  /**
   * Evaluate condition. Return a suggestion string or null.
   * @param stats - Current session statistics snapshot
   * @param ctx   - Extension context
   * @returns Human-readable suggestion or null
   */
  check: (stats: Record<string, unknown>, ctx: ExtensionContext) => string | null;

  /**
   * Optional async action to execute when trigger fires.
   */
  action?: (stats: Record<string, unknown>, ctx: ExtensionContext) => Promise<void>;

  /** Minimum ms between consecutive firings. */
  cooldownMs: number;

  /** Timestamp of last firing (managed by AutomationManager). */
  lastTriggered?: number;
}

// ── Automation Manager ─────────────────────────────────────────────────────

export class AutomationManager {
  private triggers: Map<string, AutomationTrigger> = new Map();
  private triggerLog: Map<string, number> = new Map();
  private _enabled = true;

  /**
   * Whether automation is enabled.
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Enable or disable automation.
   */
  set enabled(val: boolean) {
    this._enabled = val;
  }

  /**
   * Register a trigger.
   * Throws if a trigger with the same id already exists.
   */
  register(trigger: AutomationTrigger): void {
    if (this.triggers.has(trigger.id)) {
      throw new Error(`Automation trigger '${trigger.id}' already registered`);
    }
    this.triggers.set(trigger.id, trigger);
  }

  /**
   * Unregister a trigger by id.
   */
  unregister(id: string): boolean {
    this.triggerLog.delete(id);
    return this.triggers.delete(id);
  }

  /**
   * Get a registered trigger by id.
   */
  get(id: string): AutomationTrigger | undefined {
    return this.triggers.get(id);
  }

  /**
   * Get all registered triggers.
   */
  getAll(): AutomationTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Get the count of registered triggers.
   */
  get count(): number {
    return this.triggers.size;
  }

  /**
   * Evaluate all registered triggers against current session state.
   * Returns an array of suggestion strings (empty if none fire).
   * Skips triggers still in cooldown.
   *
   * @param stats - Session statistics snapshot
   * @param ctx   - Extension context
   * @returns Array of human-readable suggestion strings
   */
  async evaluate(
    stats: Record<string, unknown>,
    ctx: ExtensionContext,
  ): Promise<string[]> {
    if (!this._enabled) return [];

    const suggestions: string[] = [];

    for (const trigger of this.triggers.values()) {
      const lastFired = this.triggerLog.get(trigger.id) ?? 0;
      const elapsed = Date.now() - lastFired;

      // Skip if still in cooldown
      if (elapsed < trigger.cooldownMs) continue;

      try {
        const suggestion = trigger.check(stats, ctx);
        if (suggestion) {
          suggestions.push(suggestion);
          this.triggerLog.set(trigger.id, Date.now());
          trigger.lastTriggered = Date.now();

          // Execute optional action
          if (trigger.action) {
            await trigger.action(stats, ctx);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[pi-slim] Automation trigger '${trigger.id}' failed: ${errMsg}`);
      }
    }

    return suggestions;
  }

  /**
   * Clear all trigger firing history (resets cooldowns).
   */
  clearHistory(): void {
    this.triggerLog.clear();
  }

  /**
   * Clear all registered triggers.
   */
  clear(): void {
    this.triggers.clear();
    this.triggerLog.clear();
  }
}
