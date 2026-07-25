import { describe, expect, it } from 'vitest'
import { formatNumber } from './formatNumber'

describe('number formatting', () => {
  it('adds thousands separators and preserves string precision', () => {
    expect(formatNumber('21699.0')).toBe('21,699.0')
    expect(formatNumber('3691')).toBe('3,691')
    expect(formatNumber('0.068650')).toBe('0.068650')
  })

  it('formats numeric values without unnecessary trailing zeroes', () => {
    expect(formatNumber(28646)).toBe('28,646')
    expect(formatNumber(1234.5)).toBe('1,234.5')
  })

  it('formats prices with exactly one decimal place', () => {
    expect(formatNumber('21699', 1)).toBe('21,699.0')
    expect(formatNumber('21699.04', 1)).toBe('21,699.0')
    expect(formatNumber(21699.05, 1)).toBe('21,699.1')
  })

  it('returns invalid values unchanged', () => {
    expect(formatNumber('invalid')).toBe('invalid')
  })
})
