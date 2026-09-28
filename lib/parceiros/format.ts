export function formatEUR(n: number | null | undefined): string {
  const value = Number(n ?? 0)
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Format a signed value the ledger way: negatives shown in parentheses.
export function formatSigned(n: number | null | undefined): string {
  const value = Number(n ?? 0)
  if (value < 0) return `(${formatEUR(Math.abs(value))})`
  return formatEUR(value)
}

// date stored/returned as yyyy-MM-dd -> dd/MM/yyyy
export function formatDatePT(iso: string | null | undefined): string {
  const s = String(iso ?? '')
  const part = s.slice(0, 10)
  const [y, m, d] = part.split('-')
  if (!y || !m || !d) return part
  return `${d}/${m}/${y}`
}
