import { describe, it, expect } from 'vitest';
import {
  deduplicate,
  supersedeWrites,
  purgeErrors,
  applyPruningRules,
  type ContextMessage,
} from '../../plugins/pruning-rules.js';

// ── Test Fixtures ─────────────────────────────────────────────────────────

const user = (content: string): ContextMessage => ({ role: 'user', content });
const assistant = (content: string): ContextMessage => ({ role: 'assistant', content });
const tool = (content: string): ContextMessage => ({ role: 'tool', content });
const toolResult = (content: string): ContextMessage => ({ role: 'toolResult', content });

// ── Deduplication ─────────────────────────────────────────────────────────

describe('deduplicate', () => {
  it('removes identical consecutive user messages', () => {
    const messages = [
      user('hello'),
      assistant('hi there'),
      user('hello'),
      assistant('hi there'),
    ];
    const result = deduplicate(messages);
    expect(result).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]);
  });

  it('preserves unique user/assistant messages', () => {
    const result = deduplicate([
      user('first'), assistant('r1'), user('second'), assistant('r2'),
    ]);
    expect(result).toHaveLength(4);
  });

  it('preserves tool messages even if identical', () => {
    const result = deduplicate([
      user('hello'),
      toolResult('{"result": "ok"}'),
      toolResult('{"result": "ok"}'),
    ]);
    expect(result).toHaveLength(3);
  });

  it('deduplicates across non-consecutive messages', () => {
    const result = deduplicate([
      user('hello'), assistant('r1'), user('hello'), assistant('r2'),
    ]);
    expect(result).toHaveLength(3);
  });

  it('handles empty array', () => expect(deduplicate([])).toEqual([]));
  it('handles single message', () =>
    expect(deduplicate([user('test')])).toHaveLength(1));

  it('does not dedup non-user/assistant roles', () => {
    // Messages with undefined role are NOT deduped (only user/assistant)
    const result = deduplicate([
      { content: 'a' }, { content: 'a' },
    ] as ContextMessage[]);
    expect(result).toHaveLength(2);
  });
});

// ── Superseded Writes ─────────────────────────────────────────────────────

describe('supersedeWrites', () => {
  it('removes old write when newer for same file exists', () => {
    const messages = [
      toolResult('{"path": "src/index.ts", "content": "old"}'),
      user('update'),
      toolResult('{"path": "src/index.ts", "content": "new"}'),
    ];
    const result = supersedeWrites(messages);
    expect(result).toHaveLength(2);
    expect(result[1].content).toBe('{"path": "src/index.ts", "content": "new"}');
  });

  it('preserves writes for different files', () => {
    const result = supersedeWrites([
      toolResult('{"path": "a.ts"}'),
      toolResult('{"path": "b.ts"}'),
    ]);
    expect(result).toHaveLength(2);
  });

  it('handles filePath field', () => {
    const result = supersedeWrites([
      toolResult('{"filePath": "x.ts"}'),
      user('update'),
      toolResult('{"filePath": "x.ts"}'),
    ]);
    expect(result).toHaveLength(2);
  });

  it('preserves non-tool messages', () => {
    expect(supersedeWrites([user('hi'), assistant('hello')])).toHaveLength(2);
  });
  it('handles empty array', () => expect(supersedeWrites([])).toEqual([]));
});

// ── Error Purging ─────────────────────────────────────────────────────────

describe('purgeErrors', () => {
  it('removes error followed by success (skipping over user/assistant messages)', () => {
    const messages = [
      toolResult('{"isError": true}'),
      user('fix it'),
      toolResult('{"isError": false, "message": "ok"}'),
    ];
    const result = purgeErrors(messages);
    expect(result).toHaveLength(2);
    // error removed, user and success kept
    expect(result.map(m => m.content)).toEqual(['fix it', '{"isError": false, "message": "ok"}']);
  });

  it('preserves error not followed by success', () => {
    const result = purgeErrors([
      toolResult('{"isError": true}'),
      user('still broken'),
    ]);
    expect(result).toHaveLength(2);
  });

  it('removes error using status field', () => {
    const result = purgeErrors([
      toolResult('{"status": "error"}'),
      toolResult('{"status": "ok"}'),
    ]);
    expect(result).toHaveLength(1);
  });

  it('removes consecutive errors when first is followed by success (skipping second error)', () => {
    // The purgeErrors function only removes an error if the NEXT tool result is a success.
    // Since both errors are consecutive tool results, messages[0]'s next tool result is
    // messages[1] (also an error), so messages[0] is kept.
    const messages = [
      toolResult('{"isError": true, "m": "fail1"}'),
      toolResult('{"isError": true, "m": "fail2"}'),
      toolResult('{"isError": false, "m": "ok"}'),
    ];
    const result = purgeErrors(messages);
    // messages[1]'s next tool result is messages[2] (success) → removed
    // messages[0]'s next tool result is messages[1] (error) → kept
    expect(result).toHaveLength(2);
    expect(result.map(m => m.content)).toEqual([
      '{"isError": true, "m": "fail1"}',
      '{"isError": false, "m": "ok"}',
    ]);
  });

  it('preserves non-tool messages', () => {
    expect(purgeErrors([user('hi'), assistant('hello')])).toHaveLength(2);
  });
  it('handles empty array', () => expect(purgeErrors([])).toEqual([]));
});

// ── Composite applyPruningRules ───────────────────────────────────────────

describe('applyPruningRules', () => {
  it('applies all enabled rules', () => {
    const messages = [
      user('hello'), user('hello'),
      toolResult('{"isError": true}'),
      toolResult('{"status": "ok"}'),
    ];
    const { pruned, removed } = applyPruningRules(messages);
    expect(removed).toBeGreaterThan(0);
    expect(pruned.length).toBeLessThan(messages.length);
  });

  it('returns accurate removed count', () => {
    const { pruned, removed } = applyPruningRules([
      user('a'), user('a'), user('b'), user('b'),
    ]);
    expect(removed).toBe(2);
    expect(pruned).toHaveLength(2);
  });

  it('returns no removal when no rules match', () => {
    const msgs = [user('a'), assistant('b'), user('c')];
    const { pruned, removed } = applyPruningRules(msgs);
    expect(removed).toBe(0);
    expect(pruned).toEqual(msgs);
  });

  it('can disable specific rules via config', () => {
    const { removed } = applyPruningRules([
      user('hello'), user('hello'),
      toolResult('{"isError": true}'),
      toolResult('{"status": "ok"}'),
    ], { rules: ['superseded-writes'], recencyWindow: 10 });
    expect(removed).toBe(0);
  });

  it('handles empty messages', () => {
    const { pruned, removed } = applyPruningRules([]);
    expect(removed).toBe(0);
    expect(pruned).toEqual([]);
  });
});
