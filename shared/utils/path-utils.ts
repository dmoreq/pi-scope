import { existsSync } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import * as path from 'node:path'
import type { PathUtilsInterface } from '../interfaces/path-utils.interface.js'

export class PathUtils implements PathUtilsInterface {
  private static readonly SOURCE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
  ])

  private static readonly TEST_PATTERNS = [/\.test\./, /\.spec\./, /__tests__/]

  static normalizePath(p: string): string {
    if (p === '') return ''
    return path.posix.normalize(p.replace(/\\/g, '/'))
  }

  static ensureAbsolute(targetPath: string, workspaceRoot: string): string {
    if (path.isAbsolute(targetPath)) {
      return targetPath
    }
    return path.resolve(workspaceRoot, targetPath)
  }

  static makeRelative(absolutePath: string, workspaceRoot: string): string {
    return this.normalizePath(path.relative(workspaceRoot, absolutePath))
  }

  static async exists(targetPath: string): Promise<boolean> {
    try {
      await access(targetPath)
      return true
    } catch {
      return false
    }
  }

  static existsSync(targetPath: string): boolean {
    return existsSync(targetPath)
  }

  static async isDirectory(targetPath: string): Promise<boolean> {
    try {
      const stats = await stat(targetPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  static getExtension(targetPath: string): string {
    return path.extname(targetPath)
  }

  static hasExtension(targetPath: string, extensions: string | string[]): boolean {
    const ext = this.getExtension(targetPath)
    const exts = Array.isArray(extensions) ? extensions : [extensions]
    return exts.includes(ext)
  }

  static isSourceFile(targetPath: string): boolean {
    const ext = PathUtils.getExtension(targetPath)
    return PathUtils.SOURCE_EXTENSIONS.has(ext)
  }

  static isTestFile(targetPath: string): boolean {
    return PathUtils.TEST_PATTERNS.some(pattern => pattern.test(targetPath))
  }

  static getDirectories(paths: string[]): string[] {
    const directories = new Set<string>()

    for (const filePath of paths) {
      const dir = path.dirname(filePath)
      if (dir !== '.') {
        directories.add(this.normalizePath(dir))
      }
    }

    return Array.from(directories).sort()
  }

  static joinSafe(...segments: string[]): string {
    return this.normalizePath(path.join(...segments))
  }

  normalizePath = PathUtils.normalizePath
  ensureAbsolute = PathUtils.ensureAbsolute
  makeRelative = PathUtils.makeRelative
  exists = PathUtils.exists
  existsSync = PathUtils.existsSync
  isDirectory = PathUtils.isDirectory
  getExtension = PathUtils.getExtension
  hasExtension = PathUtils.hasExtension
  isSourceFile = PathUtils.isSourceFile
  isTestFile = PathUtils.isTestFile
  getDirectories = PathUtils.getDirectories
  joinSafe = PathUtils.joinSafe
}
