import type { NewMessage } from '@/platform/outbox/outbox'
import type { ForgeEvent, ForgeState } from '../domain/forge'

export interface ForgeRepository {
  load(userId: string): Promise<{ state: ForgeState; version: number }>
  save(
    userId: string,
    expectedVersion: number,
    events: ForgeEvent[],
    messages?: NewMessage[],
  ): Promise<void>
}
