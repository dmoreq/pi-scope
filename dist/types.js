export const DEFAULT_CONFIG = {
    enabled: true,
    maxRepoMapTokens: 4000,
    maxInjectionTokens: 8000,
    scanLastNMessages: 10,
    exclude: ['**/node_modules/**', '**/.git/**', '**/.pi-cache/**', '**/dist/**'],
    contextFiles: {
        enabled: true,
        filenames: ['AGENTS.local.md', 'CLAUDE.local.md'],
        sectionTitle: 'Extra Context Files',
    },
    providerGuidance: {
        enabled: true,
    },
};
export const CACHE_VERSION = 1;
