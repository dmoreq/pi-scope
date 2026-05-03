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
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
/** Base directory for smart-context state (inside .pi/smart-context/). */
function stateDir(projectRoot) {
    return join(projectRoot, '.pi', 'smart-context');
}
function statePath(projectRoot) {
    return join(stateDir(projectRoot), 'state.json');
}
/**
 * Read runtime state (async). Returns null if no state file exists.
 */
export async function readState(projectRoot) {
    try {
        const raw = await readFile(statePath(projectRoot), 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/**
 * Write runtime state (async). Creates directory if needed.
 */
export async function writeState(projectRoot, state) {
    try {
        await mkdir(stateDir(projectRoot), { recursive: true });
        await writeFile(statePath(projectRoot), JSON.stringify(state, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[smart-context/state] Failed to write state:', err);
    }
}
/**
 * Read runtime state (sync). Returns null if no state file exists.
 */
export function readStateSync(projectRoot) {
    try {
        const filePath = statePath(projectRoot);
        if (!existsSync(filePath))
            return null;
        const raw = readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/**
 * Write runtime state (sync). Creates directory if needed.
 */
export function writeStateSync(projectRoot, state) {
    try {
        mkdirSync(stateDir(projectRoot), { recursive: true });
        writeFileSync(statePath(projectRoot), JSON.stringify(state, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[smart-context/state] Failed to write state:', err);
    }
}
/**
 * Remove state file (async).
 */
export async function removeState(projectRoot) {
    try {
        await unlink(statePath(projectRoot));
    }
    catch {
        // File doesn't exist — no-op
    }
}
