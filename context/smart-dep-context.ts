/**
 * Enhanced dependency-oriented context: graph-prioritized symbols, tool hints,
 * and community-aware architectural notes (replaces purely static dep summaries).
 */

import type { ContextInsights } from '../shared/intelligence-types.js'
import type { GodNode, GraphifyAnalysis } from './graph-types.js'

export class SmartDependencyContextGenerator {
  /**
   * Build an intelligence-enhanced dependency context block from insights + graph.
   */
  generateEnhancedDependencyContext(
    insights: ContextInsights,
    graphAnalysis: GraphifyAnalysis | null,
  ): string {
    const sections: string[] = []

    const highPri = graphAnalysis
      ? this.collectHighPrioritySymbols(insights, graphAnalysis.godNodes)
      : []
    if (highPri.length > 0 && insights.editingIntent.detected) {
      const lines = highPri.map((g) => `- ${g.label} (${g.criticality})`)
      sections.push(`🎯 HIGH-PRIORITY SYMBOLS\n${lines.join('\n')}`)
    }

    if (insights.editingIntent.detected && insights.editingIntent.hasHashAnnotations) {
      sections.push(
        'Use `hashline_edit` for hash-annotated regions; dry-run first when unsure of blast radius.',
      )
    }

    const toolBlock = this.buildToolRecommendations(insights)
    if (toolBlock) sections.push(toolBlock)

    const arch = graphAnalysis
      ? this.buildCommunityContext(insights, graphAnalysis)
      : null
    if (arch) sections.push(arch)

    for (const p of insights.suboptimalPatterns) {
      if (p.toolSuggestion) {
        sections.push(`Pattern \`${p.pattern}\`: ${p.recommendation} → \`${p.toolSuggestion}\``)
      }
    }

    return sections.join('\n\n')
  }

  private collectHighPrioritySymbols(
    insights: ContextInsights,
    godNodes: GodNode[],
  ): GodNode[] {
    const affected = new Set(
      insights.editingIntent.affectedGodNodes.map((s) => s.toLowerCase()),
    )
    const targets = insights.editingIntent.targetSymbols.map((s) => s.toLowerCase())

    const matches = godNodes.filter((gn) => {
      const id = gn.nodeId.toLowerCase()
      const label = gn.label.toLowerCase()
      if (affected.has(id) || affected.has(label)) return true
      return targets.some(
        (t) => t === id || t === label || label.includes(t) || id.includes(t),
      )
    })

    const order: Record<GodNode['criticality'], number> = {
      CRITICAL: 0,
      IMPORTANT: 1,
      NORMAL: 2,
    }
    return [...matches].sort(
      (a, b) => order[a.criticality] - order[b.criticality] || b.inDegree - a.inDegree,
    )
  }

  private buildToolRecommendations(insights: ContextInsights): string | null {
    const lines: string[] = []

    if (insights.navigationRequests.detected) {
      const { requestType } = insights.navigationRequests
      if (requestType === 'references') {
        lines.push('- Use `lsp_find_references` to enumerate call sites and usages')
      } else if (requestType === 'definition') {
        lines.push('- Use `lsp_go_to_definition` to jump to the canonical declaration')
      } else if (requestType === 'file_location') {
        lines.push('- Use `lsp_go_to_definition` or workspace search to resolve the owning file')
      }
    }

    if (
      insights.editingIntent.detected &&
      insights.editingIntent.affectedGodNodes.length > 0
    ) {
      lines.push(
        '- God-node overlap: run `lsp_find_references` before editing to gauge dependency fan-out',
      )
    }

    if (lines.length === 0) return null
    return `🔧 RECOMMENDED TOOLS\n${lines.join('\n')}`
  }

  private buildCommunityContext(
    insights: ContextInsights,
    graph: GraphifyAnalysis,
  ): string | null {
    const mentioned = new Set(insights.conversationContext.mentionedCommunities)
    const targets = new Set(insights.editingIntent.targetSymbols)

    const relevant = graph.communities.filter(
      (c) =>
        mentioned.has(c.id) ||
        c.nodes.some((n) => targets.has(n)) ||
        [...mentioned].some((m) => c.label.toLowerCase().includes(m.toLowerCase())),
    )

    if (relevant.length === 0) return null

    const lines = relevant.map(
      (c) =>
        `- **${c.label}** (\`${c.id}\`): ${c.nodes.length} symbols — cohesion ${(c.metrics?.cohesion ?? c.internalDensity).toFixed(2)}`,
    )
    return `🏗️ ARCHITECTURAL CONTEXT\n${lines.join('\n')}`
  }
}
