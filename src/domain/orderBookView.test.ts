import { describe, expect, it } from 'vitest'
import {
  MAX_VISIBLE_QUOTES,
  buildVisibleOrderBook,
} from './orderBookView'

describe('buildVisibleOrderBook', () => {
  it('sorts bids from highest to lowest and accumulates in display order', () => {
    const bids = new Map([
      ['98', '5'],
      ['100', '2'],
      ['99', '3'],
    ])

    const { bids: rows } = buildVisibleOrderBook(bids, new Map())

    expect(rows).toEqual([
      {
        price: '100',
        size: '2',
        cumulativeTotal: 2,
        depthPercentage: 20,
      },
      {
        price: '99',
        size: '3',
        cumulativeTotal: 5,
        depthPercentage: 50,
      },
      {
        price: '98',
        size: '5',
        cumulativeTotal: 10,
        depthPercentage: 100,
      },
    ])
  })

  it('accumulates asks from lowest to highest, then reverses them for display', () => {
    const asks = new Map([
      ['103', '5'],
      ['101', '2'],
      ['102', '3'],
    ])

    const { asks: rows } = buildVisibleOrderBook(new Map(), asks)

    expect(rows).toEqual([
      {
        price: '103',
        size: '5',
        cumulativeTotal: 10,
        depthPercentage: 100,
      },
      {
        price: '102',
        size: '3',
        cumulativeTotal: 5,
        depthPercentage: 50,
      },
      {
        price: '101',
        size: '2',
        cumulativeTotal: 2,
        depthPercentage: 20,
      },
    ])
  })

  it('selects only the best eight levels on each side', () => {
    const bids = new Map<string, string>()
    const asks = new Map<string, string>()

    for (let index = 0; index < 11; index += 1) {
      bids.set(String(90 + index), '1')
      asks.set(String(101 + index), '1')
    }

    const visible = buildVisibleOrderBook(bids, asks)

    expect(visible.bids).toHaveLength(MAX_VISIBLE_QUOTES)
    expect(visible.bids.map(({ price }) => price)).toEqual([
      '100',
      '99',
      '98',
      '97',
      '96',
      '95',
      '94',
      '93',
    ])
    expect(visible.asks).toHaveLength(MAX_VISIBLE_QUOTES)
    expect(visible.asks.map(({ price }) => price)).toEqual([
      '108',
      '107',
      '106',
      '105',
      '104',
      '103',
      '102',
      '101',
    ])
    expect(
      visible.bids.map(({ cumulativeTotal }) => cumulativeTotal),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(
      visible.asks.map(({ cumulativeTotal }) => cumulativeTotal),
    ).toEqual([8, 7, 6, 5, 4, 3, 2, 1])
    expect(visible.bids.at(-1)?.depthPercentage).toBe(100)
    expect(visible.asks.at(0)?.depthPercentage).toBe(100)
  })

  it('calculates each side percentage from its own visible total', () => {
    const bids = new Map([
      ['100', '10'],
      ['99', '10'],
      ['98', '20'],
    ])
    const asks = new Map([
      ['101', '2'],
      ['102', '3'],
      ['103', '5'],
    ])

    const visible = buildVisibleOrderBook(bids, asks, 2)

    expect(
      visible.bids.map(({ depthPercentage }) => depthPercentage),
    ).toEqual([
      50,
      100,
    ])
    expect(
      visible.asks.map(({ depthPercentage }) => depthPercentage),
    ).toEqual([
      100,
      40,
    ])
  })

  it('returns empty rows for empty books or a non-positive level limit', () => {
    expect(buildVisibleOrderBook(new Map(), new Map())).toEqual({
      bids: [],
      asks: [],
    })

    expect(
      buildVisibleOrderBook(
        new Map([['100', '1']]),
        new Map([['101', '1']]),
        0,
      ),
    ).toEqual({
      bids: [],
      asks: [],
    })
  })

  it('does not mutate the complete local order book', () => {
    const bids = new Map([
      ['99', '3'],
      ['100', '2'],
    ])
    const asks = new Map([
      ['102', '4'],
      ['101', '1'],
    ])
    const bidsBefore = [...bids.entries()]
    const asksBefore = [...asks.entries()]

    buildVisibleOrderBook(bids, asks)

    expect([...bids.entries()]).toEqual(bidsBefore)
    expect([...asks.entries()]).toEqual(asksBefore)
  })
})
