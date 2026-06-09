import { describe, expect, it } from 'vitest'
import { computeDependentFanout } from '../../context/graph-impact'
import { buildGraphLookupIndex } from '../../context/graph-lookup-index'
import type { GraphAnalysis } from '../../context/graph-types'

describe('computeDependentFanout', () => {
  it('counts incoming dependents via BFS (not out-edges)', () => {
    const analysis = {
      graph: {
        nodes: [
          { id: 'auth', type: 'function', label: 'auth' },
          { id: 'api', type: 'function', label: 'api' },
          { id: 'ui', type: 'function', label: 'ui' },
        ],
        edges: [
          { source: 'api', target: 'auth', type: 'calls' },
          { source: 'ui', target: 'auth', type: 'calls' },
        ],
      },
      godNodes: [],
      communities: [],
      surprises: [],
      bottlenecks: [],
      anomalies: [],
      metrics: {
        totalNodes: 3,
        totalEdges: 2,
        communityCount: 0,
        cycleCount: 0,
        godNodeCount: 0,
        bottleneckCount: 0,
        surpriseCount: 0,
        density: 0,
        avgDegree: 0,
      },
    } as GraphAnalysis

    const { dependentCount, affectedCommunities } = computeDependentFanout('auth', analysis)
    expect(dependentCount).toBe(2)
    expect(affectedCommunities).toBeGreaterThanOrEqual(0)
  })

  it('uses indexed reverse adjacency for transitive fanout and communities', () => {
    const analysis = {
      graph: {
        nodes: [
          { id: 'file:src/auth.ts:authenticate', type: 'function', label: 'authenticate' },
          { id: 'file:src/api.ts:handler', type: 'function', label: 'handler' },
          { id: 'file:src/ui.ts:button', type: 'function', label: 'button' },
        ],
        edges: [
          { source: 'file:src/api.ts:handler', target: 'file:src/auth.ts:authenticate', type: 'calls' },
          { source: 'file:src/ui.ts:button', target: 'file:src/api.ts:handler', type: 'calls' },
        ],
      },
      godNodes: [
        {
          nodeId: 'file:src/auth.ts:authenticate',
          label: 'Authenticate',
          inDegree: 1,
          outDegree: 0,
          betweenness: 0,
          pageRank: 0,
          community: 'auth',
          criticality: 'IMPORTANT',
        },
      ],
      communities: [
        {
          id: 'api',
          label: 'API',
          nodes: ['file:src/api.ts:handler'],
          internalDensity: 0.5,
          externalDensity: 0.5,
          interfaceNodes: [],
          bottlenecks: [],
        },
        {
          id: 'ui',
          label: 'UI',
          nodes: ['file:src/ui.ts:button'],
          internalDensity: 0.5,
          externalDensity: 0.5,
          interfaceNodes: [],
          bottlenecks: [],
        },
      ],
      surprises: [],
      bottlenecks: [],
      anomalies: [],
      metrics: {},
    } as GraphAnalysis

    const index = buildGraphLookupIndex(analysis)
    const result = computeDependentFanout('authenticate', analysis, index)

    expect(result.dependentCount).toBe(2)
    expect(result.affectedCommunities).toBe(2)
  })

  it('matches file-scoped graph node symbols without requiring a god node', () => {
    const analysis = {
      graph: {
        nodes: [
          { id: 'file:src/auth.ts:authenticate', type: 'function', label: 'authenticate' },
          { id: 'file:src/api.ts:handler', type: 'function', label: 'handler' },
        ],
        edges: [{ source: 'file:src/api.ts:handler', target: 'file:src/auth.ts:authenticate', type: 'calls' }],
      },
      godNodes: [],
      communities: [],
      surprises: [],
      bottlenecks: [],
      anomalies: [],
      metrics: {},
    } as GraphAnalysis

    expect(computeDependentFanout('authenticate', analysis, buildGraphLookupIndex(analysis)).dependentCount).toBe(1)
  })
})
