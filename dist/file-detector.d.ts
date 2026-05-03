/**
 * File Detector — multi-source file path detection.
 *
 * Extracts file paths from different content types:
 *   - User/assistant text (regex-based)
 *   - Tool call arguments (read, write, edit, bash)
 *   - Tool output content (compiler errors, logs)
 *
 * Ported from pi-me core-tools/file-collector/extension.ts patterns
 */
export interface FileReference {
    path: string;
    startLine?: number;
    endLine?: number;
}
export interface DetectorOptions {
    extensions?: string[];
    validateExistence?: boolean;
    projectRoot?: string;
}
export declare function detectPathsInText(text: string, options?: DetectorOptions): FileReference[];
export declare function detectPathsInToolCall(toolName: string, input: Record<string, unknown> | undefined, options?: DetectorOptions): FileReference[];
export declare function detectPathsInOutput(_toolName: string, content: unknown, options?: DetectorOptions): FileReference[];
export declare function detectPathsInMessage(message: {
    role?: string;
    content?: unknown;
    toolName?: string;
    input?: Record<string, unknown>;
}, options?: DetectorOptions): FileReference[];
