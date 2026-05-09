/**
 * Query intent classification for pi-scope trigger logic.
 *
 * Detects broad codebase-introspection queries that don't mention specific
 * file paths or symbol names but still benefit from context injection.
 */

/**
 * Patterns that indicate a user is asking a broad codebase-introspection question.
 * These queries should trigger a centrality-based overview injection even though
 * they contain no specific file paths or symbol names.
 */
const BROAD_CODEBASE_PATTERNS = [
  // "what does this codebase/project/repo do"
  /\bwhat\s+(?:does|is)\s+this\s+(?:codebase|project|repo(?:sitory)?)|\bexplain\s+this\s+(?:codebase|project|repo)/i,

  // "tell me about this project/codebase"
  /\b(?:tell|show)\s+(?:me\s+)?(?:about|what)\s+this\s+(?:codebase|project|repo|code)/i,

  // architecture / structure / design questions
  /\bhow\s+(?:is|are)\s+.+\s+(?:structured?|organized?|laid\s*out|architected)/i,
  /\b(?:show|explain|tell)\s+(?:me\s+)?(?:the\s+)?(?:architecture|design|layout)/i,
  /\b(?:architecture|design|layout)\s+(?:of\s+)?(?:this\s+)?(?:project|codebase|repo)/i,
  /\b(?:project|codebase)\s+(?:structure|layout)/i,

  // purpose / overview / summary
  /\b(?:what(?:'s|\s+is)?\s+(?:the\s+)?(?:purpose|goal|intent|objective)\s+of)/i,
  /\b(?:give|provide)\s+(?:me\s+)?(?:an?\s+)?(?:overview|summary|breakdown)/i,
  /\bwhat\s+(?:does|do)\s+this\s+(?:repo(?:sitory)?|codebase|project)\s+contain/i,
  /\bdescribe\s+(?:this\s+)?(?:codebase|project|repo|code)/i,
  /\bsummarize\s+(?:this\s+)?(?:codebase|project|repo)/i,

  // "main files" / "key files" / "important files"
  /\b(?:what|which|show|list|give)\s+(?:are\s+)?(?:me\s+)?(?:the\s+)?(?:main|key|important|core|entry[-\s]?point)\s+(?:files?|modules?|components?)/i,
  /\b(?:what|which)\s+files?\s+(?:should|are|would)\s+(?:I|we|you)\s+(?:read|look\s+at|review|check|examine|see|know)/i,
  /\b(?:what|which)\s+files?\s+(?:are|is)\s+(?:the\s+)?(?:most\s+)?(?:important|key|relevant|critical)/i,

  // project understanding
  /\bwhat\s+(?:is|are)\s+(?:this\s+)?(?:project|repo(?:sitory)?|codebase)\s+(?:about|for)/i,
  /\bwhat\s+(?:does|do)\s+this\s+(?:project|repo(?:sitory)?|code)\s+cover/i,
]

/**
 * Returns true if the query is a broad codebase-introspection question
 * (no specific symbol/file, but clearly codebase-related).
 */
export function isBroadCodebaseQuery(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false

  // Check for specific symbols/files — if found, it's NOT a "broad" query
  // (it should be handled by the existing symbol-match or file-pattern triggers)
  if (/\.(?:ts|tsx|py|rs|js|jsx|go)\b/i.test(trimmed)) return false
  if (/\b(?:refactor|rewrite|edit|update|fix|debug|implement|add|remove|migrate)\s+\w+/i.test(trimmed)) return false

  for (const pattern of BROAD_CODEBASE_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }

  return false
}
