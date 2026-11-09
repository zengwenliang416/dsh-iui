/** Messages between the card frame in Chat and the isolated renderer inside it. */

import type { ResolvedCard } from './spec.ts'

/** Reader state of one card, keyed by block index. */
export interface CardState {
  /** Selected option id per choice block, section id per sections block, step index per steps block, day per calendar block. */
  readonly selections: Readonly<Record<string, string>>
  /** Current input values per calculator block. */
  readonly values: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Ticked item ids per checklist block. */
  readonly checks: Readonly<Record<string, readonly string[]>>
}

/** Host colors the renderer adopts. */
export interface FrameTheme {
  readonly mode: 'light' | 'dark'
  /** Host accent color, a CSS color string. */
  readonly accent?: string
}

/** Host → renderer: draw this card with this state and theme. */
export interface RenderMessage {
  readonly kind: 'dsh-iui:render'
  readonly card: ResolvedCard
  readonly state: CardState
  readonly theme: FrameTheme
  /** Host UI language tag, such as zh-CN or en. */
  readonly language: string
}

/** Renderer → host. */
export type FrameMessage =
  | { readonly kind: 'dsh-iui:ready' }
  | { readonly kind: 'dsh-iui:height'; readonly height: number }
  | { readonly kind: 'dsh-iui:state'; readonly state: CardState }
  /** Open a link the reader clicked; the host opens only http and https addresses, in a new browser tab. */
  | { readonly kind: 'dsh-iui:open'; readonly url: string }

/** State before any reader interaction. */
export const EMPTY_STATE: CardState = { selections: {}, values: {}, checks: {} }
