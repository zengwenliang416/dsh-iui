import type { IuiActionEvent } from '../types/ir';
import type { IuiChatState } from './definition';
type NodeProps = {
    node: {
        kind: string;
        data: IuiChatState;
    };
    /** Injected by slot when available */
    emitAction?: (ev: IuiActionEvent) => void;
    appendSessionEvent?: (type: string, data: unknown) => void;
};
/** conversation.chat.node renderer for kind `dsh-iui`. */
export declare function IuiChatNodeView({ node, emitAction, appendSessionEvent }: NodeProps): import("react").JSX.Element | null;
export {};
