/**
 * Precomputed lookup tables for graph analysis hot paths.
 */

import { normalizeNodeIdForMatch, parseGraphNodeId } from './graph-node-id.js'
import type {
  CodeGraph,
  CommunityAnalysis,
  GodNode,
  GraphAnalysis,
  GraphNode,
  SurprisingConnection,
} from './graph-types.js'

type AnalysisWithGraph = GraphAnalysis & { graph?: CodeGraph }

function addToSetMap<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  let values = map.get(key)
  if (!values) {
    values = new Set<V>()
    map.set(key, values)
  }
  values.add(value)
}

function addToArrayMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key)
  if (values) {
    values.push(value)
    return
  }
  map.set(key, [value])
}

function lowerNodeId(nodeId: string): string {
  return nodeId.toLowerCase()
}

export class GraphLookupIndex {
  readonly graph?: CodeGraph
  readonly nodesById = new Map<string, GraphNode>()
  readonly nodeIdsByNormalized = new Map<string, Set<string>>()
  readonly forwardAdjacency = new Map<string, Set<string>>()
  readonly reverseAdjacency = new Map<string, Set<string>>()
  readonly inDegreeById = new Map<string, number>()
  readonly outDegreeById = new Map<string, number>()
  readonly godNodesByNormalized = new Map<string, GodNode[]>()
  readonly communitiesById = new Map<string, CommunityAnalysis>()
  readonly communityIdsByNode = new Map<string, Set<string>>()
  readonly communityIdsByNormalizedNode = new Map<string, Set<string>>()
  readonly communityFilePathsById = new Map<string, Set<string>>()
  readonly surprisesByNormalizedNode = new Map<string, SurprisingConnection[]>()

  constructor(readonly analysis: GraphAnalysis) {
    this.graph = (analysis as AnalysisWithGraph).graph
    this.indexGraph()
    this.indexGodNodes()
    this.indexCommunities()
    this.indexSurprises()
  }

  resolveSeedIds(lookupKey: string): Set<string> {
    const targetNorm = normalizeNodeIdForMatch(lookupKey)
    const seedIds = new Set<string>()

    for (const id of this.nodeIdsByNormalized.get(targetNorm) ?? []) {
      seedIds.add(id)
    }

    for (const godNode of this.godNodesByNormalized.get(targetNorm) ?? []) {
      seedIds.add(lowerNodeId(godNode.nodeId))
    }

    if (seedIds.size === 0) {
      seedIds.add(lowerNodeId(lookupKey))
    }

    return seedIds
  }

  getForward(nodeId: string): Set<string> {
    return this.forwardAdjacency.get(lowerNodeId(nodeId)) ?? new Set()
  }

  getReverse(nodeId: string): Set<string> {
    return this.reverseAdjacency.get(lowerNodeId(nodeId)) ?? new Set()
  }

  getInDegree(nodeId: string): number {
    return this.inDegreeById.get(lowerNodeId(nodeId)) ?? 0
  }

  getOutDegree(nodeId: string): number {
    return this.outDegreeById.get(lowerNodeId(nodeId)) ?? 0
  }

  findGraphNode(normalizedNodeId: string): GraphNode | undefined {
    const id = this.nodeIdsByNormalized.get(normalizedNodeId)?.values().next().value
    return id ? this.nodesById.get(id) : undefined
  }

  findGodNode(normalizedNodeId: string): GodNode | undefined {
    return this.godNodesByNormalized.get(normalizedNodeId)?.[0]
  }

  findCommunity(normalizedNodeId: string): CommunityAnalysis | undefined {
    const communityId = this.communityIdsByNormalizedNode.get(normalizedNodeId)?.values().next().value
    return communityId ? this.communitiesById.get(communityId) : undefined
  }

  communityIdsForNode(nodeId: string): Set<string> {
    const lower = lowerNodeId(nodeId)
    const normalized = normalizeNodeIdForMatch(nodeId)
    return new Set([
      ...(this.communityIdsByNode.get(lower) ?? []),
      ...(this.communityIdsByNormalizedNode.get(normalized) ?? []),
    ])
  }

  surprisesForNode(normalizedNodeId: string): SurprisingConnection[] {
    return this.surprisesByNormalizedNode.get(normalizedNodeId) ?? []
  }

  private indexGraph(): void {
    for (const node of this.graph?.nodes ?? []) {
      const id = lowerNodeId(node.id)
      this.nodesById.set(id, node)
      addToSetMap(this.nodeIdsByNormalized, normalizeNodeIdForMatch(node.id), id)
      addToSetMap(this.nodeIdsByNormalized, normalizeNodeIdForMatch(node.label), id)
      const parsed = parseGraphNodeId(node.id)
      if (parsed.symbolPart) {
        addToSetMap(this.nodeIdsByNormalized, normalizeNodeIdForMatch(parsed.symbolPart), id)
      }
    }

    for (const edge of this.graph?.edges ?? []) {
      const source = lowerNodeId(edge.source)
      const target = lowerNodeId(edge.target)
      addToSetMap(this.forwardAdjacency, source, target)
      addToSetMap(this.reverseAdjacency, target, source)
      this.outDegreeById.set(source, (this.outDegreeById.get(source) ?? 0) + 1)
      this.inDegreeById.set(target, (this.inDegreeById.get(target) ?? 0) + 1)
    }
  }

  private indexGodNodes(): void {
    for (const godNode of this.analysis.godNodes ?? []) {
      this.addGodNodeKey(godNode, godNode.nodeId)
      this.addGodNodeKey(godNode, godNode.label)
      const parsed = parseGraphNodeId(godNode.nodeId)
      if (parsed.symbolPart) {
        this.addGodNodeKey(godNode, parsed.symbolPart)
      }
    }
  }

  private addGodNodeKey(godNode: GodNode, key: string): void {
    const normalized = normalizeNodeIdForMatch(key)
    addToArrayMap(this.godNodesByNormalized, normalized, godNode)
  }

  private indexCommunities(): void {
    for (const community of this.analysis.communities ?? []) {
      this.communitiesById.set(community.id, community)
      const filePaths = new Set<string>()

      for (const nodeId of community.nodes) {
        const lower = lowerNodeId(nodeId)
        const normalized = normalizeNodeIdForMatch(nodeId)
        addToSetMap(this.communityIdsByNode, lower, community.id)
        addToSetMap(this.communityIdsByNormalizedNode, normalized, community.id)

        const { pathPart, symbolPart } = parseGraphNodeId(nodeId)
        if (!symbolPart) {
          filePaths.add(pathPart.replace(/\\/g, '/'))
        }
      }

      this.communityFilePathsById.set(community.id, filePaths)
    }
  }

  private indexSurprises(): void {
    for (const surprise of this.analysis.surprises ?? []) {
      addToArrayMap(this.surprisesByNormalizedNode, normalizeNodeIdForMatch(surprise.source), surprise)
      addToArrayMap(this.surprisesByNormalizedNode, normalizeNodeIdForMatch(surprise.target), surprise)
    }
  }
}

export function buildGraphLookupIndex(analysis: GraphAnalysis): GraphLookupIndex {
  return new GraphLookupIndex(analysis)
}
