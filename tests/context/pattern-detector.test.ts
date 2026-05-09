// tests/context/pattern-detector.test.ts
import { describe, it, expect } from 'vitest'
import { AgentPatternDetector } from '../../context/pattern-detector.js'
import type { AgentMessage } from '../../manager.js'

describe('AgentPatternDetector', () => {
  const detector = new AgentPatternDetector()

  it('should detect editing intent from messages', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'edit the authenticate function' },
      { role: 'assistant', content: 'I need to modify the authentication logic' }
    ]

    const context = detector.detectEditingIntent(messages)

    expect(context.detected).toBe(true)
    expect(context.targetSymbols).toContain('authenticate')
  })

  it('should detect navigation requests', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'where is the Client class defined?' },
      { role: 'assistant', content: 'Let me find the Client class for you' }
    ]

    const context = detector.detectNavigationRequests(messages)

    expect(context.detected).toBe(true)
    expect(context.requestedSymbols).toContain('Client')
    expect(context.requestType).toBe('definition')
  })

  it('should detect suboptimal tool usage patterns', () => {
    const messages: AgentMessage[] = [
      { role: 'assistant', content: 'I need to read the file first' },
      { role: 'assistant', content: 'Using StrReplace to edit the function' }
    ]

    const issues = detector.detectSuboptimalToolUsage(messages)

    expect(issues).toHaveLength(1)
    expect(issues[0].pattern).toBe('basic_file_edit')
    expect(issues[0].recommendation).toContain('hashline_edit')
  })
})
