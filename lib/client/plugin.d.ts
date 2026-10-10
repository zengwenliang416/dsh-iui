import type { IuiActionEvent, IuiOp } from '../types/ir';
export declare const name = "dsh-iui-client";
/** Browser Cordis services — no host-only `dshIui`. */
export declare const inject: string[];
export type HostBridge = {
    onOps: (handler: (ops: IuiOp[]) => void) => () => void;
    emitAction: (ev: IuiActionEvent) => void;
    sessionId: string;
};
export type DshIuiCtx = {
    effect?: (fn: () => void | (() => void), label?: string) => void;
    slots: {
        inject: (name: string, factory: () => unknown) => void;
        register: (meta: {
            name: string;
            key?: string;
            id?: string;
            inject?: (sessionId: string) => unknown;
        }, view: unknown) => unknown;
    };
    uiConversation: {
        events: {
            register: (definition: unknown) => () => void;
        };
    };
    remote?: {
        session?: {
            append?: (type: string, data: unknown) => void;
        };
    };
    /** Optional host bridge when loaded in the same process (demo / smoke). */
    dshIui?: {
        bridge?: HostBridge;
    };
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
};
export declare function getAttachedBridge(): HostBridge | null;
export declare function attachBridge(bridge: HostBridge): () => void;
/**
 * Web client: register conversationEvents match for `dsh-iui/ops`,
 * then mount `conversation.chat.node` keyed renderer.
 */
export declare function apply(ctx: unknown): void;
