import type { IuiActionEvent, IuiOp } from '../types/ir';
import type { HostBridge } from '../client/plugin';
/** In-process ops/action bridge shared by host compile chain and web client. */
export declare function createHostBridge(sessionId: string): HostBridge & {
    pushOps: (ops: IuiOp[]) => void;
    onAction: (handler: (ev: IuiActionEvent) => void) => () => void;
};
