/**
 * LSP Hover Enhancement with Graph Metrics
 *
 * Extends hover information with graph-derived insights:
 * - God node status & criticality
 * - Centrality metrics (degree, betweenness)
 * - Community membership
 * - Surprising connections
 * - Impact on dependent code
 */

import { computeDependentFanout } from './graph-impact.js'
import { buildGraphLookupIndex, type GraphLookupIndex } from './graph-lookup-index.js'
import { resolveGraphLookup } from './graph-lsp-resolve.js'
import { normalizeNodeIdForMatch } from './graph-node-id.js'
import type { GodNode, GraphAnalysis, SurprisingConnection } from './graph-types.js'

/**
 * Enhanced hover information with graph metrics.
 */
export interface EnhancedHoverInfo {
  symbol: string
  range: { start: number; end: number }
  baseInfo: string
  reverseDepFiles?: string[]
  graphMetrics?: GraphMetrics
  godNodeInfo?: GodNodeInfo
  surpriseInfo?: SurpriseInfo
  communityInfo?: CommunityInfo
  impactAnalysis?: ImpactAnalysis
}

/**
 * Graph-derived metrics for a symbol.
 */
export interface GraphMetrics {
  inDegree: number
  outDegree: number
  betweenness: number
  pageRank: number
  centrality: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
}

/**
 * GodNode fields plus a pre-computed recommendation string.
 */
type GodNodeInfo = GodNode & { recommendation: string }

/**
 * Surprising connection information.
 */
export interface SurpriseInfo {
  hasUnexpectedConnections: boolean
  types: string[]
  count: number
  topSurprises: SurprisingConnection[]
  recommendation: string
}

/**
 * Community membership information.
 */
export interface CommunityInfo {
  communityId: string
  communityLabel: string
  memberCount: number
  density: number
  isInterfaceNode: boolean
  isBottleneck: boolean
}

/**
 * Impact analysis for code changes — does not redeclare GodNode fields.
 */
interface ImpactAnalysis {
  dependentCount: number
  affectedCommunities: number
  criticalityLevel: GodNode['criticality'] | 'LOW'
  recommendation: string
  example?: string
}

/**
 * Enhance hover information with graph metrics for a symbol.
 *
 * @param symbol Symbol name (e.g., "authenticate", "Database.query")
 * @param baseInfo Base hover info from LSP
 * @param analysis Graph analysis data
 * @returns Enhanced hover information
 */
export function enhanceHoverWithGraphMetrics(
  symbol: string,
  baseInfo: string,
  analysis: GraphAnalysis | null,
  relativeFilePath?: string,
  reverseDepFiles?: string[],
  lookupIndex?: GraphLookupIndex
): EnhancedHoverInfo {
  const resolved = resolveGraphLookup(relativeFilePath, symbol, analysis)
  const lookupKey = resolved.lookupKey

  const hoverInfo: EnhancedHoverInfo = {
    symbol: resolved.nodeId ?? symbol,
    range: { start: 0, end: symbol.length },
    baseInfo,
    reverseDepFiles: reverseDepFiles?.length ? reverseDepFiles.slice(0, 5) : undefined,
  }

  if (!analysis) {
    return hoverInfo
  }

  const index = lookupIndex ?? buildGraphLookupIndex(analysis)
  const nodeId = normalizeNodeIdForMatch(lookupKey)

  // Compute graph metrics
  hoverInfo.graphMetrics = computeGraphMetrics(nodeId, analysis, index)

  // Check if god node
  const godNode = findGodNode(nodeId, analysis, index)
  if (godNode) {
    hoverInfo.godNodeInfo = createGodNodeInfo(godNode)
  }

  // Check for surprising connections
  const surprises = findSurprises(nodeId, analysis, index)
  if (surprises.length > 0) {
    hoverInfo.surpriseInfo = createSurpriseInfo(surprises)
  }

  // Get community info
  const community = findCommunity(nodeId, analysis, index)
  if (community) {
    hoverInfo.communityInfo = createCommunityInfo(community, nodeId)
  }

  // Analyze impact
  hoverInfo.impactAnalysis = analyzeImpact(nodeId, analysis, index)

  return hoverInfo
}

/**
 * Format hover information as markdown.
 *
 * @param hover Enhanced hover info
 * @returns Markdown string for display
 */
