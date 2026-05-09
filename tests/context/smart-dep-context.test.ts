// tests/context/smart-dep-context.test.ts
import { describe, it, expect } from 'vitest'
import { SmartDependencyContextGenerator } from '../../context/smart-dep-context.js'
import type { GraphifyAnalysis } from '../../context/graph-types.js'
import type { ContextInsights } from '../../shared/intelligence-types.js'

describe('SmartDependencyContextGenerator', () => {
  const generator = new SmartDependencyContextGenerator()

  const mockGraphAnalysis: GraphifyAnalysis = {
    godNodes: [
      {
        nodeId: 'Client',
        label: 'Client',
        inDegree: 26,
        outDegree: 5,
        betweenness: 0,
        pageRank: 0.15,
        community: 'core',
        criticality: 'CRITICAL',
      },
    ],
    communities: [
      {
        id: 'auth',
        label: 'Authentication',
        nodes: ['authenticate', 'User'],
        internalDensity: 0.9,
        externalDensity: 0.1,
        interfaceNodes: [],
        bottlenecks: [],
        metrics: { cohesion: 0.9 },
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
      totalNodes: 100,
      totalEdges: 200,
      godNodeCount: 3,
      communityCount: 4,
      averageDegree: 4,
      maxDegree: 26,
      graphDensity: 0.02,
      avgClusteringCoeff: 0.3,
      cycleCount: 2,
      bottleneckCount: 1,
    },
    computedAt: Date.now(),
    version: '1.0.0',
  }

  it('should prioritize god nodes in dependency context', () => {
    const insights: ContextInsights = {
      editingIntent: {
        detected: true,
        targetSymbols: ['Client'],
        targetFiles: [],
        hasHashAnnotations: true,
        affectedGodNodes: ['Client'],
      },
      navigationRequests: {
        detected: false,
        requestedSymbols: [],
        requestType: 'none',
      },
      suboptimalPatterns: [],
      conversationContext: {
        recentMessages: 3,
        codebaseRelevant: true,
        mentionedCommunities: [],
        mentionedFiles: [],
      },
    }

    const context = generator.generateEnhancedDependencyContext(insights, mockGraphAnalysis)

    expect(context).toContain('🎯 HIGH-PRIORITY SYMBOLS')
    expect(context).toContain('Client (CRITICAL)')
    expect(context).toContain('hashline_edit')
  })

  it('should generate tool recommendations based on patterns', () => {
    const insights: ContextInsights = {
      editingIntent: {
        detected: false,
        targetSymbols: [],
        targetFiles: [],
        hasHashAnnotations: false,
        affectedGodNodes: [],
      },
      navigationRequests: {
        detected: true,
        requestedSymbols: ['User'],
        requestType: 'references',
      },
      suboptimalPatterns: [],
      conversationContext: {
        recentMessages: 2,
        codebaseRelevant: true,
        mentionedCommunities: [],
        mentionedFiles: [],
      },
    }

    const context = generator.generateEnhancedDependencyContext(insights, mockGraphAnalysis)

    expect(context).toContain('🔧 RECOMMENDED TOOLS')
    expect(context).toContain('lsp_find_references')
  })

  it('should include community context when relevant', () => {
    const insights: ContextInsights = {
      editingIntent: {
        detected: true,
        targetSymbols: ['authenticate'],
        targetFiles: [],
        hasHashAnnotations: false,
        affectedGodNodes: [],
      },
      navigationRequests: {
        detected: false,
        requestedSymbols: [],
        requestType: 'none',
      },
      suboptimalPatterns: [],
      conversationContext: {
        recentMessages: 2,
        codebaseRelevant: true,
        mentionedCommunities: ['auth'],
        mentionedFiles: [],
      },
    }

    const context = generator.generateEnhancedDependencyContext(insights, mockGraphAnalysis)

    expect(context).toContain('🏗️ ARCHITECTURAL CONTEXT')
    expect(context).toContain('Authentication')
  })
})
