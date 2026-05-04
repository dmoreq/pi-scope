import { describe, it, expect, beforeEach } from 'vitest';
import { ReadAwarenessPlugin } from '../../plugins/read-awareness.js';
import type { ExtensionContext } from '../../extension.js';

const mockCtx = {} as ExtensionContext;

describe('ReadAwarenessPlugin', () => {
  let plugin: ReadAwarenessPlugin;

  beforeEach(() => {
    plugin = new ReadAwarenessPlugin();
  });

  describe('basics', () => {
    it('has correct plugin name', () => {
      expect(plugin.name).toBe('read-awareness');
    });

    it('is enabled by default', () => {
      expect(plugin.enabled).toBe(true);
    });

    it('returns empty read files initially', () => {
      expect(plugin.getReadFiles()).toEqual([]);
    });
  });

  describe('onSessionStart', () => {
    it('clears read files', async () => {
      plugin['readFiles'].add('src/test.ts');
      expect(plugin.getReadFiles()).toHaveLength(1);

      await plugin.onSessionStart(mockCtx);

      expect(plugin.getReadFiles()).toEqual([]);
    });
  });

  describe('onToolCall - read', () => {
    it('tracks read tool calls', async () => {
      const result = await plugin.onToolCall(
        { toolName: 'read', input: { path: 'src/index.ts' } },
        mockCtx,
      );

      expect(result).toEqual({ allowed: true });
      expect(plugin.getReadFiles()).toEqual(['src/index.ts']);
    });

    it('tracks multiple reads', async () => {
      await plugin.onToolCall(
        { toolName: 'read', input: { path: 'src/a.ts' } },
        mockCtx,
      );
      await plugin.onToolCall(
        { toolName: 'read', input: { path: 'src/b.ts' } },
        mockCtx,
      );

      expect(plugin.getReadFiles()).toEqual(['src/a.ts', 'src/b.ts']);
    });

    it('deduplicates read files', async () => {
      await plugin.onToolCall(
        { toolName: 'read', input: { path: 'src/index.ts' } },
        mockCtx,
      );
      await plugin.onToolCall(
        { toolName: 'read', input: { path: 'src/index.ts' } },
        mockCtx,
      );

      expect(plugin.getReadFiles()).toEqual(['src/index.ts']);
    });

    it('handles filePath field', async () => {
      await plugin.onToolCall(
        { toolName: 'read', input: { filePath: 'config.json' } },
        mockCtx,
      );

      expect(plugin.getReadFiles()).toEqual(['config.json']);
    });

    it('handles read with no path', async () => {
      const result = await plugin.onToolCall(
        { toolName: 'read', input: {} },
        mockCtx,
      );

      expect(result).toEqual({ allowed: true });
      expect(plugin.getReadFiles()).toEqual([]);
    });
  });

  describe('onToolCall - write (blocked)', () => {
    it('blocks write to unread file', async () => {
      const result = await plugin.onToolCall(
        { toolName: 'write', input: { path: 'src/newfile.ts', content: 'data' } },
        mockCtx,
      );

      expect(result).toEqual({
        allowed: false,
        reason: expect.stringContaining('"src/newfile.ts" has not been read'),
      });
    });

    it('allows write to read file', async () => {
      // First read the file
      await plugin.onToolCall(
        { toolName: 'read', input: { path: 'src/index.ts' } },
        mockCtx,
      );

      // Then write is allowed
      const result = await plugin.onToolCall(
        { toolName: 'write', input: { path: 'src/index.ts', content: 'updated' } },
        mockCtx,
      );

      expect(result).toEqual({ allowed: true });
    });
  });

  describe('onToolCall - edit (blocked)', () => {
    it('blocks edit to unread file', async () => {
      const result = await plugin.onToolCall(
        { toolName: 'edit', input: { path: 'src/unknown.ts' } },
        mockCtx,
      );

      expect(result).toEqual({
        allowed: false,
        reason: expect.stringContaining('has not been read'),
      });
    });

    it('allows edit to read file', async () => {
      await plugin.onToolCall(
        { toolName: 'read', input: { path: 'src/config.ts' } },
        mockCtx,
      );

      const result = await plugin.onToolCall(
        { toolName: 'edit', input: { path: 'src/config.ts', oldText: 'a', newText: 'b' } },
        mockCtx,
      );

      expect(result).toEqual({ allowed: true });
    });
  });

  describe('tool call allowlist', () => {
    it('always allows non-read/write/edit tool calls', async () => {
      const tools = ['bash', 'search', 'grep', 'find', 'ls', 'list', 'grep'];
      for (const tool of tools) {
        const result = await plugin.onToolCall(
          { toolName: tool, input: {} },
          mockCtx,
        );
        expect(result).toEqual({ allowed: true });
      }
    });
  });

  describe('disable/enable', () => {
    it('allows writes when disabled', async () => {
      plugin.enabled = false;

      const result = await plugin.onToolCall(
        { toolName: 'write', input: { path: 'src/never-read.ts' } },
        mockCtx,
      );

      expect(result).toEqual({ allowed: true });
    });

    it('stops tracking reads when disabled', async () => {
      plugin.enabled = false;

      await plugin.onToolCall(
        { toolName: 'read', input: { path: 'src/test.ts' } },
        mockCtx,
      );

      // File was not tracked
      expect(plugin.getReadFiles()).toEqual([]);
    });
  });
});
