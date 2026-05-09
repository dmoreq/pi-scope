import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PathUtils } from '../../../shared/utils/path-utils.js'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  stat: vi.fn(),
}))

describe('PathUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('normalizePath', () => {
    it('should normalize paths consistently', () => {
      expect(PathUtils.normalizePath('src\\components\\Button.tsx')).toBe('src/components/Button.tsx')
      expect(PathUtils.normalizePath('src/./components/../Button.tsx')).toBe('src/Button.tsx')
    })
  })

  describe('ensureAbsolute', () => {
    it('should make relative paths absolute from workspace root', () => {
      const result = PathUtils.ensureAbsolute('src/components', '/workspace')
      expect(result).toBe('/workspace/src/components')
    })

    it('should leave absolute paths unchanged', () => {
      const result = PathUtils.ensureAbsolute('/absolute/path', '/workspace')
      expect(result).toBe('/absolute/path')
    })
  })

  describe('makeRelative', () => {
    it('should create relative paths from workspace root', () => {
      const result = PathUtils.makeRelative('/workspace/src/components/Button.tsx', '/workspace')
      expect(result).toBe('src/components/Button.tsx')
    })
  })

  describe('exists', () => {
    it('should check file existence asynchronously', async () => {
      const { access } = await import('node:fs/promises')
      vi.mocked(access).mockResolvedValue(undefined)

      const result = await PathUtils.exists('/some/path')
      expect(result).toBe(true)
      expect(access).toHaveBeenCalledWith('/some/path')
    })

    it('should return false when file does not exist', async () => {
      const { access } = await import('node:fs/promises')
      vi.mocked(access).mockRejectedValue(new Error('ENOENT'))

      const result = await PathUtils.exists('/nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('existsSync', () => {
    it('should check file existence synchronously', async () => {
      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)

      const result = PathUtils.existsSync('/some/path')
      expect(result).toBe(true)
      expect(existsSync).toHaveBeenCalledWith('/some/path')
    })
  })

  describe('getExtension', () => {
    it('should get file extension', () => {
      expect(PathUtils.getExtension('file.ts')).toBe('.ts')
      expect(PathUtils.getExtension('file.json')).toBe('.json')
      expect(PathUtils.getExtension('noextension')).toBe('')
    })
  })

  describe('hasExtension', () => {
    it('should check if file has specific extension', () => {
      expect(PathUtils.hasExtension('file.ts', '.ts')).toBe(true)
      expect(PathUtils.hasExtension('file.ts', '.js')).toBe(false)
      expect(PathUtils.hasExtension('file.ts', ['.ts', '.js'])).toBe(true)
    })
  })

  describe('isSourceFile', () => {
    it('should identify source files', () => {
      expect(PathUtils.isSourceFile('file.ts')).toBe(true)
      expect(PathUtils.isSourceFile('file.js')).toBe(true)
      expect(PathUtils.isSourceFile('file.json')).toBe(false)
      expect(PathUtils.isSourceFile('file.tsx')).toBe(true)
    })
  })

  describe('isTestFile', () => {
    it('should identify test files', () => {
      expect(PathUtils.isTestFile('file.test.ts')).toBe(true)
      expect(PathUtils.isTestFile('file.spec.ts')).toBe(true)
      expect(PathUtils.isTestFile('__tests__/file.ts')).toBe(true)
      expect(PathUtils.isTestFile('file.ts')).toBe(false)
    })
  })

  describe('getDirectories', () => {
    it('should extract unique directory paths', () => {
      const paths = [
        'src/components/Button.tsx',
        'src/components/Input.tsx',
        'src/utils/helpers.ts',
        'tests/unit/button.test.ts',
      ]

      const result = PathUtils.getDirectories(paths)
      expect(result).toEqual(['src/components', 'src/utils', 'tests/unit'])
    })
  })

  describe('joinSafe', () => {
    it('should join paths safely', () => {
      expect(PathUtils.joinSafe('src', 'components', 'Button.tsx')).toBe('src/components/Button.tsx')
      expect(PathUtils.joinSafe('/root', '../outside')).toBe('/outside')
    })
  })

  describe('isDirectory', () => {
    it('should check if path is directory', async () => {
      const { stat } = await import('node:fs/promises')
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any)

      const result = await PathUtils.isDirectory('/some/path')
      expect(result).toBe(true)
    })

    it('should return false for non-directories', async () => {
      const { stat } = await import('node:fs/promises')
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any)

      const result = await PathUtils.isDirectory('/some/file')
      expect(result).toBe(false)
    })
  })

  describe('instance API (DI)', () => {
    it('delegates to the same behavior as static methods', () => {
      const utils = new PathUtils()
      expect(utils.normalizePath('x\\y')).toBe(PathUtils.normalizePath('x\\y'))
      expect(utils.joinSafe('a', 'b')).toBe(PathUtils.joinSafe('a', 'b'))
      expect(utils.isSourceFile('m.ts')).toBe(PathUtils.isSourceFile('m.ts'))
    })
  })

  describe('edge cases', () => {
    it('should handle empty paths gracefully', () => {
      expect(PathUtils.normalizePath('')).toBe('')
      expect(PathUtils.getExtension('')).toBe('')
    })

    it('should handle paths with multiple dots', () => {
      expect(PathUtils.getExtension('file.test.ts')).toBe('.ts')
      expect(PathUtils.getExtension('file.min.js')).toBe('.js')
    })

    it('should handle Windows-style paths', () => {
      expect(PathUtils.normalizePath('C:\\Users\\Name\\file.ts')).toBe('C:/Users/Name/file.ts')
    })

    it('should detect test files in various patterns', () => {
      expect(PathUtils.isTestFile('src/__tests__/Button.test.ts')).toBe(true)
      expect(PathUtils.isTestFile('Button.spec.tsx')).toBe(true)
      expect(PathUtils.isTestFile('tests/unit/helpers.ts')).toBe(false)
    })

    it('should handle absolute vs relative path detection', () => {
      expect(PathUtils.ensureAbsolute('/already/absolute', '/workspace')).toBe('/already/absolute')
      expect(PathUtils.ensureAbsolute('relative/path', '/workspace')).toBe('/workspace/relative/path')
    })
  })
})
