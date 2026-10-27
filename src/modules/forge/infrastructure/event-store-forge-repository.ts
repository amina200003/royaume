import type { EventStore, NewEvent } from '@/platform/event-store/event-store'
import type { ForgeRepository } from '../application/forge-repository'
import { forgeStream } from '../contracts'
import { type ForgeEvent, replay } from '../domain/forge'

export function createEventStoreForgeRepository(store: EventStore): ForgeRepository {
  return {
    async load(userId) {
      const stored = await store.read(forgeStream(userId))
      const events = stored.map((e) => ({ type: e.type, data: e.data }) as ForgeEvent)
      return { state: replay(events), version: stored.at(-1)?.version ?? 0 }
    },

    async save(userId, expectedVersion, events, messages) {
      await store.append(
        forgeStream(userId),
        expectedVersion,
        events as unknown as NewEvent[],
        messages,
      )
    },
  }
}
