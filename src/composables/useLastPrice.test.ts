import { describe, expect, it, vi } from 'vitest'
import type { ReconnectScheduler } from '../domain/reconnectBackoff'
import type { LastPriceSocketHandlers } from '../services/lastPriceSocket'
import { LastPriceDirection } from '../types/lastPrice'
import { ConnectionStatus } from '../types/orderbook'
import {
  createLastPriceController,
  type LastPriceSocketPort,
} from './useLastPrice'

class FakeLastPriceSocket implements LastPriceSocketPort {
  readonly connect = vi.fn()
  readonly disconnect = vi.fn()

  constructor(readonly handlers: LastPriceSocketHandlers) {}

  open(): void {
    this.handlers.onOpen?.()
  }

  emitPrice(price: number): void {
    this.handlers.onPrice(price)
  }

  close(): void {
    this.handlers.onClose?.({} as CloseEvent)
  }
}

class FakeReconnectScheduler implements ReconnectScheduler {
  readonly schedule = vi.fn((callback: () => void, delayMs: number) => {
    const handle = Symbol('reconnect-timer')
    this.pending.push({ callback, delayMs, handle })
    return handle
  })

  readonly cancel = vi.fn((handle: unknown) => {
    this.pending = this.pending.filter((timer) => timer.handle !== handle)
  })

  private pending: Array<{
    callback: () => void
    delayMs: number
    handle: unknown
  }> = []

  get delays(): number[] {
    return this.pending.map((timer) => timer.delayMs)
  }

  runNext(): void {
    const timer = this.pending.shift()

    if (!timer) {
      throw new Error('No reconnect timer is pending')
    }

    timer.callback()
  }
}

function setupController() {
  let socket: FakeLastPriceSocket | undefined
  const scheduler = new FakeReconnectScheduler()
  const controller = createLastPriceController(
    (handlers) => {
      socket = new FakeLastPriceSocket(handlers)
      return socket
    },
    { scheduler },
  )

  if (!socket) {
    throw new Error('Socket service was not created')
  }

  return {
    controller,
    socket,
    scheduler,
  }
}

describe('createLastPriceController', () => {
  it('tracks the connection lifecycle', () => {
    const { controller, socket } = setupController()

    controller.connect()
    expect(controller.state.connectionStatus).toBe(
      ConnectionStatus.Connecting,
    )

    socket.open()
    expect(controller.state.connectionStatus).toBe(ConnectionStatus.Connected)
  })

  it('uses the neutral direction for the first price', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()

    socket.emitPrice(100)

    expect(controller.state.currentPrice).toBe(100)
    expect(controller.state.previousPrice).toBeNull()
    expect(controller.state.direction).toBe(LastPriceDirection.Same)
  })

  it('tracks upward, downward and unchanged prices', () => {
    const { controller, socket } = setupController()
    controller.connect()
    socket.open()

    socket.emitPrice(100)
    socket.emitPrice(101)
    expect(controller.state.previousPrice).toBe(100)
    expect(controller.state.direction).toBe(LastPriceDirection.Up)

    socket.emitPrice(99)
    expect(controller.state.previousPrice).toBe(101)
    expect(controller.state.direction).toBe(LastPriceDirection.Down)

    socket.emitPrice(99)
    expect(controller.state.previousPrice).toBe(99)
    expect(controller.state.direction).toBe(LastPriceDirection.Same)
  })

  it('reconnects after an unexpected close', () => {
    const { controller, socket, scheduler } = setupController()
    controller.connect()
    socket.open()

    socket.close()
    expect(controller.state.connectionStatus).toBe(
      ConnectionStatus.Disconnected,
    )
    expect(scheduler.delays).toEqual([1_000])

    scheduler.runNext()
    expect(socket.connect).toHaveBeenCalledTimes(2)
  })

  it('cancels reconnection after an intentional disconnect', () => {
    const { controller, socket, scheduler } = setupController()
    controller.connect()
    socket.open()
    socket.close()

    controller.disconnect()

    expect(socket.disconnect).toHaveBeenCalledOnce()
    expect(scheduler.cancel).toHaveBeenCalledOnce()
    expect(scheduler.delays).toEqual([])
  })
})
