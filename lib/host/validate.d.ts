import type { BindSpec, DiagramProps, DiagramRegion, FormField, HotspotProps, IuiPayload } from '../types/ir';
export declare function fieldKey(f: FormField): string | null;
export declare function fieldKind(f: FormField): FormField['kind'] | undefined;
/** Normalize + validate a slider field; returns null if invalid. */
export declare function sanitizeSliderField(raw: FormField): FormField | null;
export declare function sanitizeFormFields(fields: unknown): FormField[];
export declare function parseLinearBind(bind: BindSpec): {
    scale: number;
    offset: number;
} | null;
export declare function sanitizeBind(raw: unknown): BindSpec | null;
export declare function sanitizeBinds(raw: unknown): BindSpec[] | undefined;
/** Apply validated linear bind: returns new value for prop path leaf. */
export declare function evalLinearBind(bind: BindSpec, fromValue: number): number | null;
/** Allow https: URLs or same-repo relative paths only (no javascript:/data:). */
export declare function isSafeDiagramSrc(src: unknown): src is string;
export declare function sanitizeRegion(raw: unknown): DiagramRegion | null;
export declare function sanitizeDiagramProps(raw: unknown): DiagramProps | null;
export declare function sanitizeHotspotProps(raw: unknown): HotspotProps | null;
/** Sanitize form props + bind on a payload tree (compile-time whitelist). */
export declare function sanitizePayload(payload: IuiPayload): IuiPayload | null;
