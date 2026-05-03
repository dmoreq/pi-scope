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
// ── Prefix ─────────────────────────────────────────────────────────────────
const PREFIX = '[smart-context]';
// ── Message formatting ─────────────────────────────────────────────────────
/**
 * Format an info-level notification message.
 */
export function info(message) {
    return `${PREFIX} ${message}`;
}
/**
 * Format a warning-level notification message.
 */
export function warn(message) {
    return `${PREFIX} ⚠ ${message}`;
}
/**
 * Format an error-level notification message.
 */
export function error(message) {
    return `${PREFIX} ✗ ${message}`;
}
/**
 * Format a success notification message.
 */
export function success(message) {
    return `${PREFIX} ✓ ${message}`;
}
// ── Status bar ─────────────────────────────────────────────────────────────
const STATUS_KEY = 'smart-ctx';
/**
 * Build the status bar entry text from current state.
 */
export function buildStatusText(state) {
    const parts = [];
    if (state.indexedFiles > 0) {
        parts.push(`${state.indexedFiles} files`);
    }
    if (state.repoMapTokens > 0) {
        parts.push(`map ~${state.repoMapTokens}t`);
    }
    if (state.depContextTriggers > 0) {
        parts.push(`${state.depContextTriggers} inj`);
    }
    if (state.contextFilesCount > 0) {
        parts.push(`${state.contextFilesCount} ctx`);
    }
    if (state.providerGuidanceCount > 0) {
        parts.push(`${state.providerGuidanceCount} guid`);
    }
    return parts.length > 0 ? parts.join(' | ') : '';
}
/**
 * Update the TUI status bar with current stats.
 *
 * @param setStatus  The pi extension's `ctx.ui.setStatus` function
 * @param state      Current injection state
 * @param theme      Optional theme for styling (if available)
 */
export function updateStatusBar(setStatus, state, theme) {
    const text = buildStatusText(state);
    if (!text) {
        setStatus(STATUS_KEY, 'SmartCtx: --');
        return;
    }
    const display = theme?.fg
        ? theme.fg('dim', `SmartCtx: ${text}`)
        : `SmartCtx: ${text}`;
    setStatus(STATUS_KEY, display);
}
/**
 * Clear the status bar entry.
 */
export function clearStatusBar(setStatus) {
    setStatus(STATUS_KEY, undefined);
}
