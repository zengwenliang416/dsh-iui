import type { DiagramProps, IuiActionEvent } from '../types/ir';
type Props = {
    nodeKey: string;
    sessionId: string;
    props: DiagramProps;
    onAction: (ev: IuiActionEvent) => void;
    onDiagramSelect?: (diagramKey: string, selectedId: string) => void;
};
export declare function DiagramView({ nodeKey, sessionId, props, onAction, onDiagramSelect }: Props): import("react").JSX.Element;
export {};
