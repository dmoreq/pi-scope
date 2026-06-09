import { createHash } from 'node:crypto'
import type { RepoIndex } from './types.js'

export function computeRepoIndexFingerprint(index: RepoIndex): string {
  const hash = createHash('sha256')
  hash.update('repo-index-v2\0')

  hash.update('files\0')
  for (const [path, skeleton] of [...index.skeletons.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    updateHashPart(hash, path)
    updateHashPart(hash, skeleton)
  }

  hash.update('deps\0')
  for (const [path, deps] of [...index.deps.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    updateHashPart(hash, path)
    for (const dep of [...deps].sort()) updateHashPart(hash, dep)
  }

  hash.update('symbols\0')
  for (const [path, symbols] of [...index.symbolIndex.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    updateHashPart(hash, path)
    for (const symbol of [...symbols].sort()) updateHashPart(hash, symbol)
  }

  return `repo-index-v2:${hash.digest('hex')}`
}

function updateHashPart(hash: ReturnType<typeof createHash>, value: string): void {
  hash.update(`${Buffer.byteLength(value, 'utf8')}:`)
  hash.update(value)
  hash.update('\0')
}
