/** Helpers and block-independent pieces shared by the renderer's block views. */

import { createContext, useContext, type ReactNode } from 'react'
import { Heading } from '@astryxdesign/core'
import type { FrameMessage } from '../../src/catalog/protocol.ts'

/**
 * Format a value with its optional unit.
 * @param value - Number or text.
 * @param unit - Unit appended after a space.
 * @param decimals - Fixed decimals for numbers; integers default to none and others to one.
 * @returns Display text.
 */
export function formatValue(value: string | number, unit?: string, decimals?: number): string {
  const text = typeof value === 'number' ? value.toFixed(decimals ?? (Number.isInteger(value) ? 0 : 1)) : value
  return unit === undefined ? text : `${text} ${unit}`
}

/**
 * A block heading when the block has a title.
 * @param title - Optional block title.
 * @returns The heading or nothing.
 */
export function BlockTitle({ title }: { title: string | undefined }): ReactNode {
  return title === undefined ? null : <Heading level={3}>{title}</Heading>
}

/** Block tone → Astryx status/variant names. */
export const TONE_STATUS = { info: 'info', success: 'success', warning: 'warning', danger: 'error', neutral: 'neutral' } as const

const COPY = {
  zh: {
    locale: 'zh-CN',
    correct: '正确', incorrect: '再想想', chooseSection: '选择查看的内容', keys: '快捷键', action: '作用',
    start: '开始', pause: '暂停', resume: '继续', reset: '重置', timeUp: '时间到', chooseDay: '选择日期',
    states: { ok: '正常', warning: '注意', error: '异常', pending: '进行中', info: '信息' },
  },
  en: {
    locale: 'en',
    correct: 'Correct', incorrect: 'Not quite', chooseSection: 'Choose a section', keys: 'Keys', action: 'Action',
    start: 'Start', pause: 'Pause', resume: 'Resume', reset: 'Reset', timeUp: 'Time is up', chooseDay: 'Choose a day',
    states: { ok: 'OK', warning: 'Warning', error: 'Error', pending: 'In progress', info: 'Info' },
  },
} as const

/** Card copy in the host language. */
export type CardCopy = (typeof COPY)['en'] | (typeof COPY)['zh']

/**
 * Pick the card copy for a host language tag; languages other than Chinese use English.
 * @param language - Host UI language tag.
 * @returns The copy dictionary.
 */
export function copyFor(language: string): CardCopy {
  return language.toLowerCase().startsWith('zh') ? COPY.zh : COPY.en
}

/** Copy of the card being rendered. */
export const CopyContext = createContext<CardCopy>(COPY.en)

/**
 * Read the card copy.
 * @returns The copy dictionary of the current card.
 */
export function useCopy(): CardCopy {
  return useContext(CopyContext)
}

/**
 * Ask the host to open a link; the frame itself never navigates.
 * @param url - Address of the clicked link.
 */
export function openLink(url: string): void {
  window.parent.postMessage({ kind: 'dsh-iui:open', url } satisfies FrameMessage, '*')
}
