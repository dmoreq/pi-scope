/**
 * Contract for path helpers used across pi-scope (normalization, FS checks, classification).
 */
export interface PathUtilsInterface {
  normalizePath(path: string): string
  ensureAbsolute(path: string, workspaceRoot: string): string
  makeRelative(absolutePath: string, workspaceRoot: string): string

  exists(path: string): Promise<boolean>
  existsSync(path: string): boolean
  isDirectory(path: string): Promise<boolean>

  getExtension(path: string): string
  hasExtension(path: string, extensions: string | string[]): boolean
  isSourceFile(path: string): boolean
  isTestFile(path: string): boolean

  getDirectories(paths: string[]): string[]
  joinSafe(...segments: string[]): string
}
