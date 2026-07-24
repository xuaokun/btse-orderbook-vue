export const RECONNECT_BASE_DELAY_MS = 1_000
export const RECONNECT_MAX_DELAY_MS = 30_000

export interface ReconnectScheduler {
  schedule(callback: () => void, delayMs: number): unknown
  cancel(handle: unknown): void
}

export interface ReconnectBackoffOptions {
  baseDelayMs?: number
  maxDelayMs?: number
  scheduler?: ReconnectScheduler
}

const defaultReconnectScheduler: ReconnectScheduler = {
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>)
  },
}

export class ReconnectBackoff {
  private readonly baseDelayMs: number
  private readonly maxDelayMs: number
  private readonly scheduler: ReconnectScheduler
  private enabled = false
  private attempt = 0
  private timer: unknown = null

  constructor(
    private readonly reconnect: () => void,
    options: ReconnectBackoffOptions = {},
  ) {
    this.baseDelayMs = options.baseDelayMs ?? RECONNECT_BASE_DELAY_MS
    this.maxDelayMs = options.maxDelayMs ?? RECONNECT_MAX_DELAY_MS
    this.scheduler = options.scheduler ?? defaultReconnectScheduler
  }

  start(): void {
    this.enabled = true
    this.clearTimer()
    this.reconnect()
  }

  schedule(): void {
    if (!this.enabled || this.timer !== null) {
      return
    }

    const delayMs = Math.min(
      this.baseDelayMs * 2 ** this.attempt,
      this.maxDelayMs,
    )
    this.attempt += 1

    this.timer = this.scheduler.schedule(() => {
      this.timer = null

      if (this.enabled) {
        this.reconnect()
      }
    }, delayMs)
  }

  reset(): void {
    this.attempt = 0
  }

  stop(): void {
    this.enabled = false
    this.clearTimer()
  }

  private clearTimer(): void {
    if (this.timer === null) {
      return
    }

    this.scheduler.cancel(this.timer)
    this.timer = null
  }
}
