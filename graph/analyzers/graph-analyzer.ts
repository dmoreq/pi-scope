/**
 * Generic graph analysis with injected cache (SRP: analysis only).
 */

import type {
  Graph,
  AnalysisResult,
  GraphAnalyzer as GraphAnalyzerContract,
  GodNode,
  Community,
  GraphMetrics,
  SurprisingConnection,
} from '../interfaces/analyzer.interface.js'
import type { AnalysisCache } from '../cache/analysis-cache.js'

export class GraphAnalyzer implements GraphAnalyzerContract {
  constructor(private readonly cache: AnalysisCache) {}

  async analyze(graph: Graph): Promise<AnalysisResult> {
    const cacheKey = this.generateCacheKey(graph)
    const cached = this.cache.get(cacheKey) as AnalysisResult | null
    if (cached) {
      return cached
    }

    const result: AnalysisResult = {
      godNodes: this.identifyGodNodes(graph),
      communities: this.detectCommunities(graph),
      metrics: this.computeMetrics(graph),
      surprisingConnections: this.findSurprisingConnections(graph),
    }

    this.cache.set(cacheKey, result)
    return result
  }

  private identifyGodNodes(graph: Graph): GodNode[] {
    const connectivity = new Map<string, number>()

    graph.nodes.forEach(node => {
      connectivity.set(node.id, 0)
    })

    graph.edges.forEach(edge => {
      connectivity.set(edge.from, (connectivity.get(edge.from) ?? 0) + 1)
      connectivity.set(edge.to, (connectivity.get(edge.to) ?? 0) + 1)
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
      centrality: this.calculateCentrality(id, graph),
      influence: this.calculateInfluence(id, graph),
    }))
  }

  private detectCommunities(graph: Graph): Community[] {
    const visited = new Set<string>()
    const communities: Community[] = []

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const community = this.expandCommunity(node.id, graph, visited)
        if (community.nodes.length > 1) {
          communities.push(community)
        }
      }
    })

    return communities
  }

  private expandCommunity(startNode: string, graph: Graph, visited: Set<string>): Community {
    const community: string[] = []
    const queue = [startNode]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue

      visited.add(current)
      community.push(current)

      const neighbors = graph.edges
        .filter(e => e.from === current || e.to === current)
        .map(e => (e.from === current ? e.to : e.from))
        .filter(n => !visited.has(n))

      queue.push(...neighbors)
    }

    return {
      id: `community-${startNode}`,
      nodes: community,
      cohesion: this.calculateCohesion(community, graph),
    }
  }

  private computeMetrics(graph: Graph): GraphMetrics {
    const nodeCount = graph.nodes.length
    const edgeCount = graph.edges.length
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2

    return {
      nodeCount,
      edgeCount,
      density: maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0,
      avgClustering: this.calculateAverageClustering(graph),
    }
  }

  private findSurprisingConnections(_graph: Graph): SurprisingConnection[] {
    return []
  }

  private calculateCentrality(nodeId: string, graph: Graph): number {
    if (graph.nodes.length === 0) return 0
    const connections = graph.edges.filter(e => e.from === nodeId || e.to === nodeId)
    return connections.length / graph.nodes.length
  }

  private calculateInfluence(_nodeId: string, _graph: Graph): number {
    return 0.5
  }

  private calculateCohesion(nodes: string[], graph: Graph): number {
    if (nodes.length < 2) return 0

    const internalEdges = graph.edges.filter(e =>
      nodes.includes(e.from) && nodes.includes(e.to),
    ).length

    const maxInternalEdges = nodes.length * (nodes.length - 1) / 2
    return maxInternalEdges > 0 ? internalEdges / maxInternalEdges : 0
  }

  private calculateAverageClustering(graph: Graph): number {
    if (graph.nodes.length < 3) return 0

    let totalClustering = 0
    let counted = 0

    for (const node of graph.nodes) {
      const neighbors = this.getNeighbors(node.id, graph)
      if (neighbors.length < 2) continue

      const possibleTriangles = (neighbors.length * (neighbors.length - 1)) / 2
      let actualTriangles = 0

      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          if (this.hasEdge(neighbors[i]!, neighbors[j]!, graph)) {
            actualTriangles++
          }
        }
      }

      const clustering = possibleTriangles > 0 ? actualTriangles / possibleTriangles : 0
      totalClustering += clustering
      counted++
    }

    return counted > 0 ? totalClustering / counted : 0
  }

  private getNeighbors(nodeId: string, graph: Graph): string[] {
    const neighbors = new Set<string>()

    for (const edge of graph.edges) {
      if (edge.from === nodeId) neighbors.add(edge.to)
      if (edge.to === nodeId) neighbors.add(edge.from)
    }

    return Array.from(neighbors)
  }

  private hasEdge(node1: string, node2: string, graph: Graph): boolean {
    return graph.edges.some(edge =>
      (edge.from === node1 && edge.to === node2) ||
      (edge.from === node2 && edge.to === node1),
    )
  }

  private generateCacheKey(graph: Graph): string {
    const content = JSON.stringify({
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodeIds: graph.nodes.map(n => n.id).sort(),
      edges: graph.edges
        .map(e => `${e.from}->${e.to}:${e.type ?? ''}`)
        .sort(),
    })

    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }

    return `graph-${Math.abs(hash)}`
  }
}
