import { z } from 'zod'
import type { MessageHandler } from '@/platform/outbox/outbox'
import type { ForgeService } from './application/forge-service'
import { FORGE_TOPICS } from './contracts'

/** Schéma du message de réponse envoyé par le Village. */
const TransferResultMessage = z.object({
  transferId: z.string().min(1),
  outcome: z.enum(['withdrawn', 'refused', 'deposited']),
  missing: z.record(z.string(), z.number()).optional(),
})

/**
 * Le transferId de la forge a la forme '<userId>:<uuid>'.
 * On en extrait le userId pour savoir quel flux charger.
 */
function playerIdFromTransferId(transferId: string): string {
  const colonIndex = transferId.indexOf(':')
  return colonIndex >= 0 ? transferId.slice(0, colonIndex) : transferId
}

export function createForgeHandlers(service: ForgeService): Record<string, MessageHandler> {
  return {
    [FORGE_TOPICS.transferResult]: async (message) => {
      const { transferId, outcome, missing } = TransferResultMessage.parse(message.payload)
      const userId = playerIdFromTransferId(transferId)

      if (outcome === 'withdrawn') {
        await service.step(userId, { type: 'ConfirmCrafting', transferId })
      } else if (outcome === 'refused') {
        await service.step(userId, { type: 'RefuseCrafting', transferId, missing: missing ?? {} })
      }
    },
  }
}
