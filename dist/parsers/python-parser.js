import { createHash } from 'node:crypto';
import Parser from 'tree-sitter';
// @ts-ignore — tree-sitter-python has no bundled .d.ts
import Python from 'tree-sitter-python';
const parser = new Parser();
// @ts-ignore
parser.setLanguage(Python);
function extractFunctionSig(node, source) {
    const body = node.childForFieldName('body');
    if (body) {
        return source.slice(node.startIndex, body.startIndex).trimEnd() + ' ...';
    }
    return source.slice(node.startIndex, node.endIndex);
}
function walk(node, source, lines, imports, indent = '') {
    if (node.type === 'import_from_statement') {
        // Relative imports are represented as `relative_import` child nodes
        for (const child of node.children) {
            if (child.type === 'relative_import') {
                imports.push(child.text);
            }
        }
        return;
    }
    if (node.type === 'function_definition') {
        lines.push(indent + extractFunctionSig(node, source));
        return;
    }
    if (node.type === 'class_definition') {
        const name = node.childForFieldName('name');
        lines.push(indent + `class ${name?.text ?? '?'}:`);
        const body = node.childForFieldName('body');
        if (body) {
            for (const child of body.children) {
                walk(child, source, lines, imports, indent + '    ');
            }
        }
        return;
    }
    for (const child of node.children) {
        walk(child, source, lines, imports, indent);
    }
}
export class PythonParser {
    extensions = ['.py'];
    parseFile(path, content) {
        // @ts-ignore
        const tree = parser.parse(content);
        const lines = [];
        const imports = [];
        walk(tree.rootNode, content, lines, imports);
        return {
            path,
            skeleton: lines.join('\n'),
            imports,
            contentHash: createHash('sha256').update(content).digest('hex'),
        };
    }
}
