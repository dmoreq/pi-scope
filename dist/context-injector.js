import { relative } from 'node:path';
const FILE_PATH_RE = /(?:^|[\s'"`(])([./\w-]+\/[\w./-]+\.(?:tsx|ts|py|rs))/g;
function textContent(msg) {
    if (typeof msg.content === 'string')
        return msg.content;
    return msg.content
        .filter(c => c.type === 'text')
        .map(c => c.text ?? '')
        .join(' ');
}
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
export class ContextInjector {
    projectRoot;
    maxTokens;
    scanLastN;
    constructor(projectRoot, maxTokens, scanLastN) {
        this.projectRoot = projectRoot;
        this.maxTokens = maxTokens;
        this.scanLastN = scanLastN;
    }
    buildInjection(index, messages, extraPaths) {
        const inFocus = this.detectInFocusFiles(index, messages, extraPaths);
        if (inFocus.size === 0)
            return '';
        const sections = [];
        let tokenBudget = this.maxTokens;
        const activeLines = ['## Active files'];
        for (const absPath of inFocus) {
            const skeleton = index.skeletons.get(absPath);
            if (!skeleton)
                continue;
            const rel = relative(this.projectRoot, absPath);
            const entry = `### ${rel}\n${skeleton}`;
            const cost = estimateTokens(entry);
            if (cost > tokenBudget)
                continue;
            activeLines.push(entry);
            tokenBudget -= cost;
        }
        if (activeLines.length > 1)
            sections.push(activeLines.join('\n'));
        const depPaths = new Set();
        for (const absPath of inFocus) {
            for (const dep of index.deps.get(absPath) ?? []) {
                if (!inFocus.has(dep))
                    depPaths.add(dep);
            }
        }
        if (depPaths.size > 0) {
            const depLines = ['## Direct dependencies'];
            for (const dep of depPaths) {
                const skeleton = index.skeletons.get(dep);
                if (!skeleton)
                    continue;
                const rel = relative(this.projectRoot, dep);
                const entry = `### ${rel}\n${skeleton}`;
                const cost = estimateTokens(entry);
                if (cost > tokenBudget)
                    continue;
                depLines.push(entry);
                tokenBudget -= cost;
            }
            if (depLines.length > 1)
                sections.push(depLines.join('\n'));
        }
        const body = sections.join('\n\n');
        return `<dep-context>\n${body}\n</dep-context>`;
    }
    detectInFocusFiles(index, messages, extraPaths) {
        const recent = messages.slice(-this.scanLastN);
        const mentioned = new Set();
        // ── Scan message text ──────────────────────────────────────────────
        for (const msg of recent) {
            const text = textContent(msg);
            for (const match of text.matchAll(FILE_PATH_RE)) {
                mentioned.add(match[1]);
            }
        }
        // ── Merge extra paths from tool calls/output ───────────────────────
        if (extraPaths) {
            for (const p of extraPaths) {
                mentioned.add(p);
            }
        }
        // ── Match against indexed files ────────────────────────────────────
        const inFocus = new Set();
        for (const absPath of index.skeletons.keys()) {
            const rel = relative(this.projectRoot, absPath);
            for (const mention of mentioned) {
                if (rel.endsWith(mention) || rel === mention || absPath.endsWith(mention)) {
                    inFocus.add(absPath);
                }
            }
        }
        return inFocus;
    }
}
