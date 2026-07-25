export enum QuoteAnimationKind {
  NewQuote = 'new-quote',
  SizeIncrease = 'size-increase',
  SizeDecrease = 'size-decrease',
}

export interface QuoteAnimation {
  revision: number
  kind: QuoteAnimationKind
}

export interface OrderBookAnimations {
  bids: Map<string, QuoteAnimation>
  asks: Map<string, QuoteAnimation>
}

export function detectQuoteAnimation(
  previousSize: string | undefined,
  nextSize: string,
): QuoteAnimationKind | null {
  const numericNextSize = Number(nextSize)

  if (!Number.isFinite(numericNextSize) || numericNextSize <= 0) {
    return null
  }

  if (previousSize === undefined) {
    return QuoteAnimationKind.NewQuote
  }

  const numericPreviousSize = Number(previousSize)

  if (
    !Number.isFinite(numericPreviousSize) ||
    numericNextSize === numericPreviousSize
  ) {
    return null
  }

  return numericNextSize > numericPreviousSize
    ? QuoteAnimationKind.SizeIncrease
    : QuoteAnimationKind.SizeDecrease
}
