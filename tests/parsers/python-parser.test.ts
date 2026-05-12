import { describe, expect, it } from 'vitest'
import { PythonParser } from '../../parsers/python-parser.js'

const parser = new PythonParser()

describe('PythonParser', () => {
  it('declares .py extension', () => {
    expect(parser.extensions).toContain('.py')
  })

  it('extracts function signature without body', () => {
    const result = parser.parseFile(
      '/src/main.py',
      `
def greet(name: str) -> str:
    return f"Hello {name}"
`
    )
    expect(result.skeleton).toContain('def greet(name: str) -> str: ...')
    expect(result.skeleton).not.toContain('return')
  })

  it('extracts class with method signatures', () => {
    const result = parser.parseFile(
      '/src/agent.py',
      `
class Agent:
    def __init__(self, name: str) -> None:
        self.name = name

    def run(self) -> None:
        print(self.name)
`
    )
    expect(result.skeleton).toContain('class Agent:')
    expect(result.skeleton).toContain('def __init__')
    expect(result.skeleton).toContain('def run')
    expect(result.skeleton).not.toContain('print')
  })

  it('extracts relative imports', () => {
    const result = parser.parseFile(
      '/src/main.py',
      `
from .utils import helper
from ..base import Base
import os
from pathlib import Path
`
    )
    expect(result.imports).toContain('.utils')
    expect(result.imports).toContain('..base')
    expect(result.imports).not.toContain('os')
    expect(result.imports).not.toContain('pathlib')
  })

  it('computes a non-empty contentHash', () => {
    const result = parser.parseFile('/src/main.py', 'x = 1')
    expect(result.contentHash).toHaveLength(64)
  })
})
