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
  type OrderBookErrorResponse,
  type OrderBookMessage,
  type OrderBookState,
} from '../types/orderbook'
import { useQuoteAnimations } from './useQuoteAnimations'

const RETRYABLE_PROTOCOL_ERROR_CODES = new Set([1007, 1008])

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
  const {
    animations,
    clearAnimations,
    collectDeltaAnimations,
    publishDeltaAnimations,
  } = useQuoteAnimations(state)

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
    state.streamError = null
  }

  function createCandidate(): OrderBookState {
    return {
      bids: new Map(state.bids),
      asks: new Map(state.asks),
      lastSeqNum: state.lastSeqNum,
      connectionStatus: state.connectionStatus,
      syncStatus: state.syncStatus,
      streamError: state.streamError,
    }
  }

  function startResync(): void {
    if (state.syncStatus === SyncStatus.Resyncing) {
      return
    }

    state.syncStatus = SyncStatus.Resyncing
    state.lastSeqNum = null
    clearAnimations()

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

    clearAnimations()
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

    const pendingAnimations = collectDeltaAnimations(message)
    commitOrderBook(candidate)
    publishDeltaAnimations(message, pendingAnimations)
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
    state.lastSeqNum = null
    clearAnimations()

    if (state.syncStatus === SyncStatus.Failed) {
      return
    }

    state.syncStatus = SyncStatus.Idle
    reconnectBackoff.schedule()
  }

  function handleProtocolError(response: OrderBookErrorResponse): void {
    const firstError = response.errors[0]

    if (!firstError) {
      return
    }

    state.streamError = {
      arg: firstError.arg,
      code: firstError.error.code,
      message: firstError.error.message,
    }
    state.lastSeqNum = null
    clearAnimations()

    const isRetryable = response.errors.every(({ error }) =>
      RETRYABLE_PROTOCOL_ERROR_CODES.has(error.code),
    )

    if (!isRetryable) {
      state.syncStatus = SyncStatus.Failed
      reconnectBackoff.stop()
    } else {
      state.syncStatus = SyncStatus.Idle
    }

    socketService.disconnect()
    handleClose()
  }

  socketService = createSocketService({
    onOpen: handleOpen,
    onMessage: handleMessage,
    onProtocolError: handleProtocolError,
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
    animations,
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
    animations: readonly(controller.animations),
  }
}
