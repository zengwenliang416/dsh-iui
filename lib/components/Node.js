import { jsx as _jsx } from "react/jsx-runtime";
import { ButtonView } from './Button';
import { ChartView } from './Chart';
import { FormView } from './Form';
import { TextView } from './Text';
export function NodeView({ node, ctx }) {
    if (node.type === 'pending' || node.type === 'none')
        return null;
    if (node.type === 'chart') {
        return _jsx(ChartView, { props: node.props });
    }
    if (node.type === 'form') {
        return (_jsx(FormView, { nodeKey: node.key, sessionId: ctx.sessionId, props: node.props, onAction: ctx.onAction }));
    }
    if (node.type === 'button') {
        return (_jsx(ButtonView, { nodeKey: node.key, props: node.props, onAction: ctx.onAction }));
    }
    if (node.type === 'text') {
        return _jsx(TextView, { props: node.props });
    }
    if (node.type === 'row' || node.type === 'col') {
        const gap = node.props.gap ?? 12;
        const cls = node.type === 'row' ? 'iui-row' : 'iui-col';
        return (_jsx("div", { className: cls, style: { gap }, children: (node.children ?? []).map((c) => (_jsx(NodeView, { node: c, ctx: ctx }, c.key))) }));
    }
    return null;
}
export function IuiForest({ roots, sessionId, onAction, }) {
    return (_jsx("div", { className: "iui-root", children: roots.map((n) => (_jsx(NodeView, { node: n, ctx: { sessionId, onAction } }, n.key))) }));
}
