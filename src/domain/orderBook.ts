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
    streamError: null,
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
  state.streamError = null
}

export function applyDelta(
  state: OrderBookState,
  delta: OrderBookData,
): void {
  applyQuoteUpdates(state.bids, delta.bids)
  applyQuoteUpdates(state.asks, delta.asks)
  state.lastSeqNum = delta.seqNum
}

export function isSequenceValid(
  lastSeqNum: number | null,
  prevSeqNum: number,
): boolean {
  return lastSeqNum !== null && prevSeqNum === lastSeqNum
}

export function isCrossedOrderBook(
  bids: ReadonlyMap<string, string>,
  asks: ReadonlyMap<string, string>,
): boolean {
  if (bids.size === 0 || asks.size === 0) {
    return false
  }

  let bestBid = Number.NEGATIVE_INFINITY
  let bestAsk = Number.POSITIVE_INFINITY

  for (const price of bids.keys()) {
    bestBid = Math.max(bestBid, Number(price))
  }

  for (const price of asks.keys()) {
    bestAsk = Math.min(bestAsk, Number(price))
  }

  return bestBid >= bestAsk
}
