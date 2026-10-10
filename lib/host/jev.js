const LAYOUT = new Set(['row', 'col']);
const CRITERIA = {
    chart: 'numeric series / time series / comparison chart data',
    form: 'user should fill fields or submit structured input',
    button: 'a single clickable action',
    text: 'prose or labels only, no interactive control',
    none: 'do not render a UI block; keep markdown only',
};
/** Shape heuristic when JEV_API_KEY is missing (local demo / offline). */
export function heuristicPick(payload) {
    const props = payload.props;
    if (Array.isArray(props.series)) {
        return { choice: 'chart', confidence: 0.9, source: 'heuristic' };
    }
    if (Array.isArray(props.fields)) {
        return { choice: 'form', confidence: 0.9, source: 'heuristic' };
    }
    if (typeof props.label === 'string' && typeof props.action === 'string') {
        return { choice: 'button', confidence: 0.9, source: 'heuristic' };
    }
    if (typeof props.content === 'string') {
        return { choice: 'text', confidence: 0.85, source: 'heuristic' };
    }
    return { choice: 'none', confidence: 0.6, source: 'heuristic' };
}
export async function decideType(payload, opts = {}) {
    if (payload.type && LAYOUT.has(payload.type)) {
        return { choice: payload.type, confidence: 1, source: 'layout-passthrough' };
    }
    // Layout types must stay as-is — never run Jev on row/col.
    if (payload.type === 'row' || payload.type === 'col') {
        return { choice: payload.type, confidence: 1, source: 'layout-passthrough' };
    }
    const apiKey = opts.apiKey ??
        (typeof globalThis !== 'undefined' &&
            globalThis.process?.env
            ? globalThis.process.env.JEV_API_KEY
            : undefined);
    if (!apiKey)
        return heuristicPick(payload);
    const endpoint = opts.endpoint ?? 'https://jevtypesafeai.com/api/v1/decide';
    const fetchFn = opts.fetchImpl ?? fetch;
    const state = {
        intent: opts.intentSummary ?? '',
        key: payload.key,
        propsShape: Object.keys(payload.props ?? {}),
        props: payload.props,
    };
    try {
        const res = await fetchFn(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'jev-latest',
                state,
                questions: {
                    component: {
                        type: 'choice',
                        instructions: 'Pick the best UI component type for this payload block.',
                        criteria: CRITERIA,
                    },
                },
            }),
        });
        if (!res.ok)
            return heuristicPick(payload);
        const data = (await res.json());
        const choice = data.answers?.component?.choice;
        const confidence = data.answers?.component?.confidence ?? 0;
        if (!choice || !(choice in CRITERIA))
            return heuristicPick(payload);
        return { choice, confidence, source: 'jev' };
    }
    catch {
        return heuristicPick(payload);
    }
}
export function isLayoutType(type) {
    return type === 'row' || type === 'col';
}
