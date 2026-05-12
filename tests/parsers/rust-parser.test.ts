import { describe, expect, it } from 'vitest'
import { RustParser } from '../../parsers/rust-parser.js'

const parser = new RustParser()

describe('RustParser', () => {
  it('declares .rs extension', () => {
    expect(parser.extensions).toContain('.rs')
  })

  it('extracts function signature without body', () => {
    const result = parser.parseFile(
      '/src/lib.rs',
      `
pub fn parse(input: &str) -> Result<Ast, Error> {
    todo!()
}
`
    )
    expect(result.skeleton).toContain('pub fn parse')
    expect(result.skeleton).toContain('{ ... }')
    expect(result.skeleton).not.toContain('todo!')
  })

  it('extracts struct declaration', () => {
    const result = parser.parseFile(
      '/src/lib.rs',
      `
pub struct Parser {
    input: String,
    pos: usize,
}
`
    )
    expect(result.skeleton).toContain('pub struct Parser')
    expect(result.skeleton).toContain('{ ... }')
    expect(result.skeleton).not.toContain('input: String')
  })

  it('extracts enum declaration', () => {
    const result = parser.parseFile(
      '/src/lib.rs',
      `
pub enum Status {
    Idle,
    Running,
    Done,
}
`
    )
    expect(result.skeleton).toContain('pub enum Status')
  })

  it('extracts trait declaration', () => {
    const result = parser.parseFile(
      '/src/lib.rs',
      `
pub trait Visitor {
    fn visit(&self, node: &Node);
}
`
    )
    expect(result.skeleton).toContain('pub trait Visitor')
  })

  it('extracts mod imports', () => {
    const result = parser.parseFile(
      '/src/lib.rs',
      `
mod utils;
mod parser;
use std::collections::HashMap;
use crate::types::Ast;
`
    )
    expect(result.imports).toContain('mod:utils')
    expect(result.imports).toContain('mod:parser')
    expect(result.imports).toContain('crate::types::Ast')
    // std is external, not included
    expect(result.imports).not.toContain('std::collections::HashMap')
  })

  it('computes a non-empty contentHash', () => {
    const result = parser.parseFile('/src/lib.rs', 'fn main() {}')
    expect(result.contentHash).toHaveLength(64)
  })
})
