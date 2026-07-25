import { reactive } from 'vue'
import {
  detectQuoteAnimation,
  type OrderBookAnimations,
  type QuoteAnimation,
  type QuoteAnimationKind,
} from '../domain/quoteAnimation'
import type {
  OrderBookMessage,
  OrderBookState,
  QuoteTuple,
} from '../types/orderbook'

const QUOTE_ANIMATION_DURATION_MS = 500

type OrderBookSide = keyof OrderBookAnimations

interface PendingQuoteAnimation {
  side: OrderBookSide
  price: string
  kind: QuoteAnimationKind
}

export function useQuoteAnimations(
  orderBookState: Pick<OrderBookState, 'bids' | 'asks'>,
) {
  const animations = reactive<OrderBookAnimations>({
    bids: new Map(),
    asks: new Map(),
  })
  const animationTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()
  let animationRevision = 0

  function getAnimationKey(side: OrderBookSide, price: string): string {
    return `${side}:${price}`
  }

  function clearQuoteAnimation(
    side: OrderBookSide,
    price: string,
  ): void {
    animations[side].delete(price)

    const key = getAnimationKey(side, price)
    const timer = animationTimers.get(key)

    if (timer !== undefined) {
      clearTimeout(timer)
      animationTimers.delete(key)
    }
  }

  function clearAnimations(): void {
    for (const timer of animationTimers.values()) {
      clearTimeout(timer)
    }

    animationTimers.clear()
    animations.bids.clear()
    animations.asks.clear()
  }

  function publishQuoteAnimation(
    side: OrderBookSide,
    price: string,
    kind: QuoteAnimationKind,
  ): void {
    clearQuoteAnimation(side, price)

    const animation: QuoteAnimation = {
      revision: ++animationRevision,
      kind,
    }

    animations[side].set(price, animation)

    const key = getAnimationKey(side, price)
    const timer = setTimeout(() => {
      const currentAnimation = animations[side].get(price)

      if (currentAnimation?.revision === animation.revision) {
        animations[side].delete(price)
      }

      animationTimers.delete(key)
    }, QUOTE_ANIMATION_DURATION_MS)

    animationTimers.set(key, timer)
  }

  function collectSideAnimations(
    side: OrderBookSide,
    currentQuotes: ReadonlyMap<string, string>,
    updates: QuoteTuple[],
  ): PendingQuoteAnimation[] {
    const workingQuotes = new Map(currentQuotes)
    const pendingAnimations: PendingQuoteAnimation[] = []

    for (const [price, nextSize] of updates) {
      const kind = detectQuoteAnimation(
        workingQuotes.get(price),
        nextSize,
      )

      if (kind) {
        pendingAnimations.push({ side, price, kind })
      }

      if (Number(nextSize) === 0) {
        workingQuotes.delete(price)
      } else {
        workingQuotes.set(price, nextSize)
      }
    }

    return pendingAnimations
  }

  function collectDeltaAnimations(
    message: OrderBookMessage,
  ): PendingQuoteAnimation[] {
    return [
      ...collectSideAnimations(
        'bids',
        orderBookState.bids,
        message.data.bids,
      ),
      ...collectSideAnimations(
        'asks',
        orderBookState.asks,
        message.data.asks,
      ),
    ]
  }

  function publishDeltaAnimations(
    message: OrderBookMessage,
    pendingAnimations: PendingQuoteAnimation[],
  ): void {
    for (const [price, size] of message.data.bids) {
      if (Number(size) === 0) {
        clearQuoteAnimation('bids', price)
      }
    }

    for (const [price, size] of message.data.asks) {
      if (Number(size) === 0) {
        clearQuoteAnimation('asks', price)
      }
    }

    for (const { side, price, kind } of pendingAnimations) {
      publishQuoteAnimation(side, price, kind)
    }
  }

  return {
    animations,
    clearAnimations,
    collectDeltaAnimations,
    publishDeltaAnimations,
  }
}
