import type { LanguageParser } from './language-parser.js';
import type { FileIndex } from '../types.js';
export declare class TypeScriptParser implements LanguageParser {
    readonly extensions: string[];
    private readonly tsParser;
    private readonly tsxParser;
    constructor();
    parseFile(path: string, content: string): FileIndex;
}
