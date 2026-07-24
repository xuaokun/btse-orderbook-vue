export const MAX_VISIBLE_QUOTES = 8

export interface QuoteRow {
  price: string
  size: string
  cumulativeTotal: number
  depthPercentage: number
}

export interface VisibleOrderBook {
  bids: QuoteRow[]
  asks: QuoteRow[]
}

interface NumericQuote {
  price: string
  size: string
  numericPrice: number
  numericSize: number
}

function selectQuotes(
  book: ReadonlyMap<string, string>,
  sortDirection: 'ascending' | 'descending',
  maxLevels: number,
): NumericQuote[] {
  return [...book.entries()]
    .map(([price, size]) => ({
      price,
      size,
      numericPrice: Number(price),
      numericSize: Number(size),
    }))
    .filter(
      ({ numericPrice, numericSize }) =>
        Number.isFinite(numericPrice) &&
        Number.isFinite(numericSize) &&
        numericSize > 0,
    )
    .sort((quoteA, quoteB) =>
      sortDirection === 'ascending'
        ? quoteA.numericPrice - quoteB.numericPrice
        : quoteB.numericPrice - quoteA.numericPrice,
    )
    .slice(0, Math.max(0, maxLevels))
}

function calculateCumulativeRows(quotes: NumericQuote[]): QuoteRow[] {
  const sideTotal = quotes.reduce(
    (total, quote) => total + quote.numericSize,
    0,
  )
  let cumulativeTotal = 0

  return quotes.map(({ price, size, numericSize }) => {
    cumulativeTotal += numericSize

    return {
      price,
      size,
      cumulativeTotal,
      depthPercentage:
        sideTotal === 0 ? 0 : (cumulativeTotal / sideTotal) * 100,
    }
  })
}

export function buildVisibleOrderBook(
  bids: ReadonlyMap<string, string>,
  asks: ReadonlyMap<string, string>,
  maxLevels = MAX_VISIBLE_QUOTES,
): VisibleOrderBook {
  const visibleBids = selectQuotes(bids, 'descending', maxLevels)
  const visibleAsks = selectQuotes(asks, 'ascending', maxLevels)

  return {
    bids: calculateCumulativeRows(visibleBids),
    asks: calculateCumulativeRows(visibleAsks).reverse(),
  }
}
