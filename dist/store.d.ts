/**
 * Persists the generated RepoIndex and repo map to .pi/smart-context/ inside
 * the project root so they survive across sessions.
 *
 * Layout:
 *   .pi/smart-context/
 *     repo-map.txt   — the <repo-map>…</repo-map> string
 *     index.json     — serialised skeletons + dep graph + metadata
 */
import type { RepoIndex } from './types.js';
/** Returns true if both persisted files exist. */
export declare function storeExists(projectRoot: string): Promise<boolean>;
/** Serialize and write RepoIndex + repo map to .pi/smart-context/. */
export declare function saveStore(projectRoot: string, index: RepoIndex, repoMap: string): Promise<void>;
/** Load and deserialize RepoIndex + repo map from .pi/smart-context/. */
export declare function loadStore(projectRoot: string): Promise<{
    index: RepoIndex;
    repoMap: string;
    builtAt: string;
    fileCount: number;
}>;
