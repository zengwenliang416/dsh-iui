import type { IuiActionEvent, SessionStateSlice } from '../types/ir';
export type SessionWritebackSink = {
    /** Append action into current session and trigger a new model turn. */
    issueActionTurn: (sessionId: string, event: IuiActionEvent) => void | Promise<void>;
    /** Persist / merge host-visible session state for next-turn injection. */
    upsertState?: (sessionId: string, blockKey: string, slice: SessionStateSlice) => void;
};
/** Format state for injection into the next model context. */
export declare function formatStateForContext(sessionId: string, state: Record<string, SessionStateSlice>): string;
export declare function formatActionForContext(event: IuiActionEvent): string;
/** Pull host-injectable slice out of an action payload (form values / selection). */
export declare function sliceFromAction(event: IuiActionEvent): SessionStateSlice;
export declare function handleAction(sessionId: string, event: IuiActionEvent, sink: SessionWritebackSink): Promise<void>;
