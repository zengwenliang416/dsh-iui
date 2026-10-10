import type { BindSpec, IuiNode } from '../types/ir';
/** Parse safe linear bind into scale/offset. Rejects anything beyond a*$from+b. */
export declare function parseLinearBind(bind: BindSpec): {
    scale: number;
    offset: number;
} | null;
export declare function evalLinearBind(bind: BindSpec, fromValue: number): number | null;
/** Patch forest props from formValues via each node's bind (local only). */
export declare function applyBinds(roots: IuiNode[], formValues: Record<string, string | number>): IuiNode[];
