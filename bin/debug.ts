#!/usr/bin/env tsx
/**
 * Usage:
 *   npx tsx bin/debug.ts <project-folder> [--no-color] [--ts-top <n>]
 *   make debug FOLDER=<project-folder>
 *
 * Flags:
 *   --no-color       Plain text output (for piping / grep)
 *   --ts-top <n>     How many top-fanout TypeScript files to show (default: 20)
 *   --no-ts          Skip TypeScript dep graph (speeds up output on huge TS repos)
 *   --exclude <glob> Extra exclude glob (repeatable)
 */

import { relative, resolve } from 'node:path'
import { IndexEngine } from '../src/index-engine.js'
import { RepoMapGenerator } from '../src/repo-map-generator.js'
import { ContextInjector } from '../src/context-injector.js'
import { DEFAULT_CONFIG } from '../src/types.js'

// ── CLI parsing ───────────────────────────────────────────────────────────

const argv = process.argv.slice(2)

if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
  console.error(`
Usage: npx tsx bin/debug.ts <project-folder> [options]

Options:
  --no-color       Plain text (for piping / grep)
  --ts-top <n>     Top N TypeScript files by import count (default: 20)
  --no-ts          Skip TypeScript dep graph section
  --exclude <glob> Extra exclude pattern, repeatable

Example:
  npx tsx bin/debug.ts ~/projects/my-app
  npx tsx bin/debug.ts ~/projects/my-app --exclude 'vendor/**' --ts-top 10
  make debug FOLDER=~/projects/my-app
`)
  process.exit(1)
}

const projectRoot = resolve(argv[0])
let useColor = true
let tsTop = 20
let showTs = true
const extraExcludes: string[] = []

for (let i = 1; i < argv.length; i++) {
  if (argv[i] === '--no-color') { useColor = false }
  else if (argv[i] === '--no-ts') { showTs = false }
  else if (argv[i] === '--ts-top' && argv[i + 1]) { tsTop = parseInt(argv[++i], 10) }
  else if (argv[i] === '--exclude' && argv[i + 1]) { extraExcludes.push(argv[++i]) }
}

// ── Colour helpers ────────────────────────────────────────────────────────

const c = (code: string) => (s: string) => useColor ? `\x1b[${code}m${s}\x1b[0m` : s
const bold    = c('1')
const dim     = c('2')
const cyan    = c('36')
const green   = c('32')
const yellow  = c('33')
const magenta = c('35')
const red     = c('31')

function header(title: string) {
  const bar = '═'.repeat(62)
  console.log(`\n${bold(magenta(bar))}`)
  console.log(bold(magenta(`  ${title}`)))
  console.log(bold(magenta(bar)))
}

function step(label: string) {
  console.log(`\n${bold(cyan(`── ${label}`))}`)
}

function kv(key: string, val: unknown) {
  console.log(`  ${green(key + ':')} ${val}`)
}

function note(msg: string) {
  console.log(`  ${dim(msg)}`)
}

function warn(msg: string) {
  console.log(`  ${yellow('⚠  ' + msg)}`)
}

// ── Config ────────────────────────────────────────────────────────────────

const config = {
  ...DEFAULT_CONFIG,
  exclude: [...DEFAULT_CONFIG.exclude, ...extraExcludes],
}

const rel = (p: string) => relative(projectRoot, p)

// ── Phase 1: Build index ──────────────────────────────────────────────────

header('PHASE 1 — INDEX ENGINE')

step('Configuration')
kv('Project root', projectRoot)
kv('Max repo-map tokens', config.maxRepoMapTokens)
kv('Max injection tokens', config.maxInjectionTokens)
kv('Scan last N messages', config.scanLastNMessages)
kv('Exclude patterns', JSON.stringify(config.exclude))

step('Building index  (walk → hash → parse → cache)')
note('First run parses every file via tree-sitter and writes a disk cache.')
note('Subsequent runs load from cache; only changed files are re-parsed.')

const t0 = Date.now()
const engine = new IndexEngine(projectRoot, config)
await engine.build()
const buildMs = Date.now() - t0
const index = engine.getRepoIndex()

kv('Build time', `${buildMs}ms`)
kv('Files indexed', index.skeletons.size)
kv('Dep edges', [...index.deps.values()].reduce((s, v) => s + v.size, 0))

