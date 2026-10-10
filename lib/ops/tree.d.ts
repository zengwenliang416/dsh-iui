import type { IuiNode, IuiOp, IuiProps } from '../types/ir';
export type FlatMap = Map<string, IuiNode>;
export declare function cloneNode(node: IuiNode): IuiNode;
/** Recursively drop pending/none nodes from a subtree before mounting. */
export declare function stripUnmountable(node: IuiNode): IuiNode | null;
export declare function indexTree(roots: IuiNode[], map?: FlatMap): FlatMap;
/**
 * Deep-merge props for patchProps / re-upsert.
 * Arrays and primitives from `patch` replace; plain objects recurse.
 * Keys only in `old` are kept.
 */
export declare function mergeProps(old: IuiProps, patch: IuiProps): IuiProps;
/** Merge an incoming upsert onto an existing node without wiping thinner shells. */
export declare function mergeUpsertNode(existing: IuiNode, incoming: IuiNode): IuiNode;
/** Apply a batch of ops to a forest of root nodes. Skips pending/none at apply time. */
export declare function applyOps(roots: IuiNode[], ops: IuiOp[]): IuiNode[];
