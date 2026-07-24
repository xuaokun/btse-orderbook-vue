import { onMounted, onUnmounted, reactive, readonly } from 'vue'
import {
  applyDelta,
  applySnapshot,
  createOrderBookState,
  isCrossedOrderBook,
  isSequenceValid,
} from '../domain/orderBook'
import {
  ReconnectBackoff,
  type ReconnectBackoffOptions,
} from '../domain/reconnectBackoff'
import {
  OrderBookSocketService,
  type OrderBookSocketHandlers,
} from '../services/orderBookSocket'
import {
  ConnectionStatus,
  SyncStatus,
  type OrderBookMessage,
  type OrderBookState,
} from '../types/orderbook'

export interface OrderBookSocketPort {
  connect(): void
  disconnect(): void
  resubscribe(): boolean
}

export type OrderBookSocketServiceFactory = (
  handlers: OrderBookSocketHandlers,
) => OrderBookSocketPort

export type OrderBookReconnectOptions = ReconnectBackoffOptions

function createDefaultSocketService(
  handlers: OrderBookSocketHandlers,
): OrderBookSocketPort {
  return new OrderBookSocketService(handlers)
}

function replaceMap(
  target: Map<string, string>,
  source: ReadonlyMap<string, string>,
): void {
  target.clear()

  for (const [price, size] of source) {
    target.set(price, size)
  }
}

export function createOrderBookController(
  createSocketService: OrderBookSocketServiceFactory =
    createDefaultSocketService,
  reconnectOptions: OrderBookReconnectOptions = {},
) {
  const state = reactive(createOrderBookState()) as OrderBookState

  let socketService: OrderBookSocketPort

  function openConnection(): void {
    if (state.connectionStatus !== ConnectionStatus.Disconnected) {
      return
    }

    state.connectionStatus = ConnectionStatus.Connecting
    socketService.connect()
  }

  const reconnectBackoff = new ReconnectBackoff(
    openConnection,
    reconnectOptions,
  )

  function commitOrderBook(candidate: OrderBookState): void {
    replaceMap(state.bids, candidate.bids)
    replaceMap(state.asks, candidate.asks)
    state.lastSeqNum = candidate.lastSeqNum
    state.syncStatus = SyncStatus.Synced
  }

  function createCandidate(): OrderBookState {
    return {
      bids: new Map(state.bids),
      asks: new Map(state.asks),
      lastSeqNum: state.lastSeqNum,
      connectionStatus: state.connectionStatus,
      syncStatus: state.syncStatus,
    }
  }

  function startResync(): void {
    if (state.syncStatus === SyncStatus.Resyncing) {
      return
    }

    state.syncStatus = SyncStatus.Resyncing
    state.lastSeqNum = null

    if (!socketService.resubscribe()) {
      socketService.disconnect()
      handleClose()
    }
  }

  function handleSnapshot(message: OrderBookMessage): void {
    const candidate = createOrderBookState()
    applySnapshot(candidate, message.data)

    if (isCrossedOrderBook(candidate.bids, candidate.asks)) {
      startResync()
      return
    }

    commitOrderBook(candidate)
    reconnectBackoff.reset()
  }

  function handleDelta(message: OrderBookMessage): void {
    if (state.syncStatus !== SyncStatus.Synced) {
      return
    }

    if (!isSequenceValid(state.lastSeqNum, message.data.prevSeqNum)) {
      startResync()
      return
    }

    const candidate = createCandidate()
    applyDelta(candidate, message.data)

    if (isCrossedOrderBook(candidate.bids, candidate.asks)) {
      startResync()
      return
    }

    commitOrderBook(candidate)
  }

  function handleMessage(message: OrderBookMessage): void {
    if (state.connectionStatus !== ConnectionStatus.Connected) {
      return
    }

    if (message.data.type === 'snapshot') {
      handleSnapshot(message)
    } else {
      handleDelta(message)
    }
  }

  function handleOpen(): void {
    state.connectionStatus = ConnectionStatus.Connected
    state.syncStatus = SyncStatus.WaitingSnapshot
    state.lastSeqNum = null
  }

  function handleClose(): void {
    state.connectionStatus = ConnectionStatus.Disconnected
    state.syncStatus = SyncStatus.Idle
    state.lastSeqNum = null
    reconnectBackoff.schedule()
  }

  socketService = createSocketService({
    onOpen: handleOpen,
    onMessage: handleMessage,
    onClose: handleClose,
  })

  function connect(): void {
    reconnectBackoff.start()
  }

  function disconnect(): void {
    reconnectBackoff.stop()
    socketService.disconnect()
    handleClose()
  }

  return {
    state,
    connect,
    disconnect,
  }
}

export function useOrderBook() {
  const controller = createOrderBookController()

  onMounted(controller.connect)
  onUnmounted(controller.disconnect)

  return {
    state: readonly(controller.state),
  }
}
