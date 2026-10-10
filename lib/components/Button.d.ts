import type { ButtonProps, IuiActionEvent } from '../types/ir';
export declare function ButtonView({ nodeKey, props, onAction, }: {
    nodeKey: string;
    props: ButtonProps;
    onAction: (ev: IuiActionEvent) => void;
}): import("react").JSX.Element;
