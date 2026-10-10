import type { IuiActionEvent, IuiNode } from '../types/ir';
import type { HostBridge } from './plugin';
export declare function useIuiBridge(bridge: HostBridge | null): {
    roots: IuiNode[];
    sessionId: string;
    emitAction: (ev: IuiActionEvent) => void;
    reset: () => void;
};
