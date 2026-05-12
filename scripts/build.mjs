#!/usr/bin/env node
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
/**
 * pi-scope build script — transpile TS to JS using esbuild.
 * Generates .js files in dist/ with proper module resolution.
 */
import { buildSync } from 'esbuild'

const entryPoints = []

function findTS(dir) {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.')) continue
      if (['node_modules', 'dist', 'tests', 'skills', 'scripts'].includes(entry)) continue
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        findTS(full)
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        entryPoints.push(full)
      }
    }
  } catch (_err) {
    // Ignore unreadable dirs
  }
}

findTS('.')

if (entryPoints.length === 0) {
  console.error('No TypeScript files found')
  process.exit(1)
}

console.log(`Building ${entryPoints.length} TypeScript files...`)

try {
  buildSync({
    entryPoints,
    outdir: 'dist',
    format: 'esm',
    platform: 'node',
    target: 'ES2022',
    keepNames: true,
    sourcemap: false,
    minify: false,
  })

  console.log(`✓ Built ${entryPoints.length} files to dist/`)
} catch (err) {
  console.error('✗ Build failed:', err.message || err)
  process.exit(1)
}

// Generate .d.ts stub for query-intent
try {
  mkdirSync(join('dist', 'shared'), { recursive: true })
  writeFileSync(
    join('dist', 'shared', 'query-intent.d.ts'),
    '/** Returns true if the query is a broad codebase-introspection question. */\n' +
      'export declare function isBroadCodebaseQuery(text: string): boolean;\n'
  )
} catch (_err) {
  // Ignore if unable to write
}
