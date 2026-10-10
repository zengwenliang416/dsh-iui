import type { IuiNode, IuiOp } from '../types/ir';
import { type DshIuiOpsEventData } from './events';
export declare const IUI_CHAT_KIND: "dsh-iui";
export type IuiChatState = {
    sessionKey: string;
    roots: IuiNode[];
    lastOps: IuiOp[];
    sourceMessageId?: string;
};
type SessionEventLike = {
    type: string;
    seq?: number;
    data?: DshIuiOpsEventData;
};
/**
 * Conversation node definition: match durable `dsh-iui/ops` session events.
 * Registered via `ctx.uiConversation.events.register` (conversationEvents).
 */
export declare const iuiDefinition: {
    kind: "dsh-iui";
    target: string;
    match(event: SessionEventLike): {
        id: string;
        role: "start";
    } | null;
    start(_context: unknown, match: {
        event: SessionEventLike;
    }): IuiChatState;
    update(context: {
        state: IuiChatState;
    }, match: {
        event: SessionEventLike;
    }): IuiChatState;
    buildViewNode(context: {
        key: string;
        id: string;
        state: IuiChatState;
        start?: {
            event: SessionEventLike;
            location?: unknown;
        };
        matches: Array<{
            event: SessionEventLike;
            location?: unknown;
        }>;
    }): {
        key: string;
        kind: "dsh-iui";
        id: string;
        target: string;
        anchorSeq: number;
        location: unknown;
        visibility: string;
        data: IuiChatState;
    } | null;
};
export {};
