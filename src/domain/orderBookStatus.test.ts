import { describe, expect, it } from 'vitest'
import { SyncStatus } from '../types/orderbook'
import { getOrderBookDisplayStatus } from './orderBookStatus'

describe('getOrderBookDisplayStatus', () => {
  it('shows loading before the first snapshot', () => {
    expect(
      getOrderBookDisplayStatus({
        syncStatus: SyncStatus.WaitingSnapshot,
        hasCachedQuotes: false,
        streamError: null,
      }),
    ).toEqual({
      kind: 'loading',
      title: 'Loading order book…',
    })
  })

  it('shows reconnecting while cached quotes are unavailable for use', () => {
    expect(
      getOrderBookDisplayStatus({
        syncStatus: SyncStatus.Idle,
        hasCachedQuotes: true,
        streamError: null,
      }),
    ).toEqual({
      kind: 'reconnecting',
      title: 'Reconnecting order book…',
    })
  })

  it('shows resynchronizing after an invalid local order book', () => {
    expect(
      getOrderBookDisplayStatus({
        syncStatus: SyncStatus.Resyncing,
        hasCachedQuotes: true,
        streamError: null,
      }),
    ).toEqual({
      kind: 'resynchronizing',
      title: 'Resynchronizing order book…',
    })
  })

  it('hides the status after synchronization', () => {
    expect(
      getOrderBookDisplayStatus({
        syncStatus: SyncStatus.Synced,
        hasCachedQuotes: true,
        streamError: null,
      }),
    ).toBeNull()
  })

  it('shows protocol error details when recovery is not possible', () => {
    expect(
      getOrderBookDisplayStatus({
        syncStatus: SyncStatus.Failed,
        hasCachedQuotes: true,
        streamError: {
          arg: 'update:BTCPFC',
          code: 1005,
          message: 'Authentication failed.',
        },
      }),
    ).toEqual({
      kind: 'failed',
      title: 'Order book unavailable',
      detail: 'Error 1005: Authentication failed.',
    })
  })
})
