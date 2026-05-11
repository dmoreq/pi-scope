/**
 * Tests for Wikipedia Subsystem
 */

import { describe, it, expect } from 'vitest'
import { generateWikiPage, wikiPageToMarkdown } from '../../context/graph-wikipedia.js'
import type { GraphifyAnalysis, GraphifyGraph } from '../../context/graph-types.js'

const sampleGraph: GraphifyGraph = {
  nodes: [
    { id: 'core', type: 'function', label: 'Core' },
    { id: 'auth', type: 'function', label: 'Auth' },
    { id: 'database', type: 'module', label: 'Database' },
    { id: 'cache', type: 'module', label: 'Cache' },
  ],
  edges: [
    { source: 'auth', target: 'core', type: 'calls' },
    { source: 'cache', target: 'core', type: 'calls' },
    { source: 'core', target: 'database', type: 'calls' },
    { source: 'auth', target: 'database', type: 'calls' },
  ],
}

const createMockAnalysis = (): GraphifyAnalysis => {
  return {
    godNodes: [
      {
        nodeId: 'core',
        label: 'Core',
        inDegree: 2,
        outDegree: 1,
        betweenness: 0.8,
        pageRank: 0.75,
        community: 'core-comm',
        criticality: 'CRITICAL',
      },
    ],
    communities: [
      {
        id: 'core-comm',
        label: 'Core',
        nodes: ['core'],
        internalDensity: 0.0,
        externalDensity: 1.0,
        interfaceNodes: ['core'],
        bottlenecks: ['core'],
      },
      {
        id: 'auth-comm',
        label: 'Authentication',
        nodes: ['auth'],
        internalDensity: 0.0,
        externalDensity: 1.0,
        interfaceNodes: ['auth'],
        bottlenecks: [],
      },
    ],
    surprises: [],
    bottlenecks: [],
    anomalies: [],
    wikipedia: {
      entries: new Map(),
      query: () => [],
      get: () => undefined,
      find: () => [],
    },
    metrics: {
      totalNodes: 4,
      totalEdges: 4,
      godNodeCount: 1,
      communityCount: 2,
      averageDegree: 2,
      maxDegree: 2,
      graphDensity: 0.33,
      avgClusteringCoeff: 0,
      cycleCount: 0,
      bottleneckCount: 1,
    },
    computedAt: Date.now(),
    version: '1',
  }
}

/** Shorthand: pass analysis + graph together (callers now pass graph explicitly) */
function pageFor(symbol: string): ReturnType<typeof generateWikiPage> {
  return generateWikiPage(symbol, createMockAnalysis(), sampleGraph)
}

