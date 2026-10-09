type Content = { type: 'text'; text: string }

export type PlainUserMessage = {
  id: string
  role: 'user'
  source: { kind: string }
  content: Content[]
}

/** Build a plain user-shaped message for agent.steer / followup / inject. */
export function buildUserMessage(text: string, sourceKind: string): PlainUserMessage {
  return {
    id: `dsh-iui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    source: { kind: sourceKind },
    content: [{ type: 'text', text }],
  }
}
