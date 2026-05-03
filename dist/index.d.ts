/**
 * @pi/smart-context — pi agent extension
 *
 * Lifecycle
 * ─────────
 * session_start      Check .pi/smart-context/ for an existing index.
 *                    • Found  → load from disk (fast, no re-parsing).
 *                    • Missing → build with IndexEngine, save to disk.
 *
 * before_agent_start Inject <repo-map> into the system prompt once per
 *                    session so the LLM has a bird's-eye view of the repo.
 *
 * context            Inspect the conversation messages about to be sent,
 *                    detect mentioned file paths, inject their skeletons
 *                    and 1st-degree dependency skeletons as <dep-context>.
 *                    Records every injection in SessionStats.
 *
 * session_shutdown   Print a one-line summary via ctx.ui.notify and
 *                    append a record to .pi/smart-context/stats.jsonl.
 *
 * /smart-context     Slash command — show full stats report for the
 *                    current session at any point.
 *
 * Install
 * ───────
 *   # ~/.omp/agent/config.yml
 *   extensions:
 *     - /path/to/@pi/smart-context/dist/index.js
 */
interface ExtensionUI {
    notify(message: string, level?: 'info' | 'warn' | 'error'): void;
}
interface ExtensionContext {
    cwd: string;
    ui: ExtensionUI & {
        setStatus: (key: string, text?: string) => void;
    };
    hasUI: boolean;
    getSystemPrompt(): string;
    sessionManager: {
        getSessionId(): string;
    };
    model?: {
        provider?: string;
        id?: string;
    };
}
interface ExtensionCommandContext extends ExtensionContext {
    waitForIdle(): Promise<void>;
}
interface SessionStartEvent {
    type: 'session_start';
}
interface SessionShutdownEvent {
    type: 'session_shutdown';
}
interface BeforeAgentStartEvent {
    type: 'before_agent_start';
    systemPrompt: string;
    prompt: string;
}
interface BeforeAgentStartResult {
    systemPrompt?: string;
}
interface AgentMessage {
    role?: string;
    content?: unknown;
    [key: string]: unknown;
}
interface ContextEvent {
    type: 'context';
    messages: AgentMessage[];
}
interface ContextResult {
    messages?: AgentMessage[];
}
type Handler<E, R = undefined> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void;
type CmdHandler = (args: string, ctx: ExtensionCommandContext) => Promise<void>;
interface ExtensionAPI {
    setLabel(label: string): void;
    registerFlag(name: string, opts: {
        type: string;
        default: unknown;
        description: string;
    }): void;
    getFlag(name: string): unknown;
    registerCommand(name: string, opts: {
        description?: string;
        handler: CmdHandler;
    }): void;
    on(event: 'session_start', handler: Handler<SessionStartEvent>): void;
    on(event: 'session_shutdown', handler: Handler<SessionShutdownEvent>): void;
    on(event: 'before_agent_start', handler: Handler<BeforeAgentStartEvent, BeforeAgentStartResult>): void;
    on(event: 'context', handler: Handler<ContextEvent, ContextResult>): void;
}
export default function smartContextExtension(pi: ExtensionAPI): void;
export {};
