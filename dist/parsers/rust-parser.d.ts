import type { LanguageParser } from './language-parser.js';
import type { FileIndex } from '../types.js';
export declare class RustParser implements LanguageParser {
    readonly extensions: string[];
    parseFile(path: string, content: string): FileIndex;
}
