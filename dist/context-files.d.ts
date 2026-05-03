/**
 * Context Files — load and format project-local context files (AGENTS.local.md,
 * CLAUDE.local.md, etc.) for injection into the system prompt.
 *
 * Ported from pi-me foundation/extra-context-files.ts
 * ─────────────────────────────────────────────────────
 * Walks from cwd up to the filesystem root, collecting matching filenames
 * at each directory level. Filters out files that pi core already loaded
 * (e.g., AGENTS.md → skip if AGENTS.local.md is the same content).
 *
 * Usage:
 *   const files = loadContextFiles(cwd)
 *   const block = formatContextSection(files)
 *   // → "# Extra Context Files\n\n## /path/to/AGENTS.local.md\n\n..."
 */
export interface ContextFileOptions {
    /** Filenames to search for at every ancestor directory level. */
    filenames?: string[];
    /** Section title in the injected block. */
    sectionTitle?: string;
}
export interface ContextFile {
    /** Absolute path of the discovered file. */
    path: string;
    /** File contents. */
    content: string;
}
export type ResolvedContextFileOptions = Required<ContextFileOptions>;
export declare const DEFAULT_CONTEXT_FILE_OPTIONS: ResolvedContextFileOptions;
/**
 * Walk ancestors of `cwd` and collect all matching filenames.
 * Each directory is checked for every filename in `options.filenames`.
 */
export declare function loadContextFiles(cwd: string, options?: Pick<ResolvedContextFileOptions, 'filenames'>): ContextFile[];
/**
 * Format loaded context files into a section suitable for system prompt
 * injection.
 */
export declare function formatContextSection(files: ContextFile[], options?: Pick<ResolvedContextFileOptions, 'sectionTitle'>): string;
/**
 * Format a display path (relative to cwd if possible) for notification output.
 */
export declare function formatDisplayPath(filePath: string, cwd: string): string;
/**
 * Build a notification message listing loaded context files.
 * Returns empty string if no files loaded.
 */
export declare function buildStartupNotification(files: ContextFile[], cwd: string, options?: Pick<ResolvedContextFileOptions, 'sectionTitle'>): string;
