import {
  SyncStatus,
  type OrderBookStreamError,
} from '../types/orderbook'

export type OrderBookDisplayStatusKind =
  | 'loading'
  | 'reconnecting'
  | 'resynchronizing'
  | 'failed'

export interface OrderBookDisplayStatus {
  kind: OrderBookDisplayStatusKind
  title: string
  detail?: string
}

export interface OrderBookStatusInput {
  syncStatus: SyncStatus
  hasCachedQuotes: boolean
  streamError: OrderBookStreamError | null
}

export function getOrderBookDisplayStatus({
  syncStatus,
  hasCachedQuotes,
  streamError,
}: OrderBookStatusInput): OrderBookDisplayStatus | null {
  if (syncStatus === SyncStatus.Synced) {
    return null
  }

  if (syncStatus === SyncStatus.Failed) {
    return {
      kind: 'failed',
      title: 'Order book unavailable',
      detail: streamError
        ? `Error ${streamError.code}: ${streamError.message}`
        : undefined,
    }
  }

  if (syncStatus === SyncStatus.Resyncing) {
    return {
      kind: 'resynchronizing',
      title: 'Resynchronizing order book…',
    }
  }

  if (hasCachedQuotes) {
    return {
      kind: 'reconnecting',
      title: 'Reconnecting order book…',
    }
  }

  return {
    kind: 'loading',
    title: 'Loading order book…',
  }
}
