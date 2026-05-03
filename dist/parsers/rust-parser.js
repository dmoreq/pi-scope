import { createHash } from 'node:crypto';
import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
const parser = new Parser();
// @ts-ignore — grammar's Language type has `unknown` internals incompatible with tree-sitter's declared type
parser.setLanguage(Rust);
const BLOCK_TYPES = new Set(['block', 'declaration_list', 'field_declaration_list', 'enum_variant_list']);
const SIGNATURE_TYPES = new Set([
    'function_item',
    'struct_item',
    'enum_item',
    'trait_item',
    'impl_item',
    'type_item',
]);
function nodeSig(node, source) {
    if (!SIGNATURE_TYPES.has(node.type))
        return null;
    const body = node.children.find(c => BLOCK_TYPES.has(c.type));
    if (body) {
        return source.slice(node.startIndex, body.startIndex).trimEnd() + ' { ... }';
    }
    return source.slice(node.startIndex, node.endIndex);
}
function walk(node, source, sigs, imports) {
    if (node.type === 'mod_item') {
        const name = node.childForFieldName('name');
        if (name)
            imports.push('mod:' + name.text);
        return;
    }
    if (node.type === 'use_declaration') {
        const arg = node.childForFieldName('argument');
        if (arg) {
            const text = arg.text;
            // Only keep crate:: and super:: — discard std::, external crates
            if (text.startsWith('crate::') || text.startsWith('super::')) {
                imports.push(text);
            }
        }
        return;
    }
    const sig = nodeSig(node, source);
    if (sig) {
        sigs.push(sig);
        return;
    }
    for (const child of node.children)
        walk(child, source, sigs, imports);
}
export class RustParser {
    extensions = ['.rs'];
    parseFile(path, content) {
        const tree = parser.parse(content);
        const sigs = [];
        const imports = [];
        walk(tree.rootNode, content, sigs, imports);
        return {
            path,
            skeleton: sigs.join('\n'),
            imports,
            contentHash: createHash('sha256').update(content).digest('hex'),
        };
    }
}