export function formatHoverAsMarkdown(hover: EnhancedHoverInfo): string {
  const lines: string[] = []

  // Base info
  lines.push('```')
  lines.push(hover.baseInfo)
  lines.push('```')
  lines.push('')

  // God node info
  if (hover.godNodeInfo) {
    lines.push('## 🌟 God Node')
    lines.push(`**Criticality:** ${hover.godNodeInfo.criticality}`)
    lines.push(`**In-Degree:** ${hover.godNodeInfo.inDegree}`)
    lines.push(`**Out-Degree:** ${hover.godNodeInfo.outDegree}`)
    lines.push(`**PageRank:** ${hover.godNodeInfo.pageRank.toFixed(4)}`)
    lines.push(`**Community:** ${hover.godNodeInfo.community}`)
    lines.push('')
    lines.push(`_${hover.godNodeInfo.recommendation}_`)
    lines.push('')
  }

  // Graph metrics
  if (hover.graphMetrics) {
    lines.push('## 📊 Graph Metrics')
    lines.push(`**Centrality:** ${hover.graphMetrics.centrality}`)
    lines.push(`**In-Degree:** ${hover.graphMetrics.inDegree}`)
    lines.push(`**Out-Degree:** ${hover.graphMetrics.outDegree}`)
    lines.push('')
  }

  // Community info
  if (hover.communityInfo) {
    lines.push('## 🏘️ Community')
    lines.push(`**Community:** ${hover.communityInfo.communityLabel}`)
    lines.push(`**Members:** ${hover.communityInfo.memberCount}`)
    lines.push(`**Density:** ${(hover.communityInfo.density * 100).toFixed(1)}%`)
    if (hover.communityInfo.isInterfaceNode) {
      lines.push('**Role:** Interface Node (bridges communities)')
    }
    if (hover.communityInfo.isBottleneck) {
      lines.push('**Role:** Bottleneck Node (critical path)')
    }
    lines.push('')
  }

  // Surprise info
  if (hover.surpriseInfo?.hasUnexpectedConnections) {
    lines.push('## ⚡ Unexpected Connections')
    lines.push(`**Types:** ${hover.surpriseInfo.types.join(', ')}`)
    lines.push(`**Count:** ${hover.surpriseInfo.count}`)
    lines.push('')
    lines.push(`_${hover.surpriseInfo.recommendation}_`)
    lines.push('')
  }

  if (hover.reverseDepFiles && hover.reverseDepFiles.length > 0) {
    lines.push('## 📥 Used by')
    for (const f of hover.reverseDepFiles) {
      lines.push(`- \`${f}\``)
    }
    lines.push('')
  }

  // Impact analysis
  if (hover.impactAnalysis) {
    lines.push('## 🔗 Impact Analysis')
    lines.push(`**Criticality:** ${hover.impactAnalysis.criticalityLevel}`)
    lines.push(`**Dependents:** ${hover.impactAnalysis.dependentCount}`)
    lines.push(`**Affected Communities:** ${hover.impactAnalysis.affectedCommunities}`)
    lines.push('')
    lines.push(`_${hover.impactAnalysis.recommendation}_`)
    lines.push('')
  }

  return lines.join('\n')
}

/** @deprecated Use normalizeNodeIdForMatch from graph-node-id */
function normalizeNodeId(symbol: string): string {
  return normalizeNodeIdForMatch(symbol)
}

/**
 * Compute graph metrics for a node.
 *
 * @param nodeId Node ID
 * @param analysis Graph analysis
 * @returns Graph metrics
 */
function computeGraphMetrics(nodeId: string, analysis: GraphAnalysis, lookupIndex: GraphLookupIndex): GraphMetrics {
  const godNode = findGodNode(nodeId, analysis, lookupIndex)

  if (godNode) {
    return {
      inDegree: godNode.inDegree,
      outDegree: godNode.outDegree,
      betweenness: godNode.betweenness,
      pageRank: godNode.pageRank,
      centrality: godNode.criticality === 'CRITICAL' ? 'critical' : 'high',
    }
  }

  const graphNode = lookupIndex.findGraphNode(nodeId)
  if (graphNode) {
    const inDegree = lookupIndex.getInDegree(graphNode.id)
    const outDegree = lookupIndex.getOutDegree(graphNode.id)

    return {
      inDegree,
      outDegree,
      betweenness: 0,
      pageRank: 0,
      centrality: outDegree > 5 ? 'high' : outDegree > 2 ? 'medium' : 'low',
    }
  }

  // Fallback: unknown node
  return {
    inDegree: 0,
    outDegree: 0,
    betweenness: 0,
    pageRank: 0,
    centrality: 'unknown',
  }
}

/**
 * Find god node info if exists.
 *
 * @param nodeId Node ID
 * @param analysis Graph analysis
 * @returns God node or undefined
 */
function findGodNode(nodeId: string, _analysis: GraphAnalysis, lookupIndex: GraphLookupIndex): GodNode | undefined {
  return lookupIndex.findGodNode(nodeId)
}

/**
 * Find surprising connections for a node.
 *
 * @param nodeId Node ID
 * @param analysis Graph analysis
 * @returns Array of surprising connections
 */
function findSurprises(
  nodeId: string,
  _analysis: GraphAnalysis,
  lookupIndex: GraphLookupIndex
): SurprisingConnection[] {
  return lookupIndex.surprisesForNode(nodeId)
}

/**
 * Create god node info object — spreads all GodNode fields plus recommendation.
 *
 * @param godNode God node data
 * @returns God node info
 */
