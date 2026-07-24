import { describe, expect, it } from 'vitest'
import {
  ConnectionStatus,
  SyncStatus,
  type OrderBookData,
} from '../types/orderbook'
import {
  applyDelta,
  applySnapshot,
  createOrderBookState,
} from './orderBook'

function createOrderBookData(
  overrides: Partial<OrderBookData> = {},
): OrderBookData {
  return {
    bids: [],
    asks: [],
    seqNum: 1,
    prevSeqNum: 0,
    type: 'delta',
    timestamp: 1_700_000_000_000,
    symbol: 'BTCPFC',
    ...overrides,
  }
}

describe('createOrderBookState', () => {
  it('creates an empty disconnected and unsynchronized order book', () => {
    const state = createOrderBookState()

    expect(state.bids.size).toBe(0)
    expect(state.asks.size).toBe(0)
    expect(state.lastSeqNum).toBeNull()
    expect(state.connectionStatus).toBe(ConnectionStatus.Disconnected)
    expect(state.syncStatus).toBe(SyncStatus.Idle)
  })
})

describe('applySnapshot', () => {
  it('completely replaces the existing order book and marks it as synced', () => {
    const state = createOrderBookState()
    state.bids.set('99', '10')
    state.asks.set('102', '12')

    applySnapshot(
      state,
      createOrderBookData({
        bids: [
          ['100', '2'],
          ['98', '0'],
        ],
        asks: [
          ['101', '3'],
          ['103', '4'],
        ],
        seqNum: 200,
        prevSeqNum: 199,
        type: 'snapshot',
      }),
    )

    expect([...state.bids.entries()]).toEqual([['100', '2']])
    expect([...state.asks.entries()]).toEqual([
      ['101', '3'],
      ['103', '4'],
    ])
    expect(state.bids.has('99')).toBe(false)
    expect(state.asks.has('102')).toBe(false)
    expect(state.lastSeqNum).toBe(200)
    expect(state.syncStatus).toBe(SyncStatus.Synced)
  })
})

describe('applyDelta', () => {
  it('adds a new price level', () => {
    const state = createOrderBookState()

    applyDelta(
      state,
      createOrderBookData({
        bids: [['100', '2.5']],
        seqNum: 101,
        prevSeqNum: 100,
      }),
    )

    expect(state.bids.get('100')).toBe('2.5')
    expect(state.lastSeqNum).toBe(101)
  })

  it('replaces the size of an existing price level', () => {
    const state = createOrderBookState()
    state.asks.set('101', '2')

    applyDelta(
      state,
      createOrderBookData({
        asks: [['101', '5.5']],
        seqNum: 102,
        prevSeqNum: 101,
      }),
    )

    expect(state.asks.get('101')).toBe('5.5')
    expect(state.asks.size).toBe(1)
    expect(state.lastSeqNum).toBe(102)
  })

  it('removes a price level when its new size is zero', () => {
    const state = createOrderBookState()
    state.bids.set('100', '2')
    state.bids.set('99', '3')

    applyDelta(
      state,
      createOrderBookData({
        bids: [['100', '0']],
        seqNum: 103,
        prevSeqNum: 102,
      }),
    )

    expect(state.bids.has('100')).toBe(false)
    expect(state.bids.get('99')).toBe('3')
    expect(state.lastSeqNum).toBe(103)
  })
})
