import { createHostBridge } from './bridge';
import { compilePayloadsToOps } from './compile';
import { parseStreamingPayloads } from './parseFence';
import { DSH_IUI_SKILL_DESCRIPTION, DSH_IUI_SKILL_NAME, DSH_IUI_SKILL_BODY, } from './skill';
import { formatActionForContext, formatStateForContext, handleAction } from './sessionWriteback';
export const name = 'dsh-iui-host';
/**
 * Host apply: registers skill + streaming compile pipeline + action writeback.
 * Soft-depends on DSH ctx.skills / session APIs when present.
 */
export function apply(ctx, options = {}) {
    const c = ctx;
    const sessionId = options.getSessionId?.() ?? 'default';
    const bridge = createHostBridge(sessionId);
    let prevKeys = new Set();
    const hostState = {};
    try {
        c.skills?.register?.({
            name: DSH_IUI_SKILL_NAME,
            description: DSH_IUI_SKILL_DESCRIPTION,
            body: DSH_IUI_SKILL_BODY,
            content: DSH_IUI_SKILL_BODY,
        });
    }
    catch {
        console.info('[dsh-iui-host] skills.register unavailable; skill exported for manual mount');
    }
    const onAssistantDelta = async (text) => {
        const payloads = parseStreamingPayloads(text);
        if (!payloads.length)
            return;
        const { ops, keys } = await compilePayloadsToOps(payloads, prevKeys, {
            confidenceThreshold: options.confidenceThreshold ?? 0.7,
            intentSummary: '',
        });
        prevKeys = keys;
        if (ops.length) {
            bridge.pushOps(ops);
            c.emit?.('dsh-iui.ops', { sessionId: bridge.sessionId, ops });
        }
    };
    bridge.onAction(async (ev) => {
        await handleAction(bridge.sessionId, ev, {
            issueActionTurn: async (sid, event) => {
                const msg = formatActionForContext(event);
                c.emit?.('dsh-iui.action', { sessionId: sid, event, message: msg });
            },
            upsertState: (sid, blockKey, slice) => {
                hostState[blockKey] = { ...hostState[blockKey], ...slice };
                c.emit?.('dsh-iui.state', {
                    sessionId: sid,
                    state: hostState,
                    context: formatStateForContext(sid, hostState),
                });
            },
        });
    });
    // Best-effort hook names; real DSH wiring may replace these.
    c.on?.('agent.assistant.delta', (payload) => {
        const text = typeof payload === 'string' ? payload : payload?.text;
        if (text)
            void onAssistantDelta(text);
    });
    c.dshIui = {
        bridge,
        onAssistantDelta,
        getStateContext: () => formatStateForContext(bridge.sessionId, hostState),
    };
    console.info('[dsh-iui-host] loaded (skill + Jev compile + action writeback)');
}
export { createHostBridge, compilePayloadsToOps, parseStreamingPayloads };
