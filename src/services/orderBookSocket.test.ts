import { describe, expect, it, vi } from 'vitest'
import type {
  OrderBookErrorResponse,
  OrderBookMessage,
} from '../types/orderbook'
import {
  ORDER_BOOK_ENDPOINT,
  ORDER_BOOK_TOPIC,
  OrderBookSocketService,
  parseOrderBookMessage,
  parseOrderBookSocketEvent,
  type WebSocketLike,
} from './orderBookSocket'

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

function createMessage(
  overrides: Partial<OrderBookMessage['data']> = {},
): OrderBookMessage {
  return {
    topic: ORDER_BOOK_TOPIC,
    data: {
      bids: [['100', '2']],
      asks: [['101', '3']],
      seqNum: 101,
      prevSeqNum: 100,
      type: 'snapshot',
      timestamp: 1_700_000_000_000,
      symbol: 'BTCPFC',
      ...overrides,
    },
  }
}

function createErrorResponse(
  code = 1000,
): OrderBookErrorResponse {
  return {
    severity: 'ERROR',
    errors: [
      {
        arg: 'update:INVALID_MARKET',
        error: {
          code,
          message: 'Market pair provided is currently not supported.',
        },
      },
    ],
  }
}

describe('parseOrderBookMessage', () => {
  it('parses a valid order book message', () => {
    const message = createMessage()

    expect(parseOrderBookMessage(JSON.stringify(message))).toEqual(message)
  })

  it.each([
    'not-json',
    JSON.stringify({ event: 'subscribe' }),
    JSON.stringify({
      topic: ORDER_BOOK_TOPIC,
      data: { type: 'snapshot' },
    }),
  ])('returns null for an unsupported message', (rawMessage) => {
    expect(parseOrderBookMessage(rawMessage)).toBeNull()
  })
})

describe('parseOrderBookSocketEvent', () => {
  it('parses the documented order book error response', () => {
    const response = createErrorResponse()

    expect(parseOrderBookSocketEvent(JSON.stringify(response))).toEqual({
      kind: 'error',
      response,
    })
    expect(parseOrderBookMessage(JSON.stringify(response))).toBeNull()
  })

  it.each([
    {
      severity: 'ERROR',
      errors: [],
    },
    {
      severity: 'ERROR',
      errors: [
        {
          arg: 'update:INVALID_MARKET',
          error: {
            code: '1000',
            message: 'Invalid code type',
          },
        },
      ],
    },
  ])('rejects a malformed error response', (response) => {
    expect(
      parseOrderBookSocketEvent(JSON.stringify(response)),
    ).toBeNull()
  })
})

describe('OrderBookSocketService', () => {
  it('connects once and subscribes when the socket opens', () => {
    const sockets: MockWebSocket[] = []
    const onOpen = vi.fn()
    const service = new OrderBookSocketService(
      {
        onOpen,
        onMessage: vi.fn(),
      },
      (url) => {
        expect(url).toBe(ORDER_BOOK_ENDPOINT)
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
        args: [ORDER_BOOK_TOPIC],
      }),
    ])
  })

  it('forwards valid order book messages and ignores invalid messages', () => {
    const socket = new MockWebSocket()
    const onMessage = vi.fn()
    const service = new OrderBookSocketService(
      { onMessage },
      () => socket,
    )
    const message = createMessage()

    service.connect()
    socket.open()
    socket.emitMessage(JSON.stringify({ event: 'subscribe' }))
    socket.emitMessage(JSON.stringify(message))

    expect(onMessage).toHaveBeenCalledOnce()
    expect(onMessage).toHaveBeenCalledWith(message)
  })

  it('forwards protocol error responses separately from order book data', () => {
    const socket = new MockWebSocket()
    const onMessage = vi.fn()
    const onProtocolError = vi.fn()
    const service = new OrderBookSocketService(
      {
        onMessage,
        onProtocolError,
      },
      () => socket,
    )
    const response = createErrorResponse()

    service.connect()
    socket.open()
    socket.emitMessage(JSON.stringify(response))

    expect(onProtocolError).toHaveBeenCalledOnce()
    expect(onProtocolError).toHaveBeenCalledWith(response)
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('re-subscribes on the existing open connection', () => {
    const socket = new MockWebSocket()
    const service = new OrderBookSocketService(
      { onMessage: vi.fn() },
      () => socket,
    )

    service.connect()
    socket.open()
    socket.sentMessages.length = 0

    expect(service.resubscribe()).toBe(true)
    expect(socket.sentMessages).toEqual([
      JSON.stringify({
        op: 'unsubscribe',
        args: [ORDER_BOOK_TOPIC],
      }),
      JSON.stringify({
        op: 'subscribe',
        args: [ORDER_BOOK_TOPIC],
      }),
    ])
  })

  it('does not send subscription operations before the connection opens', () => {
    const socket = new MockWebSocket()
    const service = new OrderBookSocketService(
      { onMessage: vi.fn() },
      () => socket,
    )

    service.connect()

    expect(service.subscribe()).toBe(false)
    expect(service.unsubscribe()).toBe(false)
    expect(service.resubscribe()).toBe(false)
    expect(socket.sentMessages).toEqual([])
  })

  it('forwards close events and allows a new connection', () => {
    const sockets: MockWebSocket[] = []
    const onClose = vi.fn()
    const service = new OrderBookSocketService(
      {
        onMessage: vi.fn(),
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
