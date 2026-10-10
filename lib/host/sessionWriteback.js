/** Format state for injection into the next model context. */
export function formatStateForContext(sessionId, state) {
    const lines = [`[dsh-iui session-state session="${sessionId}"]`];
    for (const [key, slice] of Object.entries(state)) {
        lines.push(`- ${key}: ${JSON.stringify(slice)}`);
    }
    lines.push('[/dsh-iui session-state]');
    return lines.join('\n');
}
export function formatActionForContext(event) {
    return [
        '[dsh-iui action]',
        JSON.stringify({ key: event.key, action: event.action, payload: event.payload ?? {} }),
        '[/dsh-iui action]',
    ].join('\n');
}
export async function handleAction(sessionId, event, sink) {
    if (event.type !== 'action')
        return;
    await sink.issueActionTurn(sessionId, event);
}
