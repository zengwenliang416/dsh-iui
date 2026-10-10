import type { IuiPayload, IuiType } from '../types/ir';
export type JevChoice = 'chart' | 'form' | 'button' | 'text' | 'none';
export type JevDecideResult = {
    choice: JevChoice | 'row' | 'col';
    confidence: number;
    source: 'jev' | 'heuristic' | 'layout-passthrough';
};
/** Shape heuristic when JEV_API_KEY is missing (local demo / offline). */
export declare function heuristicPick(payload: IuiPayload): JevDecideResult;
export type DecideTypeOptions = {
    intentSummary?: string;
    apiKey?: string;
    endpoint?: string;
    /** Injected for tests. */
    fetchImpl?: typeof fetch;
};
export declare function decideType(payload: IuiPayload, opts?: DecideTypeOptions): Promise<JevDecideResult>;
export declare function isLayoutType(type: IuiType | undefined): boolean;
