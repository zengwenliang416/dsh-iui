/** In-process ops/action bridge shared by host compile chain and web client. */
export function createHostBridge(sessionId) {
    const opsHandlers = new Set();
    const actionHandlers = new Set();
    return {
        sessionId,
        onOps(handler) {
            opsHandlers.add(handler);
            return () => {
                opsHandlers.delete(handler);
            };
        },
        emitAction(ev) {
            for (const h of actionHandlers)
                h(ev);
        },
        pushOps(ops) {
            for (const h of opsHandlers)
                h(ops);
        },
        onAction(handler) {
            actionHandlers.add(handler);
            return () => {
                actionHandlers.delete(handler);
            };
        },
    };
}
