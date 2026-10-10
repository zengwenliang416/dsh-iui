import type { ComponentType } from 'react';
import type { IuiType } from '../types/ir';
/** Whitelist registry: only these types mount. pending/none intentionally absent. */
export declare const COMPONENT_WHITELIST: ReadonlySet<IuiType>;
export declare function isRenderableType(type: IuiType): boolean;
/** Placeholder for DSH slot wiring; demo uses NodeView switch instead. */
export type RegistryEntry = {
    type: IuiType;
    component: ComponentType<any>;
};
export declare const registryTypes: IuiType[];
