import type { IuiPayload, IuiType } from '../types/ir';
/** True when a payload has the minimum props to allow first upsert. */
export declare function isPayloadReady(payload: IuiPayload, type: IuiType): boolean;
