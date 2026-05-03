import { relative, dirname } from 'node:path';
function extractNames(skeleton) {
    return skeleton
        .split('\n')
        .map(line => {
        const m = line.match(/(?:export\s+)?(?:class|function|interface|type|enum|struct|trait|impl|pub fn|def|pub struct|pub enum)\s+(\w+)/) ??
            line.match(/^(?:class|def)\s+(\w+)/);
        return m ? m[1] : null;
    })
        .filter(Boolean)
        .join(', ');
}
export class RepoMapGenerator {
    projectRoot;
    maxTokens;
    constructor(projectRoot, maxTokens) {
        this.projectRoot = projectRoot;
        this.maxTokens = maxTokens;
    }
    generate(index) {
        const byDir = new Map();
        for (const [absPath, skeleton] of index.skeletons) {
            const rel = relative(this.projectRoot, absPath);
            const dir = dirname(rel) === '.' ? '' : dirname(rel) + '/';
            const fileName = rel.slice(dir.length);
            const names = extractNames(skeleton);
            if (!byDir.has(dir))
                byDir.set(dir, []);
            byDir.get(dir).push({ name: fileName, names });
        }
        const lines = [];
        const maxChars = this.maxTokens * 4;
        const sortedDirs = [...byDir.keys()].sort();
        for (const dir of sortedDirs) {
            const headerLine = dir ? dir : '(root)';
            const fileLines = byDir.get(dir);
            lines.push('  ' + headerLine);
            for (const { name, names } of fileLines) {
                const entry = `    ${name}${names ? '  ' + names : ''}`;
                lines.push(entry);
            }
            const currentSize = lines.join('\n').length;
            if (currentSize > maxChars) {
                while (lines.join('\n').length > maxChars && lines.length > 0) {
                    lines.pop();
                }
                // Remove orphan directory headers left after trimming file entries
                while (lines.length > 0 && !lines[lines.length - 1].startsWith('    ')) {
                    lines.pop();
                }
                break;
            }
        }
        const body = lines.length > 0 ? `\n${lines.join('\n')}\n` : '\n';
        return `<repo-map>${body}</repo-map>`;
    }
}