describe('Wikipedia', () => {
  // ── Wiki Page Generation ───────────────────────────────────────────

  describe('generateWikiPage', () => {
    it('generates page for god node', () => {
      const page = pageFor('core')

      expect(page.title).toContain('core')
      expect(page.symbol).toBe('core')
      expect(page.metadata.type).toBe('god_node')
      expect(page.metadata.criticality).toBe('CRITICAL')
      expect(page.section.length).toBeGreaterThan(0)
    })

    it('generates page for regular node', () => {
      const page = pageFor('auth')

      expect(page.symbol).toBe('auth')
      expect(page.metadata.type).toBe('regular_node')
      expect(page.section.length).toBeGreaterThan(0)
    })

    it('includes overview section', () => {
      const page = pageFor('core')

      const overview = page.section.find((s) => s.title === 'Overview')
      expect(overview).toBeDefined()
      expect(overview?.content).toContain('core')
    })

    it('includes metrics section for nodes with data', () => {
      const page = pageFor('core')

      const metrics = page.section.find((s) => s.title === 'Key Metrics')
      expect(metrics).toBeDefined()
      expect(metrics?.content).toContain('In-Degree')
    })

    it('includes dependencies section', () => {
      const page = pageFor('core')

      const deps = page.section.find((s) => s.title === 'Dependencies')
      expect(deps).toBeDefined()
      expect(deps?.content).toContain('database')
    })

    it('includes dependents section', () => {
      const page = pageFor('core')

      const dependents = page.section.find((s) => s.title === 'Direct Dependents')
      expect(dependents).toBeDefined()
      expect(dependents?.content).toContain('auth')
    })

    it('includes community section when applicable', () => {
      const page = pageFor('core')

      const community = page.section.find((s) => s.title.includes('Community'))
      expect(community).toBeDefined()
      expect(community?.content).toContain('Core')
    })

    it('includes god node section for critical nodes', () => {
      const page = pageFor('core')

      const godNode = page.section.find((s) => s.title.includes('God Node'))
      expect(godNode).toBeDefined()
      expect(godNode?.content).toContain('CRITICAL')
    })

    it('includes risks and recommendations', () => {
      const page = pageFor('core')

      const risks = page.section.find((s) => s.title === 'Risks & Recommendations')
      expect(risks).toBeDefined()
      expect(risks?.content).toContain('Recommendations')
    })

    it('handles null analysis gracefully', () => {
      const page = generateWikiPage('unknownSymbol', null)

      expect(page.symbol).toBe('unknownSymbol')
      expect(page.metadata.type).toBe('isolated')
      expect(page.section.length).toBeGreaterThan(0)
      expect(page.section[0].content).toContain('No graph analysis')
    })

    it('handles unknown symbols', () => {
      const page = pageFor('unknownModule')

      expect(page.symbol).toBe('unknownModule')
      expect(page.metadata.type).toBe('isolated')
      expect(page.section.length).toBeGreaterThan(0)
    })

    it('sets generation date', () => {
      const page = pageFor('core')

      expect(page.generatedAt).toBeInstanceOf(Date)
    })

    it('uses explicit graph param instead of any-cast analysis.graph', () => {
      const analysis = createMockAnalysis()
      // analysis has NO .graph property — only the explicit param should work
      const page = generateWikiPage('core', analysis, sampleGraph)
      expect(page.metadata.inDegree).toBe(2) // from sampleGraph edges
    })
  })

  // ── Markdown Conversion ────────────────────────────────────────────

  describe('wikiPageToMarkdown', () => {
    it('converts page to markdown', () => {
      const page = pageFor('core')
      const markdown = wikiPageToMarkdown(page)

      expect(markdown).toContain('# ')
      expect(markdown).toContain(page.title)
    })

    it('includes section headers', () => {
      const page = pageFor('core')
      const markdown = wikiPageToMarkdown(page)

      expect(markdown).toContain('## ')
      expect(markdown).toContain('Overview')
    })

    it('includes generation date', () => {
      const page = pageFor('core')
      const markdown = wikiPageToMarkdown(page)

      expect(markdown).toContain('Auto-generated')
    })

    it('is valid markdown', () => {
      const page = pageFor('core')
      const markdown = wikiPageToMarkdown(page)

      expect(markdown).toMatch(/^#/m)
      expect(markdown.length).toBeGreaterThan(100)
    })

    it('preserves content hierarchy', () => {
      const page = pageFor('core')
      const markdown = wikiPageToMarkdown(page)

      const lines = markdown.split('\n')
      const headerLines = lines.filter((l) => l.startsWith('#'))
      expect(headerLines.length).toBeGreaterThan(1)
    })

    it('includes metrics tables', () => {
      const page = pageFor('core')
      const markdown = wikiPageToMarkdown(page)

      expect(markdown).toContain('|')
    })
  })

  // ── Metadata Tests ─────────────────────────────────────────────────

  describe('Wiki metadata', () => {
    it('tracks metadata correctly', () => {
      const page = pageFor('core')

      expect(page.metadata.symbol).toBe('core')
      expect(page.metadata.type).toBe('god_node')
      expect(page.metadata.inDegree).toBe(2)
      expect(page.metadata.outDegree).toBe(1)
      expect(page.metadata.community).toBe('Core')
      expect(page.metadata.criticality).toBe('CRITICAL')
    })

    it('identifies isolated nodes', () => {
      const page = pageFor('isolated')

      expect(page.metadata.type).toBe('isolated')
    })

    it('normalizes symbol names', () => {
      const page1 = pageFor('Core')
      const page2 = pageFor('CORE')

      // Both should find the same node
      expect(page1.metadata.type).toBe('god_node')
      expect(page2.metadata.type).toBe('god_node')
    })
  })

  // ── Integration Tests ──────────────────────────────────────────────

  describe('Full workflow', () => {
    it('generates and formats wiki page', () => {
      const page = pageFor('core')
      const markdown = wikiPageToMarkdown(page)

      expect(markdown).toContain('core')
      expect(markdown).toContain('CRITICAL')
      expect(markdown).toContain('Dependencies')
      expect(markdown).toContain('Recommendations')
    })

    it('generates comprehensive documentation', () => {
      const symbols = ['core', 'auth', 'database', 'cache']

      for (const symbol of symbols) {
        const page = pageFor(symbol)
        expect(page.section.length).toBeGreaterThan(0)
      }
    })
  })
})
