import type { IuiPayload } from '../types/ir';
/** Extract complete ```dsh-iui``` fences; incomplete trailing fence is ignored. */
export declare function extractCompleteFences(text: string): string[];
/** Body of the last unclosed ```dsh-iui fence, if any. */
export declare function extractOpenFenceBody(text: string): string | null;
/** Parse fence body into payload roots. Accepts a single node, `{blocks:[...]}`, or an array. */
export declare function parsePayloadRoots(body: string): IuiPayload[];
/**
 * Extract balanced `{...}` slices that parse as IuiPayload from arbitrary text
 * (used for progressive streaming inside an open fence).
 */
export declare function extractCompleteJsonObjects(text: string): IuiPayload[];
/** Streaming helper: only return roots from fully closed fences in the buffer. */
export declare function parseStreamingPayloads(buffer: string): IuiPayload[];
/**
 * Progressive streaming: closed fences + complete JSON objects inside an open fence.
 * Returns a flat list (parents and children) so each ready node can upsert independently.
 */
export declare function parseProgressivePayloads(buffer: string): IuiPayload[];
