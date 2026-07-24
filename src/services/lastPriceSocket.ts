import {
  type WebSocketFactory,
  type WebSocketLike,
} from './orderBookSocket'

export const LAST_PRICE_ENDPOINT = 'wss://ws.btse.com/ws/futures'
export const LAST_PRICE_TOPIC = 'tradeHistoryApi:BTCPFC'

const SOCKET_CONNECTING = 0
const SOCKET_OPEN = 1

export interface LastPriceSocketHandlers {
  onOpen?: () => void
  onPrice: (price: number) => void
  onError?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseLastPriceMessage(rawMessage: string): number | null {
  try {
    const value: unknown = JSON.parse(rawMessage)

    if (
      !isRecord(value) ||
      value.topic !== 'tradeHistoryApi' ||
      !Array.isArray(value.data) ||
      value.data.length === 0
    ) {
      return null
    }

    const firstTrade: unknown = value.data[0]

    if (
      !isRecord(firstTrade) ||
      typeof firstTrade.price !== 'number' ||
      !Number.isFinite(firstTrade.price)
    ) {
      return null
    }

    return firstTrade.price
  } catch {
    return null
  }
}

function createBrowserWebSocket(url: string): WebSocketLike {
  return new WebSocket(url)
}

export class LastPriceSocketService {
  private socket: WebSocketLike | null = null

  constructor(
    private readonly handlers: LastPriceSocketHandlers,
    private readonly createSocket: WebSocketFactory = createBrowserWebSocket,
  ) {}

  connect(): void {
    if (
      this.socket?.readyState === SOCKET_CONNECTING ||
      this.socket?.readyState === SOCKET_OPEN
    ) {
      return
    }

    const socket = this.createSocket(LAST_PRICE_ENDPOINT)
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

      const price = parseLastPriceMessage(event.data)

      if (price !== null) {
        this.handlers.onPrice(price)
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

  disconnect(): void {
    this.socket?.close()
  }

  private subscribe(): boolean {
    if (this.socket?.readyState !== SOCKET_OPEN) {
      return false
    }

    this.socket.send(
      JSON.stringify({
        op: 'subscribe',
        args: [LAST_PRICE_TOPIC],
      }),
    )

    return true
  }
}
