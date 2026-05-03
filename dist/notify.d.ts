/**
 * Notification utilities for pi-smart-context.
 *
 * Provides consistent formatting for TUI notifications and a status bar
 * entry that displays live context injection stats.
 *
 * Ported from pi-me shared/notify-utils.ts notification patterns
 * ──────────────────────────────────────────────────────────────────────
 * Lightweight — only the TUI formatting layer, no macOS-specific
 * beep/speech/terminal-activation features.
 */
/**
 * Format an info-level notification message.
 */
export declare function info(message: string): string;
/**
 * Format a warning-level notification message.
 */
export declare function warn(message: string): string;
/**
 * Format an error-level notification message.
 */
export declare function error(message: string): string;
/**
 * Format a success notification message.
 */
export declare function success(message: string): string;
export interface StatusBarState {
    /** Number of files indexed. */
    indexedFiles: number;
    /** Repo map token count. */
    repoMapTokens: number;
    /** Number of dep-context injections this session. */
    depContextTriggers: number;
    /** Number of context files loaded. */
    contextFilesCount: number;
    /** Number of provider guidance files loaded. */
    providerGuidanceCount: number;
}
/**
 * Build the status bar entry text from current state.
 */
export declare function buildStatusText(state: StatusBarState): string;
/**
 * Update the TUI status bar with current stats.
 *
 * @param setStatus  The pi extension's `ctx.ui.setStatus` function
 * @param state      Current injection state
 * @param theme      Optional theme for styling (if available)
 */
export declare function updateStatusBar(setStatus: (key: string, text?: string) => void, state: StatusBarState, theme?: {
    fg?: (style: string, text: string) => string;
}): void;
/**
 * Clear the status bar entry.
 */
export declare function clearStatusBar(setStatus: (key: string, text?: string) => void): void;
