/** Which cards are currently mounted in their tool view, so the turn tail does not show them twice. */

/** Observable set of mounted card call ids, owned by one plugin instance. */
export interface ShownCards {
  /** Mark a call's tool-view card mounted; returns the unmount callback. */
  mount(callId: string): () => void
  has(callId: string): boolean
  subscribe(listener: () => void): () => void
  /** Changes on every mount and unmount, for `useSyncExternalStore`. */
  version(): number
}

/**
 * Create the registry for one client plugin instance.
 * @returns An empty registry.
 */
export function createShownCards(): ShownCards {
  const counts = new Map<string, number>()
  const listeners = new Set<() => void>()
  let revision = 0
  const changed = () => {
    revision += 1
    for (const listener of listeners) listener()
  }
  return {
    mount(callId) {
      counts.set(callId, (counts.get(callId) ?? 0) + 1)
      changed()
      return () => {
        const count = (counts.get(callId) ?? 1) - 1
        if (count <= 0) counts.delete(callId)
        else counts.set(callId, count)
        changed()
      }
    },
    has: callId => counts.has(callId),
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    version: () => revision,
  }
}