step('File breakdown by extension')
const byExt: Record<string, number> = {}
for (const p of index.skeletons.keys()) {
  const ext = p.slice(p.lastIndexOf('.'))
  byExt[ext] = (byExt[ext] ?? 0) + 1
}
for (const [ext, n] of Object.entries(byExt).sort(([, a], [, b]) => b - a)) {
  console.log(`  ${ext.padEnd(8)} ${n} files`)
}

step('File breakdown by top-level directory')
const byDir: Record<string, { files: number; edges: number }> = {}
for (const [p, deps] of index.deps) {
  const dir = rel(p).split('/')[0]
  if (!byDir[dir]) byDir[dir] = { files: 0, edges: 0 }
  byDir[dir].files++
  byDir[dir].edges += deps.size
}
for (const [dir, { files, edges }] of Object.entries(byDir).sort()) {
  console.log(`  ${dir.padEnd(32)} ${String(files).padStart(5)} files   ${String(edges).padStart(5)} edges`)
}

step('Sample skeletons (first 2 files per extension)')
for (const [ext, count] of Object.entries(byExt).sort()) {
  let shown = 0
  console.log(`\n  ${green(ext)}  (${count} files)`)
  for (const [p, sk] of index.skeletons) {
    if (!p.endsWith(ext)) continue
    const preview = sk.split('\n').slice(0, 3).join(' | ').slice(0, 120)
    console.log(`  ${dim(rel(p))}`)
    console.log(`    ${dim(preview || '(empty skeleton)')}`)
    if (++shown >= 2) break
  }
}

step('Cache warm rebuild (proving disk cache works)')
note('Re-running build — all files should hit cache (no re-parsing)…')
const t1 = Date.now()
await engine.build()
const warmMs = Date.now() - t1
kv('Warm build time', `${warmMs}ms  (${Math.round(buildMs / Math.max(warmMs, 1))}× faster than cold)`)

// ── Phase 2: Repo map ─────────────────────────────────────────────────────

header('PHASE 2 — REPO MAP')

step(`Generating (budget: ${config.maxRepoMapTokens} tokens)`)
const mapGen = new RepoMapGenerator(projectRoot, config.maxRepoMapTokens)
const repoMap = mapGen.generate(index)
const mapTokens = Math.ceil(repoMap.length / 4)
const mapLines  = repoMap.split('\n')

kv('Estimated tokens', `${mapTokens} / ${config.maxRepoMapTokens}`)
kv('Lines', mapLines.length)

const dirsInMap = mapLines.filter(l => /^  \S/.test(l)).map(l => l.trim())
kv('Directories covered', dirsInMap.length)
for (const d of dirsInMap) note(`  ${d}`)

step('Full output')
console.log(repoMap)

// ── Phase 3: Dependency graph ─────────────────────────────────────────────

header('PHASE 3 — DEPENDENCY GRAPH')

// ── Rust ──────────────────────────────────────────────────────────────────
const rustEntries = [...index.deps.entries()]
  .filter(([p, d]) => p.endsWith('.rs') && d.size > 0)
  .sort(([a], [b]) => rel(a).localeCompare(rel(b)))

step(`Rust  (${rustEntries.length} files with deps)`)
for (const [p, deps] of rustEntries) {
  console.log(`  ${green(rel(p))}  [${deps.size}]`)
  for (const d of [...deps].map(rel).sort()) console.log(`    → ${d}`)
}

// ── Python ────────────────────────────────────────────────────────────────
const pyEntries = [...index.deps.entries()]
  .filter(([p, d]) => p.endsWith('.py') && d.size > 0)
  .sort(([a], [b]) => rel(a).localeCompare(rel(b)))

step(`Python  (${pyEntries.length} files with deps)`)
if (pyEntries.length === 0) {
  note('No Python files with tracked relative imports found.')
} else {
  for (const [p, deps] of pyEntries) {
    console.log(`  ${green(rel(p))}  [${deps.size}]`)
    for (const d of [...deps].map(rel).sort()) console.log(`    → ${d}`)
  }
}

