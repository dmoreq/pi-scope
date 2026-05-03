/**
 * Persists the generated RepoIndex and repo map to .pi/smart-context/ inside
 * the project root so they survive across sessions.
 *
 * Layout:
 *   .pi/smart-context/
 *     repo-map.txt   — the <repo-map>…</repo-map> string
 *     index.json     — serialised skeletons + dep graph + metadata
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const STORE_VERSION = 1;
const DIR_NAME = join('.pi', 'smart-context');
function storeDir(projectRoot) {
    return join(projectRoot, DIR_NAME);
}
function indexPath(projectRoot) {
    return join(storeDir(projectRoot), 'index.json');
}
function mapPath(projectRoot) {
    return join(storeDir(projectRoot), 'repo-map.txt');
}
/** Returns true if both persisted files exist. */
export async function storeExists(projectRoot) {
    try {
        await readFile(indexPath(projectRoot));
        await readFile(mapPath(projectRoot));
        return true;
    }
    catch {
        return false;
    }
}
/** Serialize and write RepoIndex + repo map to .pi/smart-context/. */
export async function saveStore(projectRoot, index, repoMap) {
    await mkdir(storeDir(projectRoot), { recursive: true });
    const skeletons = {};
    for (const [k, v] of index.skeletons)
        skeletons[k] = v;
    const deps = {};
    for (const [k, v] of index.deps)
        deps[k] = [...v];
    const reverseDeps = {};
    for (const [k, v] of index.reverseDeps)
        reverseDeps[k] = [...v];
    const stored = {
        version: STORE_VERSION,
        builtAt: new Date().toISOString(),
        projectRoot,
        fileCount: index.skeletons.size,
        skeletons,
        deps,
        reverseDeps,
    };
    await Promise.all([
        writeFile(indexPath(projectRoot), JSON.stringify(stored, null, 2), 'utf-8'),
        writeFile(mapPath(projectRoot), repoMap, 'utf-8'),
    ]);
}
/** Load and deserialize RepoIndex + repo map from .pi/smart-context/. */
export async function loadStore(projectRoot) {
    const [rawIndex, repoMap] = await Promise.all([
        readFile(indexPath(projectRoot), 'utf-8'),
        readFile(mapPath(projectRoot), 'utf-8'),
    ]);
    const stored = JSON.parse(rawIndex);
    if (stored.version !== STORE_VERSION) {
        throw new Error(`Store version mismatch: expected ${STORE_VERSION}, got ${stored.version}`);
    }
    const skeletons = new Map(Object.entries(stored.skeletons));
    const deps = new Map(Object.entries(stored.deps).map(([k, v]) => [k, new Set(v)]));
    const reverseDeps = new Map(Object.entries(stored.reverseDeps).map(([k, v]) => [k, new Set(v)]));
    return {
        index: { skeletons, deps, reverseDeps },
        repoMap,
        builtAt: stored.builtAt,
        fileCount: stored.fileCount,
    };
}
