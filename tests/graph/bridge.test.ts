import { describe, expect, it } from 'vitest'
import { repoIndexToCodeGraph } from '../../graph/bridge.js'
import type { RepoIndex } from '../../shared/types.js'

describe('repoIndexToCodeGraph bridge', () => {
  const projectRoot = '/Users/quy.doan/Workspace/personal/pi-scope'

  it('correctly maps symbol-level nodes and edges from RepoIndex', () => {
    // Construct a mock RepoIndex.
    // In engine.ts, symbolIndex maps: symbolName -> array of absolute file paths
    // deps maps: absolute file path -> Set of absolute dependency file paths
    const mockIndex: RepoIndex = {
      skeletons: new Map([
        [`${projectRoot}/manager.ts`, 'export class SessionManager {}'],
        [`${projectRoot}/extension.ts`, 'import { SessionManager } from "./manager"'],
      ]),
      deps: new Map([
        [`${projectRoot}/extension.ts`, new Set([`${projectRoot}/manager.ts`])],
        [`${projectRoot}/manager.ts`, new Set()],
      ]),
      reverseDeps: new Map([
        [`${projectRoot}/manager.ts`, new Set([`${projectRoot}/extension.ts`])],
        [`${projectRoot}/extension.ts`, new Set()],
      ]),
      symbolIndex: new Map([
        ['SessionManager', [`${projectRoot}/manager.ts`]],
      ]),
    }

    const graph = repoIndexToCodeGraph(mockIndex, projectRoot)

    // 1. Verify file nodes are correctly named
    const fileNodes = graph.nodes.filter(n => n.type === 'module')
    expect(fileNodes.map(n => n.id)).toContain('file:manager.ts')
    expect(fileNodes.map(n => n.id)).toContain('file:extension.ts')

    // 2. Verify symbol nodes are correctly structured
    // Expected ID: file:manager.ts:SessionManager
    // Expected Label: SessionManager
    // Expected Type: class
    const symbolNodes = graph.nodes.filter(n => n.type !== 'module')
    expect(symbolNodes).toHaveLength(1)
    const sessionManagerNode = symbolNodes[0]

    expect(sessionManagerNode.id).toBe('file:manager.ts:SessionManager')
    expect(sessionManagerNode.label).toBe('SessionManager')
    expect(sessionManagerNode.type).toBe('class')

    // 3. Verify edges
    // Expected: depends_on edge from file:manager.ts to file:manager.ts:SessionManager
    const dependsOnEdge = graph.edges.find(
      e => e.source === 'file:manager.ts' && e.target === 'file:manager.ts:SessionManager' && e.type === 'depends_on'
    )
    expect(dependsOnEdge).toBeDefined()

    // Expected: uses edge from file:extension.ts to file:manager.ts:SessionManager
    const usesEdge = graph.edges.find(
      e => e.source === 'file:extension.ts' && e.target === 'file:manager.ts:SessionManager' && e.type === 'uses'
    )
    expect(usesEdge).toBeDefined()
  })
})
