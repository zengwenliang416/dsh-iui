import { jsx as _jsx } from "react/jsx-runtime";
export function ButtonView({ nodeKey, props, onAction, }) {
    return (_jsx("button", { className: "iui-btn", type: "button", onClick: () => onAction({
            type: 'action',
            key: nodeKey,
            action: props.action,
            payload: props.payload,
        }), children: props.label }));
}
