import type { SessionStateSlice } from '../types/ir';
export declare function loadState(sessionId: string, blockKey: string): SessionStateSlice | null;
export declare function saveState(sessionId: string, blockKey: string, slice: SessionStateSlice): void;
export declare function dumpSessionState(sessionId: string): Record<string, SessionStateSlice>;
