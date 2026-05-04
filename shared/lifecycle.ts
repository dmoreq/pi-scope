/**
 * ExtensionLifecycle — base class for lifecycle-aware pi extensions.
 *
 * Satisfies SRP: extension.ts handles wiring only; business logic lives in subclasses.
 * Provides telemetry helpers and a hook-based lifecycle contract.
 *
 * Usage:
 * ```typescript
 * class MyExtension extends ExtensionLifecycle {
 *   readonly name = 'my-ext';
 *   readonly version = '0.1.0';
 *   protected readonly description = 'Does something useful';
 *   protected readonly tools = ['my-tool'];
 *   protected readonly events = ['session_start', 'context'];
 *
 *   async onSessionStart(event: any, ctx: ExtensionContext): Promise<void> {
 *     // custom initialization
 *   }
 * }
 * ```
 */

import { getTelemetry } from 'pi-telemetry';
import type { ExtensionContext } from '../extension.js';
import type { NotifyOptions } from 'pi-telemetry/types';

// Re-export ExtensionContext for convenience
export type { ExtensionContext };

// ── Notification Options ───────────────────────────────────────────────────

export type { NotifyOptions };

// ── Plugin-Compatible Event Types ──────────────────────────────────────────

export interface PluginEvent {
  type: string;
  [key: string]: unknown;
}

export interface PluginToolCallEvent {
  toolName: string;
  input: Record<string, unknown> | undefined;
  toolCallId?: string;
}

export interface PluginToolCallResult {
  allowed: boolean;
  reason?: string;
}

// ── Lifecycle Base Class ───────────────────────────────────────────────────

/**
 * Abstract base class for lifecycle-aware pi extensions.
 *
 * Lifecycle hooks (all async, all optional):
 *   onSessionStart     — Reset state, initialize resources
 *   onBeforeAgentStart — Modify system prompt before LLM call
 *   onContext          — Modify or augment context messages
 *   onTurnEnd          — Post-turn cleanup, automation evaluation
 *   onAgentEnd         — Post-agent processing
 *   onToolCall         — Intercept or validate tool calls
 *   onSessionShutdown  — Cleanup, persist state
 *
 * Telemetry helpers:
 *   recordToolInvocation(tool)
 *   recordToolResult(tool, duration, isError)
 *   recordError(type, message, stack?)
 *   heartbeat(status, error?)
 *   notify(message, opts)
 *   recordTokens(tokens)
 *   recordCost(cost)
 */
export abstract class ExtensionLifecycle {
  /** Extension name (used for telemetry registration). */
  abstract readonly name: string;

  /** Extension version. */
  abstract readonly version: string;

  /** Human-readable description. */
  protected abstract readonly description: string;

  /** Tool names this extension registers (for telemetry attribution). */
  protected abstract readonly tools: string[];

  /** Pi events this extension listens to (for telemetry attribution). */
  protected abstract readonly events: string[];

  /** Whether telemetry registration has happened. */
  private _registered = false;

  /**
   * Register this extension with pi-telemetry.
   * Automatically called on first lifecycle hook invocation.
   */
  protected ensureRegistered(): void {
    if (this._registered) return;
    this._registered = true;

    try {
      getTelemetry()?.register({
        name: this.name,
        version: this.version,
        description: this.description,
        tools: this.tools,
        events: this.events,
      });
    } catch {
      // Telemetry registration is best-effort
    }
  }

  // ── Lifecycle Hooks ──────────────────────────────────────────────────────

  /**
   * Called when a new session starts.
   * Override to reset state, initialize resources, etc.
   */
  async onSessionStart(_event: PluginEvent, _ctx: ExtensionContext): Promise<void> {
    this.ensureRegistered();
  }

  /**
   * Called before the agent starts (system prompt construction).
   * Override to inject additional content into the system prompt.
   */
  async onBeforeAgentStart(
    _event: { type: 'before_agent_start'; systemPrompt: string; prompt: string },
    _ctx: ExtensionContext,
  ): Promise<{ systemPrompt: string } | undefined> {
    return undefined;
  }

  /**
   * Called during context construction (per-turn).
   * Override to modify, augment, or prune context messages.
   */
  async onContext(
    _event: { type: 'context'; messages: Record<string, unknown>[] },
    _ctx: ExtensionContext,
  ): Promise<{ messages: Record<string, unknown>[] } | undefined> {
    return undefined;
  }

  /**
   * Called after each turn completes.
   * Override for post-turn automation, metrics collection, etc.
   */
  async onTurnEnd(_ctx: ExtensionContext): Promise<void> {
    // no-op by default
  }

  /**
   * Called after agent output is produced.
   * Override for post-agent processing.
   */
  async onAgentEnd(_event: PluginEvent, _ctx: ExtensionContext): Promise<void> {
    // no-op by default
  }

  /**
   * Called for every tool invocation.
   * Override to intercept, validate, or block tool calls.
   */
  async onToolCall(
    _event: PluginToolCallEvent,
    _ctx: ExtensionContext,
  ): Promise<PluginToolCallResult | undefined> {
    return undefined;
  }

  /**
   * Called when a session shuts down.
   * Override to persist state, clean up resources, etc.
   */
  async onSessionShutdown(): Promise<void> {
    // no-op by default
  }

  // ── Telemetry Helpers ────────────────────────────────────────────────────

  /**
   * Record a tool invocation for telemetry attribution.
   */
  protected recordToolInvocation(tool: string): void {
    this.ensureRegistered();
    try {
      getTelemetry()?.recordToolInvocation(this.name, tool);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record a tool result (duration + error status) for telemetry.
   */
  protected recordToolResult(tool: string, duration: number, isError: boolean): void {
    this.ensureRegistered();
    try {
      getTelemetry()?.recordToolResult(this.name, tool, duration, isError);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record an error for telemetry monitoring.
   */
  protected recordError(type: string, message: string, stack?: string): void {
    this.ensureRegistered();
    try {
      getTelemetry()?.recordError(this.name, type, message, stack);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Send a heartbeat to keep the package visible in health dashboards.
   */
  protected heartbeat(status?: 'healthy' | 'degraded' | 'error' | 'stale', error?: string): void {
    this.ensureRegistered();
    try {
      getTelemetry()?.heartbeat(this.name, { status, error });
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Send a styled notification to the session TUI.
   */
  protected notify(message: string, opts?: NotifyOptions): void {
    try {
      getTelemetry()?.notify(message, opts);
    } catch {
      // Notifications are best-effort
    }
  }

  /**
   * Record token usage attribution for this extension.
   */
  protected recordTokens(tokens: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): void {
    this.ensureRegistered();
    try {
      getTelemetry()?.recordTokens(this.name, tokens);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Record cost attribution for this extension.
   */
  protected recordCost(cost: number): void {
    this.ensureRegistered();
    try {
      getTelemetry()?.recordCost(this.name, cost);
    } catch {
      // Telemetry is best-effort
    }
  }

  /**
   * Track a custom event (stub for future pi-telemetry event API).
   */
  protected track(_event: string, _metadata?: Record<string, unknown>): void {
    this.ensureRegistered();
  }
}
