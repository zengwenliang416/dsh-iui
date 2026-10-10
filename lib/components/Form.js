import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { loadState, saveState } from '../state/sessionStore';
export function FormView({ nodeKey, sessionId, props, onAction }) {
    const saved = loadState(sessionId, nodeKey);
    const initial = {
        ...(props.values ?? {}),
        ...(saved?.formValues ?? {}),
    };
    const [values, setValues] = useState(initial);
    useEffect(() => {
        saveState(sessionId, nodeKey, { formValues: values });
    }, [sessionId, nodeKey, values]);
    return (_jsxs("form", { className: "iui-card iui-form", onSubmit: (e) => {
            e.preventDefault();
            onAction({
                type: 'action',
                key: nodeKey,
                action: props.submitAction ?? 'submit',
                payload: { values },
            });
        }, children: [(props.fields ?? []).map((f) => (_jsxs("div", { className: "iui-field", children: [_jsx("label", { htmlFor: `${nodeKey}-${f.name}`, children: f.label ?? f.name }), f.kind === 'select' ? (_jsxs("select", { id: `${nodeKey}-${f.name}`, value: String(values[f.name] ?? ''), onChange: (e) => setValues((v) => ({ ...v, [f.name]: e.target.value })), children: [_jsx("option", { value: "", children: "\u8BF7\u9009\u62E9" }), (f.options ?? []).map((o) => (_jsx("option", { value: o, children: o }, o)))] })) : (_jsx("input", { id: `${nodeKey}-${f.name}`, type: f.kind === 'number' ? 'number' : 'text', placeholder: f.placeholder, value: values[f.name] ?? '', onChange: (e) => setValues((v) => ({
                            ...v,
                            [f.name]: f.kind === 'number' ? Number(e.target.value) : e.target.value,
                        })) }))] }, f.name))), _jsx("button", { className: "iui-btn", type: "submit", children: props.submitLabel ?? '提交' })] }));
}
