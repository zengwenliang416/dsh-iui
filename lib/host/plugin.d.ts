import { createHostBridge } from './bridge';
import { compilePayloadsToOps } from './compile';
import { parseProgressivePayloads } from './parseFence';
export declare const name = "dsh-iui-host";
/** Soft deps — Cordis resolves when present in the profile. */
export declare const inject: string[];
export type HostPluginOptions = {
    confidenceThreshold?: number;
    /** Default false: skip Jev; only fill missing/invalid types when true. */
    jevEnabled?: boolean;
    getSessionId?: () => string;
};
/**
 * Host apply: provide `dshIui` + skill + compile on assistant settlement +
 * durable `dsh-iui/ops` session events for the Web Client over the wire.
 */
export declare function apply(ctx: unknown, options?: HostPluginOptions): void;
export { createHostBridge, compilePayloadsToOps, parseProgressivePayloads };
