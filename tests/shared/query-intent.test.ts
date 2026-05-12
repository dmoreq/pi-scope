import { describe, expect, it } from 'vitest'
import { isBroadCodebaseQuery } from '../../shared/query-intent.js'

describe('isBroadCodebaseQuery', () => {
  it('detects "what does this codebase do" queries', () => {
    expect(isBroadCodebaseQuery('Tell me what does this codebase do')).toBe(true)
    expect(isBroadCodebaseQuery('what does this project do?')).toBe(true)
    expect(isBroadCodebaseQuery('explain this codebase to me')).toBe(true)
  })

  it('detects architecture/structure questions', () => {
    expect(isBroadCodebaseQuery('How is this project structured?')).toBe(true)
    expect(isBroadCodebaseQuery('Show me the architecture')).toBe(true)
    expect(isBroadCodebaseQuery('What is the project layout?')).toBe(true)
  })

  it('detects purpose/overview questions', () => {
    expect(isBroadCodebaseQuery("What's the purpose of this project?")).toBe(true)
    expect(isBroadCodebaseQuery('Give me an overview of this codebase')).toBe(true)
    expect(isBroadCodebaseQuery('What does this repository contain?')).toBe(true)
  })

  it('detects "main files" / "key files" questions', () => {
    expect(isBroadCodebaseQuery('Show me the main files')).toBe(true)
    expect(isBroadCodebaseQuery('What are the key files?')).toBe(true)
    expect(isBroadCodebaseQuery('What files should I look at?')).toBe(true)
    expect(isBroadCodebaseQuery('Which files are most important?')).toBe(true)
  })

  it('detects "tell me about this project" queries', () => {
    expect(isBroadCodebaseQuery('Tell me about this project')).toBe(true)
    expect(isBroadCodebaseQuery('Describe this codebase')).toBe(true)
    expect(isBroadCodebaseQuery('Summarize this project')).toBe(true)
  })

  it('rejects casual conversation', () => {
    expect(isBroadCodebaseQuery('Hello, how are you?')).toBe(false)
    expect(isBroadCodebaseQuery('What time is it?')).toBe(false)
    expect(isBroadCodebaseQuery('Thanks for your help')).toBe(false)
  })

  it('rejects specific symbol queries (handled by other triggers)', () => {
    // These are codebase-relevant but specific — not "broad" overview queries
    expect(isBroadCodebaseQuery('Find the SessionManager class')).toBe(false)
    expect(isBroadCodebaseQuery('Edit manager.ts line 42')).toBe(false)
    expect(isBroadCodebaseQuery('fix the bug in authenticate')).toBe(false)
  })

  it('rejects empty and whitespace strings', () => {
    expect(isBroadCodebaseQuery('')).toBe(false)
    expect(isBroadCodebaseQuery('   ')).toBe(false)
  })
})
