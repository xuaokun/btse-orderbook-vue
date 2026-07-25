export enum ConnectionStatus {
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
}

export enum SyncStatus {
  Idle = 'idle',
  WaitingSnapshot = 'waiting-snapshot',
  Synced = 'synced',
  Resyncing = 'resyncing',
  Failed = 'failed',
}

export type QuoteTuple = [price: string, size: string]

export interface OrderBookData {
  bids: QuoteTuple[]
  asks: QuoteTuple[]
  seqNum: number
  prevSeqNum: number
  type: 'snapshot' | 'delta'
  timestamp: number
  symbol: string
}

export interface OrderBookMessage {
  topic: string
  data: OrderBookData
}

export interface OrderBookErrorDetail {
  code: number
  message: string
}

export interface OrderBookErrorItem {
  arg: string
  error: OrderBookErrorDetail
}

export interface OrderBookErrorResponse {
  severity: 'ERROR'
  errors: OrderBookErrorItem[]
}

export interface OrderBookStreamError extends OrderBookErrorDetail {
  arg: string
}

export interface OrderBookState {
  bids: Map<string, string>
  asks: Map<string, string>
  lastSeqNum: number | null
  connectionStatus: ConnectionStatus
  syncStatus: SyncStatus
  streamError: OrderBookStreamError | null
}
