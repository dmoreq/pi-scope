import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { FileIndex, CacheFile } from './types.js'
import { CACHE_VERSION } from './types.js'

export class DiskCache {
  private readonly cachePath: string
  private entries: Map<string, FileIndex> = new Map()

  constructor(projectRoot: string) {
    this.cachePath = join(projectRoot, '.pi-cache', 'smart-context.json')
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.cachePath, 'utf-8')
      const data: CacheFile = JSON.parse(raw)
      if (data.version !== CACHE_VERSION) {
        this.entries = new Map()
        return
      }
      this.entries = new Map(Object.entries(data.entries))
    } catch {
      this.entries = new Map()
    }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.cachePath), { recursive: true })
    const data: CacheFile = {
      version: CACHE_VERSION,
      entries: Object.fromEntries(this.entries),
    }
    const tmp = this.cachePath + '.tmp'
    await writeFile(tmp, JSON.stringify(data), 'utf-8')
    await rename(tmp, this.cachePath)
  }

  get(path: string): FileIndex | undefined {
    return this.entries.get(path)
  }

  set(index: FileIndex): void {
    this.entries.set(index.path, index)
  }

  delete(path: string): void {
    this.entries.delete(path)
  }
}
