#!/usr/bin/env node
/**
 * Validate dist/ files — ensure compiled JS syntax is valid.
 * Runs node --check on critical dist files.
 */
import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const distDir = './dist'

function findJsFiles(dir, files = []) {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.')) continue
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        findJsFiles(full, files)
      } else if (entry.endsWith('.js') && !entry.endsWith('.d.ts')) {
        files.push(full)
      }
    }
  } catch (_err) {
    // Ignore unreadable dirs
  }
  return files
}

const jsFiles = findJsFiles(distDir)

if (jsFiles.length === 0) {
  console.error('✗ No .js files found in dist/')
  process.exit(1)
}

console.log(`Validating ${jsFiles.length} dist files...`)

const errors = []
for (const file of jsFiles) {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' })
    console.log(`  ✓ ${file}`)
  } catch (error) {
    errors.push({ file, error: error.message })
    console.error(`  ✗ ${file}`)
  }
}

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} file(s) have syntax errors:`)
  for (const { file, error } of errors) {
    console.error(`\n${file}:`)
    console.error(error)
  }
  process.exit(1)
}

console.log(`\n✓ All ${jsFiles.length} dist files are valid`)
