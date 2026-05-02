import { IndexEngine } from './index-engine.js'
import { RepoMapGenerator } from './repo-map-generator.js'
import { ContextInjector } from './context-injector.js'
import { DEFAULT_CONFIG } from './types.js'
import type { SmartContextConfig } from './types.js'

// pi extension factory — called by pi's extension loader
export default async function smartContextExtension(api: {
  on: (event: string, handler: (...args: unknown[]) => unknown) => void
  registerFlag: (name: string, opts: { type: string; default: unknown; description: string }) => void
}): Promise<void> {
  api.registerFlag('smart-context.enabled', {
    type: 'boolean',
    default: DEFAULT_CONFIG.enabled,
    description: 'Enable smart context injection',
  })
  api.registerFlag('smart-context.maxRepoMapTokens', {
    type: 'number',
    default: DEFAULT_CONFIG.maxRepoMapTokens,
    description: 'Token budget for global repo map',
  })
  api.registerFlag('smart-context.maxInjectionTokens', {
    type: 'number',
    default: DEFAULT_CONFIG.maxInjectionTokens,
    description: 'Token budget for per-turn dependency injection',
  })

  let repoMap = ''
  let engine: IndexEngine | null = null
  let injector: ContextInjector | null = null
  let repoMapInjected = false

  api.on('session_start', async (event: unknown) => {
    const ctx = event as { cwd?: string; flags?: Record<string, unknown> }
    const projectRoot = ctx.cwd ?? process.cwd()
    const flags = ctx.flags ?? {}

    const config: SmartContextConfig = {
      ...DEFAULT_CONFIG,
      enabled: (flags['smart-context.enabled'] as boolean | undefined) ?? DEFAULT_CONFIG.enabled,
      maxRepoMapTokens: (flags['smart-context.maxRepoMapTokens'] as number | undefined) ?? DEFAULT_CONFIG.maxRepoMapTokens,
      maxInjectionTokens: (flags['smart-context.maxInjectionTokens'] as number | undefined) ?? DEFAULT_CONFIG.maxInjectionTokens,
    }

    if (!config.enabled) return

    engine = new IndexEngine(projectRoot, config)
    await engine.build()

    const mapGen = new RepoMapGenerator(projectRoot, config.maxRepoMapTokens)
    repoMap = mapGen.generate(engine.getRepoIndex())
    repoMapInjected = false

    injector = new ContextInjector(projectRoot, config.maxInjectionTokens, config.scanLastNMessages)
  })

  api.on('before_agent_start', (event: unknown) => {
    if (!engine || !injector) return undefined

    const e = event as {
      systemPrompt: string
      messages?: Array<{ role: string; content: unknown }>
    }

    let systemPrompt = e.systemPrompt

    if (!repoMapInjected && repoMap) {
      systemPrompt = systemPrompt + '\n\n' + repoMap
      repoMapInjected = true
    }

    const messages = (e.messages ?? []) as Array<{ role: string; content: string }>
    const depContext = injector.buildInjection(engine.getRepoIndex(), messages)
    if (depContext) {
      systemPrompt = systemPrompt + '\n\n' + depContext
    }

    return { systemPrompt }
  })
}
