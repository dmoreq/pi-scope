import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, relative, resolve } from 'node:path'
import { PathUtils } from './utils/path-utils.js'

const _require = createRequire(import.meta.url)
type IgnoreInstance = { add(p: string | string[]): IgnoreInstance; ignores(p: string): boolean }
const ignore: () => IgnoreInstance = _require('ignore')

export const DEFAULT_IGNORES = [
  '.git',
  '.pi',
  '.pi-cache',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  'tmp',
  'temp',
  'target',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
]

export const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.py',
  '.rs',
  '.js',
  '.jsx',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
]

export const PARSER_EXTENSIONS = ['.ts', '.tsx', '.py', '.rs']

export interface PathPolicy {
  projectRoot: string
  isInsideProject(pathOrRel: string): boolean
  toRelative(pathOrRel: string): string
  shouldIgnore(pathOrRel: string): boolean
  resolveProjectFile(pathArg: string): { ok: true; absPath: string; relPath: string } | { ok: false; reason: string }
}

export function normalizeIgnorePattern(pattern: string): string {
  return pattern.endsWith('/') || pattern.includes('*') ? pattern : `${pattern}/**`
}

export function createPathPolicy(projectRoot: string, extraExcludes: string[] = []): PathPolicy {
  const root = PathUtils.normalizePath(resolve(projectRoot))
  const ig = ignore()
  ig.add(DEFAULT_IGNORES.flatMap(pattern => [pattern, normalizeIgnorePattern(pattern)]))
  if (extraExcludes.length) ig.add(extraExcludes.flatMap(pattern => [pattern, normalizeIgnorePattern(pattern)]))

  try {
    ig.add(readFileSync(PathUtils.joinSafe(root, '.gitignore'), 'utf-8'))
  } catch {
    /* no .gitignore */
  }

  const toRelative = (pathOrRel: string): string => {
    const abs = isAbsolute(pathOrRel) ? pathOrRel : resolve(root, pathOrRel)
    return PathUtils.normalizePath(relative(root, abs))
  }

  const isInsideProject = (pathOrRel: string): boolean => {
    const rel = toRelative(pathOrRel)
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  }

  const shouldIgnore = (pathOrRel: string): boolean => {
    const rel = toRelative(pathOrRel)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return true
    return ig.ignores(rel)
  }

  return {
    projectRoot: root,
    isInsideProject,
    toRelative,
    shouldIgnore,
    resolveProjectFile(pathArg: string) {
      const trimmed = pathArg.trim()
      if (!trimmed) return { ok: false, reason: 'Path is required.' }
      const absPath = PathUtils.normalizePath(isAbsolute(trimmed) ? trimmed : resolve(root, trimmed))
      const relPath = toRelative(absPath)
      if (!isInsideProject(absPath)) {
        return { ok: false, reason: `Path escapes project root: ${trimmed}` }
      }
      if (shouldIgnore(relPath)) {
        return { ok: false, reason: `Path is ignored by project policy: ${relPath}` }
      }
      return { ok: true, absPath, relPath }
    },
  }
}

export function isSupportedSourcePath(path: string): boolean {
  return SOURCE_EXTENSIONS.some(ext => PathUtils.hasExtension(path, ext))
}

export function hasParserSupport(path: string): boolean {
  return PARSER_EXTENSIONS.some(ext => PathUtils.hasExtension(path, ext))
}
