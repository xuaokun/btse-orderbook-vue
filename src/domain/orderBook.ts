import {
  ConnectionStatus,
  SyncStatus,
  type OrderBookData,
  type OrderBookState,
  type QuoteTuple,
} from '../types/orderbook'

export function createOrderBookState(): OrderBookState {
  return {
    bids: new Map(),
    asks: new Map(),
    lastSeqNum: null,
    connectionStatus: ConnectionStatus.Disconnected,
    syncStatus: SyncStatus.Idle,
  }
}

function replaceQuotes(
  target: Map<string, string>,
  quotes: QuoteTuple[],
): void {
  target.clear()

  for (const [price, size] of quotes) {
    if (Number(size) > 0) {
      target.set(price, size)
    }
  }
}

function applyQuoteUpdates(
  target: Map<string, string>,
  updates: QuoteTuple[],
): void {
  for (const [price, size] of updates) {
    if (Number(size) === 0) {
      target.delete(price)
    } else {
      target.set(price, size)
    }
  }
}

export function applySnapshot(
  state: OrderBookState,
  snapshot: OrderBookData,
): void {
  replaceQuotes(state.bids, snapshot.bids)
  replaceQuotes(state.asks, snapshot.asks)
  state.lastSeqNum = snapshot.seqNum
  state.syncStatus = SyncStatus.Synced
}

export function applyDelta(
  state: OrderBookState,
  delta: OrderBookData,
): void {
  applyQuoteUpdates(state.bids, delta.bids)
  applyQuoteUpdates(state.asks, delta.asks)
  state.lastSeqNum = delta.seqNum
}
