/**
 * State persistence — standardized read/write helpers for runtime state.
 *
 * Ported from pi-me shared/ext-state.ts
 * ─────────────────────────────────────
 * Persists lightweight runtime state (e.g., last session stats, build
 * metadata) to <project>/.pi/smart-context/state.json so it survives
 * across session restarts.
 *
 * For the heavy data (index, repo map), use store.ts which has atomic
 * writes and versioned schemas.
 *
 * Usage:
 *   const state = await readState(projectRoot) ?? { lastSessionId: '' };
 *   state.lastSessionId = sessionId;
 *   await writeState(projectRoot, state);
 */
export type StateValue = string | number | boolean | null | StateValue[] | {
    [key: string]: StateValue;
};
/**
 * Read runtime state (async). Returns null if no state file exists.
 */
export declare function readState<T extends Record<string, StateValue> = Record<string, StateValue>>(projectRoot: string): Promise<T | null>;
/**
 * Write runtime state (async). Creates directory if needed.
 */
export declare function writeState<T extends Record<string, StateValue> = Record<string, StateValue>>(projectRoot: string, state: T): Promise<void>;
/**
 * Read runtime state (sync). Returns null if no state file exists.
 */
export declare function readStateSync<T extends Record<string, StateValue> = Record<string, StateValue>>(projectRoot: string): T | null;
/**
 * Write runtime state (sync). Creates directory if needed.
 */
export declare function writeStateSync<T extends Record<string, StateValue> = Record<string, StateValue>>(projectRoot: string, state: T): void;
/**
 * Remove state file (async).
 */
export declare function removeState(projectRoot: string): Promise<void>;
