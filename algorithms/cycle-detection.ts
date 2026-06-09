/**
 * Cycle Detection Algorithms
 *
 * Detects circular dependencies in code graphs using multiple algorithms:
 * - DFS-based cycle detection (finds actual cycles)
 * - Strongly Connected Components (Tarjan's algorithm)
 * - Weakly Connected Components
 * - Anomaly detection for problematic patterns
 */

import type { CodeGraph } from '../context/graph-types.js'

const MAX_MATERIALIZED_CYCLES = 50

/**
 * Represents a cycle in the graph.
 */
export interface Cycle {
  id: string
  nodes: string[]
  edges: Array<[string, string]>
  length: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  recommendation: string
}

/**
 * Strongly connected component (cycles).
 */
export interface StronglyConnectedComponent {
  id: string
  nodes: string[]
  size: number
  isCycle: boolean
  density: number
}

/**
 * Cycle detection result.
 */
export interface CycleDetectionResult {
  hasCycles: boolean
  cycleCount: number
  totalNodesInCycles: number
  cycles: Cycle[]
  strongComponents: StronglyConnectedComponent[]
  anomalies: Anomaly[]
}

/**
 * Anomaly in the dependency graph.
 */
export interface Anomaly {
  type: 'circular' | 'crossLayer' | 'highCoupling' | 'orphan'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  affectedNodes: string[]
  description: string
  recommendation: string
}

/**
 * Detect all cycles in a graph using DFS.
 *
 * Time Complexity: O(n + m) for DFS
 * Space Complexity: O(n) for visited tracking
 *
 * @param graph The dependency graph
 * @returns Cycle detection result
 */
export function detectAllCycles(graph: CodeGraph): CycleDetectionResult {
  const adj = buildAdjacency(graph)
  const sccs = detectStronglyConnectedComponentsFromAdjacency(graph, adj)
  const cyclicComponents = sccs.filter(scc => scc.isCycle)
  const cycles = materializeRepresentativeCycles(cyclicComponents, adj, graph)
  const anomalies: Anomaly[] = []

  // Find anomalies
  anomalies.push(...detectAnomalies(cycles, sccs, graph))

  // Calculate statistics
  const cycleNodes = new Set<string>()
  for (const scc of cyclicComponents) {
    for (const n of scc.nodes) {
      cycleNodes.add(n)
    }
  }

  return {
    hasCycles: cyclicComponents.length > 0,
    cycleCount: cyclicComponents.length,
    totalNodesInCycles: cycleNodes.size,
    cycles,
    strongComponents: sccs,
    anomalies,
  }
}

/**
 * Build adjacency list once for cycle-related algorithms.
 */
function buildAdjacency(graph: CodeGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const node of graph.nodes) {
    adj.set(node.id, [])
  }
  for (const edge of graph.edges) {
    const neighbors = adj.get(edge.source)
    if (neighbors) {
      neighbors.push(edge.target)
    }
  }
  for (const neighbors of adj.values()) {
    neighbors.sort()
  }
  return adj
}

function materializeRepresentativeCycles(
  sccs: StronglyConnectedComponent[],
  adj: Map<string, string[]>,
  graph: CodeGraph
): Cycle[] {
  const cycles: Cycle[] = []
  for (const scc of sccs) {
    if (cycles.length >= MAX_MATERIALIZED_CYCLES) break
    const cyclePath = findRepresentativeCycle(scc.nodes, adj)
    if (!cyclePath) continue
    const length = cyclePath.length - 1
    cycles.push({
      id: `cycle-${cycles.length}`,
      nodes: cyclePath.slice(0, -1),
      edges: getCycleEdges(cyclePath, graph),
      length,
      severity: determineCycleSeverity(length),
      recommendation: getCycleRecommendation(length),
    })
  }
  return cycles
}

function findRepresentativeCycle(nodes: string[], adj: Map<string, string[]>): string[] | null {
  const nodeSet = new Set(nodes)

  if (nodes.length === 1) {
    const node = nodes[0]
    return adj.get(node)?.includes(node) ? [node, node] : null
  }

  const visited = new Set<string>()
  const onStack = new Set<string>()
  const path: string[] = []

  function dfs(node: string): string[] | null {
    visited.add(node)
    onStack.add(node)
    path.push(node)

    for (const neighbor of adj.get(node) ?? []) {
      if (!nodeSet.has(neighbor)) continue
      if (!visited.has(neighbor)) {
        const found = dfs(neighbor)
        if (found) return found
      } else if (onStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor)
        return path.slice(cycleStart).concat(neighbor)
      }
    }

    path.pop()
    onStack.delete(node)
    return null
  }

  for (const node of [...nodes].sort()) {
    if (!visited.has(node)) {
      const found = dfs(node)
      if (found) return found
    }
  }

  return null
}

