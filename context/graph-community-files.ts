/**
 * Map graph communities to project file paths for retrieval boosting.
 */

import { relative, resolve } from 'node:path'
import { buildGraphLookupIndex, type GraphLookupIndex } from './graph-lookup-index.js'
import type { GraphAnalysis } from './graph-types.js'

/** Collect absolute file paths that belong to a community (module nodes). */
export function communityFilePaths(
  analysis: GraphAnalysis,
  communityId: string,
  projectRoot: string,
  lookupIndex: GraphLookupIndex = buildGraphLookupIndex(analysis)
): Set<string> {
  const paths = new Set<string>()
  for (const relPath of lookupIndex.communityFilePathsById.get(communityId) ?? []) {
    paths.add(resolve(projectRoot, relPath))
  }
  return paths
}

export function fileInCommunity(
  absPath: string,
  communityId: string,
  analysis: GraphAnalysis,
  projectRoot: string,
  lookupIndex: GraphLookupIndex = buildGraphLookupIndex(analysis)
): boolean {
  const files = communityFilePaths(analysis, communityId, projectRoot, lookupIndex)
  if (files.has(absPath)) return true
  const rel = relative(projectRoot, absPath).replace(/\\/g, '/')
  for (const f of files) {
    const r = relative(projectRoot, f).replace(/\\/g, '/')
    if (rel === r || rel.endsWith(`/${r}`)) return true
  }
  return false
}
