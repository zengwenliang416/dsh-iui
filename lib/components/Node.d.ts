import type { IuiActionEvent, IuiNode } from '../types/ir';
export type RenderCtx = {
    sessionId: string;
    onAction: (ev: IuiActionEvent) => void;
    onLocalValues?: (formKey: string, values: Record<string, string | number>) => void;
    /** diagramKey → selected region id (forest-level for visibleWhen). */
    diagramSelected?: Record<string, string>;
    onDiagramSelect?: (diagramKey: string, selectedId: string) => void;
};
export declare function NodeView({ node, ctx }: {
    node: IuiNode;
    ctx: RenderCtx;
}): import("react").JSX.Element | null;
export declare function IuiForest({ roots, sessionId, onAction, }: {
    roots: IuiNode[];
    sessionId: string;
    onAction: (ev: IuiActionEvent) => void;
}): import("react").JSX.Element;
