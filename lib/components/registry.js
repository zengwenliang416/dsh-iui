/** Whitelist registry: only these types mount. pending/none intentionally absent. */
export const COMPONENT_WHITELIST = new Set([
    'chart',
    'form',
    'button',
    'row',
    'col',
    'text',
]);
export function isRenderableType(type) {
    return COMPONENT_WHITELIST.has(type);
}
export const registryTypes = [...COMPONENT_WHITELIST];
