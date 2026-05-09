// tests/context/intelligence-engine.test.ts
import { describe, it, expect } from 'vitest'
import { ContextIntelligenceEngine } from '../../context/intelligence-engine.js'
import type { AgentMessage } from '../../manager.js'
import type { GraphifyAnalysis } from '../../context/graph-types.js'

describe('ContextIntelligenceEngine', () => {
  const engine = new ContextIntelligenceEngine()

  const mockGraphAnalysis: GraphifyAnalysis = {
    godNodes: [
      { nodeId: 'Client', label: 'Client', inDegree: 26, outDegree: 5, 
        betweenness: 0, pageRank: 0.15, community: 'core', criticality: 'CRITICAL' }
    ],
    communities: [
      { id: 'auth', label: 'Authentication', nodes: ['authenticate', 'User'], 
        size: 5, density: 0.8, cohesion: 0.9 }
    ],
    surprises: [],
    bottlenecks: [],
    anomalies: [],
    wikipedia: { entries: new Map(), query: () => [], get: () => undefined, find: () => [] },
    metrics: { totalNodes: 100, totalEdges: 200, godNodeCount: 3, communityCount: 4,
      averageDegree: 4, maxDegree: 26, graphDensity: 0.02, avgClusteringCoeff: 0.3,
      cycleCount: 2, bottleneckCount: 1 },
    computedAt: Date.now(),
    version: '1.0.0'
  }

  it('should analyze conversation context', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'edit the authenticate function' },
      { role: 'assistant', content: 'I need to modify the Client class' }
    ]
    
    const insights = engine.analyzeConversationContext(messages)
    
    expect(insights.editingIntent.detected).toBe(true)
    expect(insights.editingIntent.targetSymbols).toContain('authenticate')
    expect(insights.conversationContext.codebaseRelevant).toBe(true)
  })

  it('should generate actionable guidance from insights', () => {
    const insights = {
      editingIntent: { 
        detected: true, targetSymbols: ['Client'], targetFiles: [], 
        hasHashAnnotations: true, affectedGodNodes: ['Client'] 
      },
      navigationRequests: { detected: false, requestedSymbols: [], requestType: 'none' as const },
      suboptimalPatterns: [],
      conversationContext: { recentMessages: 3, codebaseRelevant: true, mentionedCommunities: [], mentionedFiles: [] }
    }
    
    const guidance = engine.generateActionableGuidance(insights, mockGraphAnalysis)
    
    expect(guidance).toContain('HIGH-IMPACT SYMBOLS')
    expect(guidance).toContain('Client')
    expect(guidance).toContain('hashline_edit')
  })

  it('should detect when agent affects god nodes', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'modify the Client class constructor' }
    ]
    
    const insights = engine.analyzeConversationContext(messages)
    const detectedGodNodes = engine.detectAffectedGodNodes(insights.editingIntent, mockGraphAnalysis)
    
    expect(detectedGodNodes).toContain('Client')
  })
})
