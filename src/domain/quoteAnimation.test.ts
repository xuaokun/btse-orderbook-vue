import { describe, expect, it } from 'vitest'
import {
  detectQuoteAnimation,
  QuoteAnimationKind,
} from './quoteAnimation'

describe('detectQuoteAnimation', () => {
  it('detects a newly added quote', () => {
    expect(detectQuoteAnimation(undefined, '10')).toBe(
      QuoteAnimationKind.NewQuote,
    )
  })

  it('detects size increases and decreases', () => {
    expect(detectQuoteAnimation('10', '11')).toBe(
      QuoteAnimationKind.SizeIncrease,
    )
    expect(detectQuoteAnimation('10', '9')).toBe(
      QuoteAnimationKind.SizeDecrease,
    )
  })

  it('ignores unchanged sizes and deletions', () => {
    expect(detectQuoteAnimation('10', '10.0')).toBeNull()
    expect(detectQuoteAnimation('10', '0')).toBeNull()
  })

  it('ignores invalid next sizes', () => {
    expect(detectQuoteAnimation('10', 'invalid')).toBeNull()
  })
})
