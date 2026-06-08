/**
 * Generic graph analysis with injected cache (SRP: analysis only).
 */

import type { AnalysisCache } from '../cache/analysis-cache.js'
import type {
  AnalysisResult,
  Community,
  GodNode,
  Graph,
  GraphAnalyzer as GraphAnalyzerContract,
  GraphMetrics,
  SurprisingConnection,
} from '../interfaces/analyzer.interface.js'

interface GraphIndexes {
  neighbors: Map<string, Set<string>>
  edgeKeys: Set<string>
  incidentEdges: Map<string, number>
}

const MAX_CLUSTERING_PAIR_CHECKS_PER_NODE = 50_000

export class GraphAnalyzer implements GraphAnalyzerContract {
  constructor(private readonly cache: AnalysisCache) {}

  async analyze(graph: Graph): Promise<AnalysisResult> {
    const cacheKey = this.generateCacheKey(graph)
    const cached = this.cache.get(cacheKey) as AnalysisResult | null
    if (cached) {
      return cached
    }

    const indexes = this.buildIndexes(graph)
    const result: AnalysisResult = {
      godNodes: this.identifyGodNodes(graph, indexes),
      communities: this.detectCommunities(graph, indexes),
      metrics: this.computeMetrics(graph, indexes),
      surprisingConnections: this.findSurprisingConnections(graph),
    }

    this.cache.set(cacheKey, result)
    return result
  }

  private identifyGodNodes(graph: Graph, indexes: GraphIndexes): GodNode[] {
    const connectivity = new Map<string, number>()

    graph.nodes.forEach(node => {
      connectivity.set(node.id, indexes.incidentEdges.get(node.id) ?? 0)
    })

    const sortedNodes = Array.from(connectivity.entries()).sort((a, b) => {
      const dc = b[1] - a[1]
      if (dc !== 0) return dc
      return a[0].localeCompare(b[0])
    })

    const threshold = Math.ceil(sortedNodes.length * 0.1)

    return sortedNodes.slice(0, threshold).map(([id, connections]) => ({
      id,
      connectivity: connections,
      centrality: this.calculateCentrality(id, graph, indexes),
      influence: this.calculateInfluence(id, graph),
    }))
  }

  private detectCommunities(graph: Graph, indexes: GraphIndexes): Community[] {
    const visited = new Set<string>()
    const communities: Community[] = []

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const community = this.expandCommunity(node.id, graph, visited, indexes)
        if (community.nodes.length > 1) {
          communities.push(community)
        }
      }
    })

    return communities
  }

  private expandCommunity(startNode: string, graph: Graph, visited: Set<string>, indexes: GraphIndexes): Community {
    const community: string[] = []
    const queue = [startNode]
    let head = 0

    while (head < queue.length) {
      const current = queue[head++]
      if (!current || visited.has(current)) continue

      visited.add(current)
      community.push(current)

      for (const neighbor of indexes.neighbors.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor)
      }
    }

    return {
      id: `community-${startNode}`,
      nodes: community,
      cohesion: this.calculateCohesion(community, indexes),
    }
  }

  private computeMetrics(graph: Graph, indexes: GraphIndexes): GraphMetrics {
    const nodeCount = graph.nodes.length
    const edgeCount = graph.edges.length
    const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2

    return {
      nodeCount,
      edgeCount,
      density: maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0,
      avgClustering: this.calculateAverageClustering(graph, indexes),
    }
  }

  private findSurprisingConnections(_graph: Graph): SurprisingConnection[] {
    return []
  }

  private calculateCentrality(nodeId: string, graph: Graph, indexes: GraphIndexes): number {
    if (graph.nodes.length === 0) return 0
    return (indexes.incidentEdges.get(nodeId) ?? 0) / graph.nodes.length
  }

  private calculateInfluence(_nodeId: string, _graph: Graph): number {
    return 0.5
  }

  private calculateCohesion(nodes: string[], indexes: GraphIndexes): number {
    if (nodes.length < 2) return 0

    const nodeSet = new Set(nodes)
    let internalEdges = 0
    for (const node of nodeSet) {
      for (const neighbor of indexes.neighbors.get(node) ?? []) {
        if (nodeSet.has(neighbor)) internalEdges++
      }
    }
    internalEdges /= 2

    const maxInternalEdges = (nodes.length * (nodes.length - 1)) / 2
    return maxInternalEdges > 0 ? internalEdges / maxInternalEdges : 0
  }

  private calculateAverageClustering(graph: Graph, indexes: GraphIndexes): number {
    if (graph.nodes.length < 3) return 0

    let totalClustering = 0
    let counted = 0

    for (const node of graph.nodes) {
      const neighbors = Array.from(indexes.neighbors.get(node.id) ?? [])
      if (neighbors.length < 2) continue

      const possibleTriangles = (neighbors.length * (neighbors.length - 1)) / 2
      let actualTriangles = 0
      let checkedPairs = 0
      const pairBudget = Math.min(possibleTriangles, MAX_CLUSTERING_PAIR_CHECKS_PER_NODE)

      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          checkedPairs++
          if (neighbors[i] && neighbors[j] && this.hasEdge(neighbors[i], neighbors[j], indexes)) {
            actualTriangles++
          }
          if (checkedPairs >= pairBudget) break
        }
        if (checkedPairs >= pairBudget) break
      }

      const clustering = checkedPairs > 0 ? actualTriangles / checkedPairs : 0
      totalClustering += clustering
      counted++
    }

    return counted > 0 ? totalClustering / counted : 0
  }

  private buildIndexes(graph: Graph): GraphIndexes {
    const edgeKeys = new Set<string>()
    const neighborMap = new Map<string, Set<string>>()
    const incidentEdges = new Map<string, number>()

    for (const node of graph.nodes) {
      neighborMap.set(node.id, new Set())
      incidentEdges.set(node.id, 0)
    }

    for (const edge of graph.edges) {
      neighborMap.get(edge.from)?.add(edge.to)
      neighborMap.get(edge.to)?.add(edge.from)
      edgeKeys.add(`${edge.from}\0${edge.to}`)
      edgeKeys.add(`${edge.to}\0${edge.from}`)
      incidentEdges.set(edge.from, (incidentEdges.get(edge.from) ?? 0) + 1)
      incidentEdges.set(edge.to, (incidentEdges.get(edge.to) ?? 0) + 1)
    }

    return { neighbors: neighborMap, edgeKeys, incidentEdges }
  }

  private hasEdge(node1: string, node2: string, indexes: GraphIndexes): boolean {
    return indexes.edgeKeys.has(`${node1}\0${node2}`)
  }

  private generateCacheKey(graph: Graph): string {
    const content = JSON.stringify({
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodeIds: graph.nodes.map(n => n.id).sort(),
      edges: graph.edges.map(e => `${e.from}->${e.to}:${e.type ?? ''}`).sort(),
    })

    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash |= 0
    }

    return `graph-${Math.abs(hash)}`
  }
}
