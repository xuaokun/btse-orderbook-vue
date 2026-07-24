import { onMounted, onUnmounted, reactive, readonly } from 'vue'
import {
  ReconnectBackoff,
  type ReconnectBackoffOptions,
} from '../domain/reconnectBackoff'
import {
  LastPriceSocketService,
  type LastPriceSocketHandlers,
} from '../services/lastPriceSocket'
import {
  LastPriceDirection,
  type LastPriceState,
} from '../types/lastPrice'
import { ConnectionStatus } from '../types/orderbook'

export interface LastPriceSocketPort {
  connect(): void
  disconnect(): void
}

export type LastPriceSocketServiceFactory = (
  handlers: LastPriceSocketHandlers,
) => LastPriceSocketPort

function createDefaultSocketService(
  handlers: LastPriceSocketHandlers,
): LastPriceSocketPort {
  return new LastPriceSocketService(handlers)
}

function createLastPriceState(): LastPriceState {
  return {
    currentPrice: null,
    previousPrice: null,
    direction: LastPriceDirection.Same,
    connectionStatus: ConnectionStatus.Disconnected,
  }
}

export function createLastPriceController(
  createSocketService: LastPriceSocketServiceFactory =
    createDefaultSocketService,
  reconnectOptions: ReconnectBackoffOptions = {},
) {
  const state = reactive(createLastPriceState()) as LastPriceState
  let socketService: LastPriceSocketPort

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

  function handleOpen(): void {
    state.connectionStatus = ConnectionStatus.Connected
  }

  function handlePrice(price: number): void {
    const previousPrice = state.currentPrice

    state.previousPrice = previousPrice
    state.currentPrice = price

    if (previousPrice === null || price === previousPrice) {
      state.direction = LastPriceDirection.Same
    } else if (price > previousPrice) {
      state.direction = LastPriceDirection.Up
    } else {
      state.direction = LastPriceDirection.Down
    }

    reconnectBackoff.reset()
  }

  function handleClose(): void {
    state.connectionStatus = ConnectionStatus.Disconnected
    reconnectBackoff.schedule()
  }

  socketService = createSocketService({
    onOpen: handleOpen,
    onPrice: handlePrice,
    onClose: handleClose,
  })

  function connect(): void {
    reconnectBackoff.start()
  }

  function disconnect(): void {
    reconnectBackoff.stop()
    socketService.disconnect()
    state.connectionStatus = ConnectionStatus.Disconnected
  }

  return {
    state,
    connect,
    disconnect,
  }
}

export function useLastPrice() {
  const controller = createLastPriceController()

  onMounted(controller.connect)
  onUnmounted(controller.disconnect)

  return {
    state: readonly(controller.state),
  }
}