// ── TypeScript ────────────────────────────────────────────────────────────
if (showTs) {
  const tsEntries = [...index.deps.entries()]
    .filter(([p, d]) => (p.endsWith('.ts') || p.endsWith('.tsx')) && d.size > 0)
    .sort(([, a], [, b]) => b.size - a.size)

  const tsTotal = tsEntries.length
  const tsShown = tsEntries.slice(0, tsTop)

  step(`TypeScript — top ${tsTop} by import count  (${tsTotal} files total have deps)`)
  note(`Sorted by outgoing import count, descending. Use --ts-top N to change.`)
  for (const [p, deps] of tsShown) {
    console.log(`  ${green(rel(p))}  [${bold(String(deps.size))} imports]`)
    for (const d of [...deps].map(rel).sort()) console.log(`    → ${d}`)
  }
  if (tsTotal > tsTop) {
    note(`… ${tsTotal - tsTop} more TypeScript files with deps not shown (use --ts-top ${tsTotal} to see all)`)
  }
} else {
  step('TypeScript  (skipped — pass --no-ts to re-enable)')
}

// ── Phase 4: Reverse deps ─────────────────────────────────────────────────

header('PHASE 4 — REVERSE DEPENDENCIES')
note('Shows every tracked file that is imported by 2+ other tracked files.')
note('These are the "hub" files — changing them ripples widely.')

step('Files with 2+ importers, sorted by importer count')

const hubs = [...index.reverseDeps.entries()]
  .map(([p, rev]) => ({ path: p, count: rev.size, importers: [...rev].map(rel).sort() }))
  .filter(h => h.count >= 2)
  .sort((a, b) => b.count - a.count)

if (hubs.length === 0) {
  note('No files found with 2 or more tracked importers.')
} else {
  for (const { path, count, importers } of hubs) {
    console.log(`  ${green(rel(path))}  ${bold(red(`← ${count} importers`))}`)
    for (const imp of importers) console.log(`    ← ${imp}`)
  }
}

// ── Phase 5: Context injection demo ──────────────────────────────────────

header('PHASE 5 — CONTEXT INJECTOR DEMO')
note('Simulates what gets injected into the LLM context when a user mentions files.')

const injector = new ContextInjector(projectRoot, config.maxInjectionTokens, config.scanLastNMessages)

// Pick the 2 most-imported Rust files as the demo subjects
const rustHubs = [...index.reverseDeps.entries()]
  .filter(([p]) => p.endsWith('.rs'))
  .sort(([, a], [, b]) => b.size - a.size)
  .slice(0, 2)
  .map(([p]) => rel(p))

// Fall back to any 2 indexed files if no Rust
const demoFiles = rustHubs.length >= 2
  ? rustHubs
  : [...index.skeletons.keys()].slice(0, 2).map(rel)

if (demoFiles.length > 0) {
  const mentionText = demoFiles.map(f => `Please check ${f}`).join(' and ')
  const demoMessages = [
    { role: 'user' as const,      content: mentionText },
    { role: 'assistant' as const, content: `I'll look at ${demoFiles[0]}.` },
    { role: 'user' as const,      content: `Also explain how it relates to ${demoFiles[1] ?? demoFiles[0]}.` },
  ]

  step('Simulated conversation')
  for (const m of demoMessages) note(`  [${m.role}] ${m.content}`)

  const ctx = injector.buildInjection(index, demoMessages)
  if (ctx) {
    const injectedFiles = ctx.split('### ').slice(1).map(s => s.split('\n')[0])
    kv('Files injected', injectedFiles.join(', '))
    kv('Token estimate', `~${Math.ceil(ctx.length / 4)} / ${config.maxInjectionTokens}`)
    step('Injected dep-context block')
    console.log(ctx)
  } else {
    warn('No in-focus files detected. The file paths may not match the regex.')
    warn(`Regex expects patterns like: ./foo/bar.ts or src/baz.rs`)
  }
}

// ── Summary ───────────────────────────────────────────────────────────────

header('SUMMARY')
console.log()
kv('Project',          projectRoot)
kv('Files indexed',    index.skeletons.size)
kv('Dep edges',        [...index.deps.values()].reduce((s, v) => s + v.size, 0))
kv('Cold build',       `${buildMs}ms`)
kv('Warm build',       `${warmMs}ms`)
kv('Repo map',         `~${mapTokens} tokens / ${dirsInMap.length} dirs`)
kv('Hub files (≥2 importers)', hubs.length)
console.log()
