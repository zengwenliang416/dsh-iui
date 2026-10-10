import type { ChecklistProps, IuiActionEvent } from '../types/ir';
type Props = {
    nodeKey: string;
    sessionId: string;
    props: ChecklistProps;
    onAction: (ev: IuiActionEvent) => void;
};
export declare function ChecklistView({ nodeKey, sessionId, props, onAction }: Props): import("react").JSX.Element;
export {};
