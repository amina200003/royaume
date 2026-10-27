import type { Db } from '@/platform/db/client'
import type { EventStore } from '@/platform/event-store/event-store'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { ChannelPolicy } from '@/platform/realtime/channel-policy'
import { createForgeApi } from './api'
import { createForgeService } from './application/forge-service'
import { forgeChannel } from './contracts'
import { createDrizzleForgeReader } from './infrastructure/drizzle-forge-reader'
import { createEventStoreForgeRepository } from './infrastructure/event-store-forge-repository'
import { createForgeHandlers } from './messages'
import { createForgePersonalData } from './personal-data'

export interface ForgeModuleDeps {
  store: EventStore
  db: Db
  projections: ProjectionRunner
  dispatch?: () => Promise<unknown>
  clock?: () => number
}

export function createForgeModule({ store, db, projections, dispatch, clock }: ForgeModuleDeps) {
  const repo = createEventStoreForgeRepository(store)
  const reader = createDrizzleForgeReader(db, projections)
  const service = createForgeService(repo, reader, { dispatch, clock })

  const channelPolicy: ChannelPolicy = {
    prefix: 'forge-',
    canSubscribe: (channel, userId) => channel === forgeChannel(userId),
  }

  return {
    api: createForgeApi(service),
    channelPolicy,
    handlers: createForgeHandlers(service),
    personalData: createForgePersonalData(service, db),
  }
}

export type { ForgeApi } from './api'
