const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 8,
})

const fixedFractionFormatters = new Map<number, Intl.NumberFormat>()

function getFixedFractionFormatter(
  fractionDigits: number,
): Intl.NumberFormat {
  const normalizedDigits = Math.min(Math.max(fractionDigits, 0), 8)
  const cachedFormatter = fixedFractionFormatters.get(normalizedDigits)

  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: normalizedDigits,
    maximumFractionDigits: normalizedDigits,
  })

  fixedFractionFormatters.set(normalizedDigits, formatter)
  return formatter
}

export function formatNumber(
  value: string | number,
  fractionDigits?: number,
): string {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value)
  }

  if (fractionDigits !== undefined) {
    return getFixedFractionFormatter(fractionDigits).format(numericValue)
  }

  if (typeof value === 'number') {
    return numberFormatter.format(value)
  }

  const [integerPart, fractionPart] = value.split('.')
  const formattedInteger = Number(integerPart).toLocaleString('en-US')

  return fractionPart === undefined
    ? formattedInteger
    : `${formattedInteger}.${fractionPart}`
}