/**
 * Extract cycle edges from path.
 *
 * @param path Node path forming cycle
 * @param graph Graph data
 * @returns Array of edges
 */
function getCycleEdges(path: string[], _graph: CodeGraph): Array<[string, string]> {
  const edges: Array<[string, string]> = []

  for (let i = 0; i < path.length - 1; i++) {
    edges.push([path[i], path[i + 1]])
  }

  return edges
}

/**
 * Determine cycle severity based on length.
 *
 * @param length Cycle length
 * @returns Severity level
 */
function determineCycleSeverity(length: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (length === 2) {
    return 'CRITICAL' // Direct circular dependency
  }
  if (length <= 4) {
    return 'HIGH'
  }
  if (length <= 8) {
    return 'MEDIUM'
  }
  return 'LOW'
}

/**
 * Get recommendation for breaking a cycle.
 *
 * @param length Cycle length
 * @returns Recommendation string
 */
function getCycleRecommendation(length: number): string {
  if (length === 2) {
    return 'Direct circular dependency. One module must be split or refactored.'
  }
  if (length <= 4) {
    return 'Short circular chain. Consider extracting shared logic to a separate module.'
  }
  if (length <= 8) {
    return 'Moderate cycle detected. Review architecture and consider dependency inversion.'
  }
  return 'Long circular chain. Significant refactoring may be needed.'
}

/**
 * Detect strongly connected components using Tarjan's algorithm.
 *
 * Time Complexity: O(n + m)
 * Space Complexity: O(n)
 *
 * @param graph The graph
 * @returns Array of strongly connected components
 */
export function detectStronglyConnectedComponents(graph: CodeGraph): StronglyConnectedComponent[] {
  return detectStronglyConnectedComponentsFromAdjacency(graph, buildAdjacency(graph))
}

function detectStronglyConnectedComponentsFromAdjacency(
  graph: CodeGraph,
  adj: Map<string, string[]>
): StronglyConnectedComponent[] {
  const index = new Map<string, number>()
  const lowLink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const sccs: StronglyConnectedComponent[] = []
  let indexCounter = 0

  function strongConnect(node: string) {
    index.set(node, indexCounter)
    lowLink.set(node, indexCounter)
    indexCounter++
    stack.push(node)
    onStack.add(node)

    const neighbors = adj.get(node) || []
    for (const neighbor of neighbors) {
      if (!index.has(neighbor)) {
        strongConnect(neighbor)
        lowLink.set(
          node,
          Math.min(lowLink.get(node) ?? Number.POSITIVE_INFINITY, lowLink.get(neighbor) ?? Number.POSITIVE_INFINITY)
        )
      } else if (onStack.has(neighbor)) {
        lowLink.set(
          node,
          Math.min(lowLink.get(node) ?? Number.POSITIVE_INFINITY, index.get(neighbor) ?? Number.POSITIVE_INFINITY)
        )
      }
    }

    if (lowLink.get(node) === index.get(node)) {
      const component: string[] = []
      while (true) {
        const popped = stack.pop()
        if (!popped) break
        onStack.delete(popped)
        component.push(popped)
        if (popped === node) break
      }

      const isCycle = component.length > 1 || (component.length === 1 && (adj.get(component[0]) ?? []).includes(component[0]))
      if (isCycle) {
        const density = computeComponentDensity(component, graph)
        sccs.push({
          id: `scc-${sccs.length}`,
          nodes: component,
          size: component.length,
          isCycle,
          density,
        })
      }
    }
  }

  for (const node of graph.nodes) {
    if (!index.has(node.id)) {
      strongConnect(node.id)
    }
  }

  return sccs
}

/**
 * Compute density of a component.
 *
 * @param nodes Component nodes
 * @param graph Graph data
 * @returns Density (0-1)
 */