function createGodNodeInfo(godNode: GodNode): GodNodeInfo {
  const recommendations: Partial<Record<GodNode['criticality'], string>> = {
    CRITICAL: 'This is a critical hub. Changes may affect many dependent modules. Request code review.',
    IMPORTANT: 'This is a high-importance node. Monitor changes carefully.',
    NORMAL: 'This node has normal importance. Standard review applies.',
  }

  return {
    ...godNode,
    recommendation: recommendations[godNode.criticality] ?? 'Standard review applies.',
  }
}

/**
 * Create surprise info object.
 *
 * @param surprises Surprising connections
 * @returns Surprise info
 */
function createSurpriseInfo(surprises: SurprisingConnection[]): SurpriseInfo {
  const types = Array.from(new Set(surprises.map((s: SurprisingConnection) => s.reason || (s as any).type)))

  return {
    hasUnexpectedConnections: true,
    types,
    count: surprises.length,
    topSurprises: surprises.slice(0, 3),
    recommendation: 'This node has unexpected connections. Consider refactoring to improve modularity.',
  }
}

/**
 * Find community for a node.
 *
 * @param nodeId Node ID
 * @param analysis Graph analysis
 * @returns Community or undefined
 */
function findCommunity(nodeId: string, _analysis: GraphAnalysis, lookupIndex: GraphLookupIndex) {
  return lookupIndex.findCommunity(nodeId)
}

/**
 * Create community info object.
 *
 * @param community Community data
 * @param nodeId Node ID
 * @returns Community info
 */
function createCommunityInfo(community: GraphAnalysis['communities'][0], nodeId: string): CommunityInfo {
  return {
    communityId: community.id,
    communityLabel: community.label,
    memberCount: community.nodes.length,
    density: community.internalDensity,
    isInterfaceNode: community.interfaceNodes.some(n => normalizeNodeId(n) === nodeId),
    isBottleneck: community.bottlenecks.some(n => normalizeNodeId(n) === nodeId),
  }
}

/**
 * Analyze impact of changes to a node.
 *
 * @param nodeId Node ID
 * @param analysis Graph analysis
 * @returns Impact analysis
 */
function analyzeImpact(nodeId: string, analysis: GraphAnalysis, lookupIndex: GraphLookupIndex): ImpactAnalysis {
  const { dependentCount, affectedCommunities } = computeDependentFanout(nodeId, analysis, lookupIndex)

  const godNode = findGodNode(nodeId, analysis, lookupIndex)
  const criticality: GodNode['criticality'] | 'LOW' = godNode ? godNode.criticality : 'LOW'

  const recommendations: Record<string, string> = {
    CRITICAL: `Changes here will impact ${dependentCount} dependents across ${affectedCommunities} communities. Schedule mandatory code review.`,
    HIGH: `Changes will affect ${dependentCount} dependents. Request code review.`,
    MEDIUM: `Changes may affect ${dependentCount} dependents. Standard review applies.`,
    LOW: 'Changes have limited impact. Normal review process.',
  }

  return {
    dependentCount,
    affectedCommunities,
    criticalityLevel: criticality,
    recommendation: recommendations[criticality],
    example: undefined,
  }
}

/**
 * Get summary statistics for a node's graph role.
 *
 * @param symbol Symbol name
 * @param analysis Graph analysis
 * @returns Summary statistics
 */
export function getNodeRoleSummary(
  symbol: string,
  analysis: GraphAnalysis | null,
  lookupIndex?: GraphLookupIndex
): {
  isCritical: boolean
  summary: string
  metrics: string[]
} {
  if (!analysis) {
    return { isCritical: false, summary: 'No graph analysis available', metrics: [] }
  }

  const nodeId = normalizeNodeId(symbol)
  const index = lookupIndex ?? buildGraphLookupIndex(analysis)
  const godNode = findGodNode(nodeId, analysis, index)
  const community = findCommunity(nodeId, analysis, index)
  const surprises = findSurprises(nodeId, analysis, index)

  const metrics: string[] = []
  const isCritical = godNode?.criticality === 'CRITICAL'

  if (godNode) {
    metrics.push(`🌟 God Node (${godNode.criticality})`)
    metrics.push(`In-degree: ${godNode.inDegree}`)
    metrics.push(`PageRank: ${godNode.pageRank.toFixed(3)}`)
  }

  if (community) {
    metrics.push(`Community: ${community.label}`)
    if (community.interfaceNodes.some(n => normalizeNodeId(n) === nodeId)) {
      metrics.push('Role: Interface')
    }
    if (community.bottlenecks.some(n => normalizeNodeId(n) === nodeId)) {
      metrics.push('Role: Bottleneck')
    }
  }

  if (surprises.length > 0) {
    metrics.push(`⚡ ${surprises.length} unexpected connections`)
  }

  const summary = metrics.join(' • ')

  return { isCritical, summary, metrics }
}
