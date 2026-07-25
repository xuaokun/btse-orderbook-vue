import type {
  OrderBookData,
  OrderBookErrorResponse,
  OrderBookMessage,
  QuoteTuple,
} from '../types/orderbook'

export const ORDER_BOOK_ENDPOINT = 'wss://ws.btse.com/ws/oss/futures'
export const ORDER_BOOK_TOPIC = 'update:BTCPFC'

const SOCKET_CONNECTING = 0
const SOCKET_OPEN = 1

export interface WebSocketLike {
  readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send(data: string): void
  close(): void
}

export type WebSocketFactory = (url: string) => WebSocketLike

export interface OrderBookSocketHandlers {
  onOpen?: () => void
  onMessage: (message: OrderBookMessage) => void
  onProtocolError?: (response: OrderBookErrorResponse) => void
  onError?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
}

export type OrderBookSocketEvent =
  | {
      kind: 'message'
      message: OrderBookMessage
    }
  | {
      kind: 'error'
      response: OrderBookErrorResponse
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isQuoteTuple(value: unknown): value is QuoteTuple {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'string'
  )
}

function isOrderBookData(value: unknown): value is OrderBookData {
  if (!isRecord(value)) {
    return false
  }

  return (
    Array.isArray(value.bids) &&
    value.bids.every(isQuoteTuple) &&
    Array.isArray(value.asks) &&
    value.asks.every(isQuoteTuple) &&
    typeof value.seqNum === 'number' &&
    typeof value.prevSeqNum === 'number' &&
    (value.type === 'snapshot' || value.type === 'delta') &&
    typeof value.timestamp === 'number' &&
    typeof value.symbol === 'string'
  )
}

function isOrderBookErrorResponse(
  value: unknown,
): value is OrderBookErrorResponse {
  if (
    !isRecord(value) ||
    value.severity !== 'ERROR' ||
    !Array.isArray(value.errors) ||
    value.errors.length === 0
  ) {
    return false
  }

  return value.errors.every(
    (item) =>
      isRecord(item) &&
      typeof item.arg === 'string' &&
      isRecord(item.error) &&
      typeof item.error.code === 'number' &&
      typeof item.error.message === 'string',
  )
}

export function parseOrderBookSocketEvent(
  rawMessage: string,
): OrderBookSocketEvent | null {
  try {
    const value: unknown = JSON.parse(rawMessage)

    if (
      isRecord(value) &&
      typeof value.topic === 'string' &&
      isOrderBookData(value.data)
    ) {
      return {
        kind: 'message',
        message: {
          topic: value.topic,
          data: value.data,
        },
      }
    }

    if (isOrderBookErrorResponse(value)) {
      return {
        kind: 'error',
        response: value,
      }
    }

    return null
  } catch {
    return null
  }
}

export function parseOrderBookMessage(
  rawMessage: string,
): OrderBookMessage | null {
  const event = parseOrderBookSocketEvent(rawMessage)

  return event?.kind === 'message' ? event.message : null
}

function createBrowserWebSocket(url: string): WebSocketLike {
  return new WebSocket(url)
}

export class OrderBookSocketService {
  private socket: WebSocketLike | null = null

  constructor(
    private readonly handlers: OrderBookSocketHandlers,
    private readonly createSocket: WebSocketFactory = createBrowserWebSocket,
  ) {}

  connect(): void {
    if (
      this.socket?.readyState === SOCKET_CONNECTING ||
      this.socket?.readyState === SOCKET_OPEN
    ) {
      return
    }

    const socket = this.createSocket(ORDER_BOOK_ENDPOINT)
    this.socket = socket

    socket.onopen = () => {
      if (this.socket !== socket) {
        return
      }

      this.handlers.onOpen?.()
      this.subscribe()
    }

    socket.onmessage = (event) => {
      if (this.socket !== socket || typeof event.data !== 'string') {
        return
      }

      const parsedEvent = parseOrderBookSocketEvent(event.data)

      if (parsedEvent?.kind === 'message') {
        this.handlers.onMessage(parsedEvent.message)
      } else if (parsedEvent?.kind === 'error') {
        this.handlers.onProtocolError?.(parsedEvent.response)
      }
    }

    socket.onerror = (event) => {
      if (this.socket === socket) {
        this.handlers.onError?.(event)
      }
    }

    socket.onclose = (event) => {
      if (this.socket !== socket) {
        return
      }

      this.socket = null
      this.handlers.onClose?.(event)
    }
  }

  subscribe(): boolean {
    return this.sendOperation('subscribe')
  }

  unsubscribe(): boolean {
    return this.sendOperation('unsubscribe')
  }

  resubscribe(): boolean {
    if (!this.unsubscribe()) {
      return false
    }

    return this.subscribe()
  }

  disconnect(): void {
    this.socket?.close()
  }

  private sendOperation(operation: 'subscribe' | 'unsubscribe'): boolean {
    if (this.socket?.readyState !== SOCKET_OPEN) {
      return false
    }

    this.socket.send(
      JSON.stringify({
        op: operation,
        args: [ORDER_BOOK_TOPIC],
      }),
    )

    return true
  }
}