function computeComponentDensity(nodes: string[], graph: CodeGraph): number {
  const nodeSet = new Set(nodes)
  let edges = 0

  for (const edge of graph.edges) {
    if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
      edges++
    }
  }

  const maxEdges = nodes.length * (nodes.length - 1)
  return maxEdges > 0 ? edges / maxEdges : 0
}

/**
 * Detect anomalies in the dependency graph.
 *
 * @param cycles Detected cycles
 * @param sccs Strongly connected components
 * @param graph Graph data
 * @returns Array of anomalies
 */
function detectAnomalies(cycles: Cycle[], sccs: StronglyConnectedComponent[], graph: CodeGraph): Anomaly[] {
  const anomalies: Anomaly[] = []

  // Circular dependency anomalies
  const cyclicComponents = sccs.filter(scc => scc.isCycle)
  if (cyclicComponents.length > 0) {
    const nodesInCycles = new Set<string>()
    for (const scc of cyclicComponents) {
      for (const n of scc.nodes) {
        nodesInCycles.add(n)
      }
    }

    anomalies.push({
      type: 'circular',
      severity: cycles.some(c => c.severity === 'CRITICAL') ? 'CRITICAL' : 'HIGH',
      affectedNodes: Array.from(nodesInCycles),
      description: `${cyclicComponents.length} circular dependencies detected`,
      recommendation: 'Break cycles by extracting shared dependencies or inverting dependencies',
    })
  }

  // High coupling anomalies
  const highCouplingNodes = detectHighCoupling(graph)
  if (highCouplingNodes.length > 0) {
    anomalies.push({
      type: 'highCoupling',
      severity: 'MEDIUM',
      affectedNodes: highCouplingNodes,
      description: `${highCouplingNodes.length} nodes have excessive coupling`,
      recommendation: 'Consider modularizing or extracting interfaces',
    })
  }

  // Orphan nodes (isolated components)
  const orphanNodes = detectOrphans(graph)
  if (orphanNodes.length > 0) {
    anomalies.push({
      type: 'orphan',
      severity: 'LOW',
      affectedNodes: orphanNodes,
      description: `${orphanNodes.length} isolated nodes detected`,
      recommendation: 'Review if these should be integrated or removed',
    })
  }

  return anomalies
}

/**
 * Detect nodes with high coupling.
 *
 * @param graph Graph data
 * @returns Nodes with >10 connections
 */
function detectHighCoupling(graph: CodeGraph): string[] {
  const coupling = new Map<string, number>()

  for (const edge of graph.edges) {
    coupling.set(edge.source, (coupling.get(edge.source) ?? 0) + 1)
    coupling.set(edge.target, (coupling.get(edge.target) ?? 0) + 1)
  }

  return Array.from(coupling.entries())
    .filter(([_, count]) => count > 10)
    .map(([node, _]) => node)
}

/**
 * Detect orphan nodes (no connections).
 *
 * @param graph Graph data
 * @returns Orphan node IDs
 */
function detectOrphans(graph: CodeGraph): string[] {
  const connected = new Set<string>()

  for (const edge of graph.edges) {
    connected.add(edge.source)
    connected.add(edge.target)
  }

  return graph.nodes.map(n => n.id).filter(id => !connected.has(id))
}

/**
 * Get cycle detection summary.
 *
 * @param result Cycle detection result
 * @returns Summary string
 */
export function getCycleDetectionSummary(result: CycleDetectionResult): string {
  const lines: string[] = [
    'Cycle Detection Report',
    '='.repeat(40),
    `Has Cycles: ${result.hasCycles ? 'YES' : 'NO'}`,
    `Total Cycles: ${result.cycleCount}`,
    `Nodes in Cycles: ${result.totalNodesInCycles}`,
    `Strongly Connected Components: ${result.strongComponents.length}`,
  ]

  if (result.cycleCount > 0) {
    lines.push('')
    lines.push('Top Cycles:')
    result.cycles.slice(0, 5).forEach((c, i) => {
      lines.push(`  ${i + 1}. [${c.severity}] Length ${c.length}: ${c.nodes.join(' → ')}`)
    })
  }

  if (result.anomalies.length > 0) {
    lines.push('')
    lines.push(`Anomalies Detected: ${result.anomalies.length}`)
    for (const a of result.anomalies.slice(0, 3)) {
      lines.push(`  • [${a.severity}] ${a.type}: ${a.description}`)
    }
  }

  return lines.join('\n')
}
