/**
 * BFS dependent fan-out — shared by intelligence risk warnings and LSP hover impact.
 */

import type { GraphAnalysis } from './graph-types.js'
import { buildGraphLookupIndex, type GraphLookupIndex } from './graph-lookup-index.js'

export interface DependentFanout {
  dependentCount: number
  affectedCommunities: number
}

/**
 * Count nodes that depend on the given symbol/file (incoming edges), transitively.
 */
export function computeDependentFanout(
  lookupKey: string,
  analysis: GraphAnalysis,
  lookupIndex: GraphLookupIndex = buildGraphLookupIndex(analysis)
): DependentFanout {
  const g = lookupIndex.graph
  if (!g?.edges?.length) {
    return { dependentCount: 0, affectedCommunities: 0 }
  }

  const seedIds = lookupIndex.resolveSeedIds(lookupKey)
  const visited = new Set<string>(seedIds)
  const queue = [...seedIds]
  let head = 0

  while (head < queue.length) {
    const current = queue[head++]
    if (!current) break
    for (const src of lookupIndex.getReverse(current)) {
      if (!visited.has(src)) {
        visited.add(src)
        queue.push(src)
      }
    }
  }

  const dependentCount = Math.max(0, visited.size - seedIds.size)
  const communityIds = new Set<string>()
  for (const dep of visited) {
    if (seedIds.has(dep)) continue
    for (const communityId of lookupIndex.communityIdsForNode(dep)) {
      communityIds.add(communityId)
    }
  }

  return {
    dependentCount,
    affectedCommunities: communityIds.size || (dependentCount > 0 ? 1 : 0),
  }
}
