/**
 * pi-scope build script — uses esbuild for fast ESM compilation.
 * Replaces `tsc` which fails due to noEmit + pre-existing type errors.
 */
import * as esbuild from 'esbuild'
import { writeFileSync } from 'node:fs'

const entryPoints = [
  'extension.ts',
  'manager.ts',
  'shared/*.ts',
  'context/*.ts',
  'hashline/*.ts',
  'indexer/*.ts',
  'lsp/*.ts',
  'metrics/*.ts',
  'parsers/*.ts',
  'persistence/*.ts',
  'plugins/*.ts',
  'services/*.ts',
  'tools/*.ts',
  'ui/*.ts',
  'visualization/*.ts',
]

await esbuild.build({
  entryPoints,
  outdir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  bundle: false,
  logLevel: 'info',
})

// Generate .d.ts stub for query-intent (no tsc available)
writeFileSync('dist/shared/query-intent.d.ts',
  '/** Returns true if the query is a broad codebase-introspection question. */\n' +
  'export declare function isBroadCodebaseQuery(text: string): boolean;\n')

console.log('Build complete.')
