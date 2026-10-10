export const name = 'dsh-iui-client';
let attached = null;
export function getAttachedBridge() {
    return attached;
}
/** Attach (or replace) the in-process host bridge used by the renderer. */
export function attachBridge(bridge) {
    attached = bridge;
    return () => {
        if (attached === bridge)
            attached = null;
    };
}
/**
 * Web client apply.
 * - Prefer `ctx.dshIui.bridge` from the host plugin in the same profile.
 * - Also listen for `dsh-iui.ops` events as a fallback transport.
 * - Soft-register a conversation.chat.node renderer when slots API exists.
 */
export function apply(ctx) {
    const c = ctx;
    if (c.dshIui?.bridge) {
        attachBridge(c.dshIui.bridge);
        console.info('[dsh-iui-client] host bridge attached', c.dshIui.bridge.sessionId);
    }
    else {
        console.info('[dsh-iui-client] loaded (awaiting host bridge on ctx.dshIui)');
    }
    c.on?.('dsh-iui.ops', (payload) => {
        const p = payload;
        const bridge = attached;
        if (!bridge || !p?.ops?.length)
            return;
        if (p.sessionId && p.sessionId !== bridge.sessionId)
            return;
        // Host already pushOps'd on the same bridge; event is for cross-realm mirrors.
    });
    try {
        c.slots?.inject?.('conversation.chat.node', () => c.slots?.register?.({ name: 'conversation.chat.node', id: 'dsh-iui' }, 
        // Lazy marker; real React view is IuiMount bound via host bridge in demos / profile glue.
        { kind: 'dsh-iui', getBridge: getAttachedBridge }));
    }
    catch {
        console.info('[dsh-iui-client] slots API unavailable; use IuiMount + attachBridge');
    }
}
