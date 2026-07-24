import type { ConnectionStatus } from './orderbook'

export enum LastPriceDirection {
  Up = 'up',
  Down = 'down',
  Same = 'same',
}

export interface LastPriceState {
  currentPrice: number | null
  previousPrice: number | null
  direction: LastPriceDirection
  connectionStatus: ConnectionStatus
}
