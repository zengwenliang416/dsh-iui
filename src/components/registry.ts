import type { ComponentType } from 'react'
import type { IuiType } from '../types/ir'

/** Whitelist registry: only these types mount. pending/none intentionally absent. */
export const COMPONENT_WHITELIST: ReadonlySet<IuiType> = new Set([
  'chart',
  'form',
  'button',
  'row',
  'col',
  'text',
  'checklist',
  'stat',
  'table',
])

export function isRenderableType(type: IuiType): boolean {
  return COMPONENT_WHITELIST.has(type)
}

/** Placeholder for DSH slot wiring; demo uses NodeView switch instead. */
export type RegistryEntry = {
  type: IuiType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
}

export const registryTypes = [...COMPONENT_WHITELIST]
