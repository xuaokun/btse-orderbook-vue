import { describe, expect, it, vi } from 'vitest'
import {
  LAST_PRICE_ENDPOINT,
  LAST_PRICE_TOPIC,
  LastPriceSocketService,
  parseLastPriceMessage,
} from './lastPriceSocket'
import type { WebSocketLike } from './orderBookSocket'

class MockWebSocket implements WebSocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  readonly sentMessages: string[] = []

  open(): void {
    this.readyState = 1
    this.onopen?.({} as Event)
  }

  emitMessage(message: string): void {
    this.onmessage?.({ data: message } as MessageEvent)
  }

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = 3
    this.onclose?.({} as CloseEvent)
  }
}

function createTradeMessage(prices: number[]): string {
  return JSON.stringify({
    topic: 'tradeHistoryApi',
    data: prices.map((price, index) => ({
      symbol: 'BTCPFC',
      side: 'BUY',
      size: 0.01,
      price,
      tradeId: index + 1,
      timestamp: 1_700_000_000_000 + index,
    })),
  })
}

describe('parseLastPriceMessage', () => {
  it('uses the first price in the trade array', () => {
    expect(parseLastPriceMessage(createTradeMessage([100, 99, 98]))).toBe(100)
  })

  it.each([
    'not-json',
    JSON.stringify({ event: 'subscribe' }),
    JSON.stringify({ topic: 'tradeHistoryApi', data: [] }),
    JSON.stringify({
      topic: 'tradeHistoryApi',
      data: [{ price: '100' }],
    }),
  ])('returns null for an unsupported message', (rawMessage) => {
    expect(parseLastPriceMessage(rawMessage)).toBeNull()
  })
})

describe('LastPriceSocketService', () => {
  it('connects once and subscribes when the socket opens', () => {
    const sockets: MockWebSocket[] = []
    const onOpen = vi.fn()
    const service = new LastPriceSocketService(
      {
        onOpen,
        onPrice: vi.fn(),
      },
      (url) => {
        expect(url).toBe(LAST_PRICE_ENDPOINT)
        const socket = new MockWebSocket()
        sockets.push(socket)
        return socket
      },
    )

    service.connect()
    service.connect()
    sockets[0]?.open()

    expect(sockets).toHaveLength(1)
    expect(onOpen).toHaveBeenCalledOnce()
    expect(sockets[0]?.sentMessages).toEqual([
      JSON.stringify({
        op: 'subscribe',
        args: [LAST_PRICE_TOPIC],
      }),
    ])
  })

  it('forwards only the first valid price', () => {
    const socket = new MockWebSocket()
    const onPrice = vi.fn()
    const service = new LastPriceSocketService(
      { onPrice },
      () => socket,
    )

    service.connect()
    socket.open()
    socket.emitMessage(createTradeMessage([101, 100]))

    expect(onPrice).toHaveBeenCalledOnce()
    expect(onPrice).toHaveBeenCalledWith(101)
  })

  it('forwards close events and allows a new connection', () => {
    const sockets: MockWebSocket[] = []
    const onClose = vi.fn()
    const service = new LastPriceSocketService(
      {
        onPrice: vi.fn(),
        onClose,
      },
      () => {
        const socket = new MockWebSocket()
        sockets.push(socket)
        return socket
      },
    )

    service.connect()
    sockets[0]?.open()
    sockets[0]?.close()
    service.connect()

    expect(onClose).toHaveBeenCalledOnce()
    expect(sockets).toHaveLength(2)
  })
})
