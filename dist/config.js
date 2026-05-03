/**
 * Typed configuration for pi-smart-context.
 *
 * Loads from:
 *   1. Project-local:  <project-root>/.pi/smart-context.jsonc
 *   2. Global:         ~/.pi/agent/smart-context.jsonc
 *   3. Flags:          CLI flags (passed in at runtime)
 *   4. Defaults:       Fallback hardcoded values
 *
 * Each layer overrides the previous. Supports JSONC format (comments,
 * trailing commas) via the jsonc-parser.
 *
 * Schema defined with zod for runtime validation and clear error messages.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parse, printParseErrorCode } from 'jsonc-parser';
import { z } from 'zod';
// ── Zod schema (mirrors SmartContextConfig) ───────────────────────────────
const ContextFilesSchema = z.object({
    enabled: z.boolean().default(true),
    filenames: z.array(z.string()).default(['AGENTS.local.md', 'CLAUDE.local.md']),
    sectionTitle: z.string().default('Extra Context Files'),
});
const ProviderGuidanceSchema = z.object({
    enabled: z.boolean().default(true),
});
export const SmartContextConfigSchema = z.object({
    enabled: z.boolean().default(true),
    maxRepoMapTokens: z.number().int().positive().default(4000),
    maxInjectionTokens: z.number().int().positive().default(8000),
    scanLastNMessages: z.number().int().positive().default(10),
    exclude: z.array(z.string()).default([
        '**/node_modules/**',
        '**/.git/**',
        '**/.pi-cache/**',
        '**/dist/**',
    ]),
    contextFiles: ContextFilesSchema.default({}),
    providerGuidance: ProviderGuidanceSchema.default({}),
}).default({});
// ── JSONC parsing ─────────────────────────────────────────────────────────
function readConfigFile(filePath) {
    try {
        if (!existsSync(filePath))
            return null;
        return readFileSync(filePath, 'utf8');
    }
    catch {
        return null;
    }
}
function parseJsonc(filePath, content) {
    const errors = [];
    const value = parse(content, errors, {
        allowTrailingComma: true,
        disallowComments: false,
    });
    if (errors.length > 0) {
        const err = errors[0];
        const location = getLineAndColumn(content, err.offset);
        const code = printParseErrorCode(err.error);
        throw new Error(`Invalid JSONC in ${filePath}:${location.line}:${location.column}: ${code}`);
    }
    return value;
}
function getLineAndColumn(content, offset) {
    const beforeOffset = content.slice(0, offset);
    const lines = beforeOffset.split('\n');
    return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}
// ── Deep merge ────────────────────────────────────────────────────────────
function deepMerge(defaults, overrides) {
    const result = { ...defaults };
    for (const key of Object.keys(overrides)) {
        const overrideVal = overrides[key];
        if (overrideVal === undefined)
            continue;
        const defaultVal = defaults[key];
        if (isPlainObject(defaultVal) &&
            isPlainObject(overrideVal)) {
            result[key] = deepMerge(defaultVal, overrideVal);
        }
        else {
            result[key] = overrideVal;
        }
    }
    return result;
}
function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}
// ── Config loading ────────────────────────────────────────────────────────
const GLOBAL_CONFIG_PATH = join(homedir(), '.pi', 'agent', 'smart-context.jsonc');
const PROJECT_CONFIG_REL = '.pi/smart-context.jsonc';
/**
 * Load the smart-context configuration from all layers.
 *
 * Priority (highest wins):
 *   1. CLI flag overrides (passed as `flags`)
 *   2. Project-local .pi/smart-context.jsonc
 *   3. Global ~/.pi/agent/smart-context.jsonc
 *   4. Hardcoded defaults
 *
 * @param projectRoot  Project root directory
 * @param flags        CLI flag overrides (from pi extension API)
 */
export function loadConfig(projectRoot, flags) {
    // ── Layer 1: Defaults ─────────────────────────────────────────────────
    let merged = SmartContextConfigSchema.parse({});
    // ── Layer 2: Global config ────────────────────────────────────────────
    const globalRaw = readConfigFile(GLOBAL_CONFIG_PATH);
    if (globalRaw) {
        const globalValue = parseJsonc(GLOBAL_CONFIG_PATH, globalRaw);
        merged = deepMerge(merged, globalValue);
    }
    // ── Layer 3: Project-local config ─────────────────────────────────────
    const projectPath = resolve(projectRoot, PROJECT_CONFIG_REL);
    const projectRaw = readConfigFile(projectPath);
    if (projectRaw) {
        const projectValue = parseJsonc(projectPath, projectRaw);
        merged = deepMerge(merged, projectValue);
    }
    // ── Layer 4: CLI flags ────────────────────────────────────────────────
    if (flags) {
        const flagConfig = {};
        if (flags['smart-context.enabled'] !== undefined) {
            flagConfig.enabled = Boolean(flags['smart-context.enabled']);
        }
        if (flags['smart-context.maxRepoMapTokens'] !== undefined) {
            flagConfig.maxRepoMapTokens = Number(flags['smart-context.maxRepoMapTokens']);
        }
        if (flags['smart-context.maxInjectionTokens'] !== undefined) {
            flagConfig.maxInjectionTokens = Number(flags['smart-context.maxInjectionTokens']);
        }
        if (flags['smart-context.scanLastNMessages'] !== undefined) {
            flagConfig.scanLastNMessages = Number(flags['smart-context.scanLastNMessages']);
        }
        if (flags['smart-context.contextFiles.enabled'] !== undefined) {
            flagConfig.contextFiles = {
                ...(merged.contextFiles ?? {}),
                enabled: Boolean(flags['smart-context.contextFiles.enabled']),
            };
        }
        if (flags['smart-context.providerGuidance.enabled'] !== undefined) {
            flagConfig.providerGuidance = {
                ...(merged.providerGuidance ?? {}),
                enabled: Boolean(flags['smart-context.providerGuidance.enabled']),
            };
        }
        merged = deepMerge(merged, flagConfig);
    }
    // ── Validate final merged config ──────────────────────────────────────
    const result = SmartContextConfigSchema.safeParse(merged);
    if (!result.success) {
        throw new Error(`[smart-context] Invalid configuration:\n${result.error.message}`);
    }
    return result.data;
}
