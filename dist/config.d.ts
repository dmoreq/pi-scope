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
import { z } from 'zod';
import type { SmartContextConfig } from './types.js';
export declare const SmartContextConfigSchema: z.ZodDefault<z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    maxRepoMapTokens: z.ZodDefault<z.ZodNumber>;
    maxInjectionTokens: z.ZodDefault<z.ZodNumber>;
    scanLastNMessages: z.ZodDefault<z.ZodNumber>;
    exclude: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    contextFiles: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        filenames: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        sectionTitle: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        filenames: string[];
        sectionTitle: string;
    }, {
        enabled?: boolean | undefined;
        filenames?: string[] | undefined;
        sectionTitle?: string | undefined;
    }>>;
    providerGuidance: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
    }, {
        enabled?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    maxRepoMapTokens: number;
    maxInjectionTokens: number;
    scanLastNMessages: number;
    exclude: string[];
    contextFiles: {
        enabled: boolean;
        filenames: string[];
        sectionTitle: string;
    };
    providerGuidance: {
        enabled: boolean;
    };
}, {
    enabled?: boolean | undefined;
    maxRepoMapTokens?: number | undefined;
    maxInjectionTokens?: number | undefined;
    scanLastNMessages?: number | undefined;
    exclude?: string[] | undefined;
    contextFiles?: {
        enabled?: boolean | undefined;
        filenames?: string[] | undefined;
        sectionTitle?: string | undefined;
    } | undefined;
    providerGuidance?: {
        enabled?: boolean | undefined;
    } | undefined;
}>>;
export type SmartContextConfigInput = z.input<typeof SmartContextConfigSchema>;
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
export declare function loadConfig(projectRoot: string, flags?: Record<string, unknown>): SmartContextConfig;
