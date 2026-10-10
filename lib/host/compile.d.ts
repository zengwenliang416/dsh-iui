import type { IuiOp, IuiPayload, IuiType } from '../types/ir';
import { type DecideTypeOptions } from './jev';
export type CompileOptions = DecideTypeOptions & {
    confidenceThreshold?: number;
    /**
     * When true, Jev may fill missing/invalid types.
     * Default false: trust main-model type+layout; never overwrite a valid type.
     */
    jevEnabled?: boolean;
    /** Main-model fallback: assign type when Jev confidence is low (only if jevEnabled). */
    mainModelFallback?: (payload: IuiPayload) => Promise<IuiType | null> | IuiType | null;
};
/** Tracks keys already upserted and last props snapshot for patchProps diffs. */
export type CompileState = {
    keys: Set<string>;
    propsByKey: Map<string, string>;
};
export declare function emptyCompileState(): CompileState;
/** Compile payload roots into ops. Existing keys → patchProps; new → upsert. */
export declare function compilePayloadsToOps(payloads: IuiPayload[], prevKeys?: Set<string> | CompileState, opts?: CompileOptions): Promise<{
    ops: IuiOp[];
    keys: Set<string>;
    propsByKey: Map<string, string>;
    state: CompileState;
}>;
/** Incremental: progressive parse + upsert/patchProps. */
export declare function compileStreamBuffer(buffer: string, prevKeys: Set<string> | CompileState, opts: CompileOptions, parsePayloads: (buf: string) => IuiPayload[]): Promise<{
    ops: IuiOp[];
    keys: Set<string>;
    propsByKey: Map<string, string>;
    state: CompileState;
}>;
export { isPayloadReady } from './ready';
