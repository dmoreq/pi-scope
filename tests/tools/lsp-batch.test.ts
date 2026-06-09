import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('lsp batch tools', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('runs batch go-to-definition concurrently while preserving output order', async () => {
    vi.doMock('../../lsp/service.js', () => ({
      LspNavigationService: class {
        async goToDefinition(_path: string, line: number): Promise<{ text: string; paths: string[] }> {
          await new Promise(resolve => setTimeout(resolve, line === 0 ? 80 : 40))
          return { text: `definition-${line}`, paths: [`src/${line}.ts`] }
        }
        async shutdown(): Promise<void> {}
      },
    }))

    const mod = await import('../../tools/lsp-navigation.js')
    mod.setLspSessionEnabled(true)

    const registered: Array<{ name: string; execute: (...a: unknown[]) => Promise<unknown> }> = []
    mod.default({
      registerTool: tool => registered.push(tool as (typeof registered)[0]),
    } as never)

    const batch = registered.find(t => t.name === 'lsp_go_to_definition_batch')
    expect(batch).toBeDefined()

    const started = Date.now()
    const result = await batch!.execute(
      '1',
      {
        positions: [
          { path: 'src/a.ts', line: 0, column: 0 },
          { path: 'src/b.ts', line: 1, column: 0 },
          { path: 'src/c.ts', line: 2, column: 0 },
        ],
      },
      undefined,
      undefined,
      { cwd: '/project' }
    )
    const elapsed = Date.now() - started

    const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? ''
    expect(text.indexOf('definition-0')).toBeLessThan(text.indexOf('definition-1'))
    expect(text.indexOf('definition-1')).toBeLessThan(text.indexOf('definition-2'))
    expect((result as { details: { paths: string[] } }).details.paths).toEqual([
      'src/0.ts',
      'src/1.ts',
      'src/2.ts',
    ])
    expect(elapsed).toBeLessThan(130)
  })
})
