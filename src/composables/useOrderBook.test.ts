import { describe, expect, it, vi } from 'vitest'
import type { OrderBookSocketHandlers } from '../services/orderBookSocket'
import {
  ConnectionStatus,
  SyncStatus,
  type OrderBookMessage,
} from '../types/orderbook'
import {
  createOrderBookController,
  type OrderBookSocketPort,
} from './useOrderBook'

class FakeOrderBookSocket implements OrderBookSocketPort {
  readonly connect = vi.fn()
  readonly disconnect = vi.fn()
  readonly resubscribe = vi.fn(() => true)

  constructor(readonly handlers: OrderBookSocketHandlers) {}

  open(): void {
    this.handlers.onOpen?.()
  }

  emit(message: OrderBookMessage): void {
    this.handlers.onMessage(message)
  }

  close(): void {
    this.handlers.onClose?.({} as CloseEvent)
  }
}

function createMessage(
  type: 'snapshot' | 'delta',
  overrides: Partial<OrderBookMessage['data']> = {},
): OrderBookMessage {
  return {
    topic: 'update:BTCPFC',
    data: {
      bids: [['100', '2']],
      asks: [['101', '3']],
      seqNum: 100,
      prevSeqNum: 99,
      type,
      timestamp: 1_700_000_000_000,
      symbol: 'BTCPFC',
      ...overrides,
    },
  }
}

function setupController() {
  let socket: FakeOrderBookSocket | undefined
  const controller = createOrderBookController((handlers) => {
    socket = new FakeOrderBookSocket(handlers)
    return socket
  })

  if (!socket) {
    throw new Error('Socket service was not created')
  }

  return {
    controller,
    socket,
  }
}

describe('createOrderBookController', () => {
  it('moves through connecting and waiting-snapshot states', () => {
    const { controller, socket } = setupController()

    controller.connect()

    expect(controller.state.connectionStatus).toBe(
      ConnectionStatus.Connecting,
    )
    expect(socket.connect).toHaveBeenCalledOnce()

    socket.open()

    expect(controller.state.connectionStatus).toBe(ConnectionStatus.Connected)
    expect(controller.state.syncStatus).toBe(SyncStatus.WaitingSnapshot)
  })

  it('builds a synchronized order book from a snapshot', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()

    socket.emit(createMessage('snapshot'))

    expect([...controller.state.bids.entries()]).toEqual([['100', '2']])
    expect([...controller.state.asks.entries()]).toEqual([['101', '3']])
    expect(controller.state.lastSeqNum).toBe(100)
    expect(controller.state.syncStatus).toBe(SyncStatus.Synced)
  })

  it('atomically applies a sequential delta to both sides', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()
    socket.emit(createMessage('snapshot'))

    socket.emit(
      createMessage('delta', {
        bids: [
          ['100', '4'],
          ['99', '1'],
        ],
        asks: [
          ['101', '0'],
          ['102', '5'],
        ],
        seqNum: 101,
        prevSeqNum: 100,
      }),
    )

    expect([...controller.state.bids.entries()]).toEqual([
      ['100', '4'],
      ['99', '1'],
    ])
    expect([...controller.state.asks.entries()]).toEqual([['102', '5']])
    expect(controller.state.lastSeqNum).toBe(101)
  })

  it('re-subscribes once and ignores deltas after a sequence gap', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()
    socket.emit(createMessage('snapshot'))

    const invalidDelta = createMessage('delta', {
      bids: [['100', '9']],
      seqNum: 103,
      prevSeqNum: 102,
    })

    socket.emit(invalidDelta)
    socket.emit(invalidDelta)

    expect(socket.resubscribe).toHaveBeenCalledOnce()
    expect(controller.state.syncStatus).toBe(SyncStatus.Resyncing)
    expect(controller.state.lastSeqNum).toBeNull()
    expect(controller.state.bids.get('100')).toBe('2')
  })

  it('replaces stale data when a recovery snapshot arrives', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()
    socket.emit(createMessage('snapshot'))
    socket.emit(
      createMessage('delta', {
        seqNum: 103,
        prevSeqNum: 102,
      }),
    )

    socket.emit(
      createMessage('snapshot', {
        bids: [['98', '7']],
        asks: [['99', '8']],
        seqNum: 200,
        prevSeqNum: 199,
      }),
    )

    expect([...controller.state.bids.entries()]).toEqual([['98', '7']])
    expect([...controller.state.asks.entries()]).toEqual([['99', '8']])
    expect(controller.state.lastSeqNum).toBe(200)
    expect(controller.state.syncStatus).toBe(SyncStatus.Synced)
  })

  it('rejects a crossed delta and preserves the last valid order book', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()
    socket.emit(createMessage('snapshot'))

    socket.emit(
      createMessage('delta', {
        bids: [['102', '5']],
        asks: [],
        seqNum: 101,
        prevSeqNum: 100,
      }),
    )

    expect(socket.resubscribe).toHaveBeenCalledOnce()
    expect(controller.state.syncStatus).toBe(SyncStatus.Resyncing)
    expect(controller.state.bids.has('102')).toBe(false)
    expect(controller.state.bids.get('100')).toBe('2')
  })

  it('rejects a crossed snapshot and requests another snapshot', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()

    socket.emit(
      createMessage('snapshot', {
        bids: [['102', '2']],
        asks: [['101', '3']],
      }),
    )

    expect(socket.resubscribe).toHaveBeenCalledOnce()
    expect(controller.state.syncStatus).toBe(SyncStatus.Resyncing)
    expect(controller.state.bids.size).toBe(0)
    expect(controller.state.asks.size).toBe(0)
  })

  it('marks the order book as unsynchronized when the socket closes', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()
    socket.emit(createMessage('snapshot'))

    socket.close()

    expect(controller.state.connectionStatus).toBe(
      ConnectionStatus.Disconnected,
    )
    expect(controller.state.syncStatus).toBe(SyncStatus.Idle)
    expect(controller.state.lastSeqNum).toBeNull()
  })
})
