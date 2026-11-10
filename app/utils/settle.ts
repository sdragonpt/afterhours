export type Transfer = { from: string; to: string; amount: number }

/**
 * Given net balances (positive = should receive, negative = owes),
 * returns a short list of transfers that settles everyone.
 * Greedy largest-debtor → largest-creditor; works in cents to avoid float drift.
 */
export function simplifyDebts(balances: Record<string, number>): Transfer[] {
  const debtors: { id: string; c: number }[] = []
  const creditors: { id: string; c: number }[] = []
  for (const [id, value] of Object.entries(balances)) {
    const c = Math.round(value * 100)
    if (c < 0) debtors.push({ id, c: -c })
    else if (c > 0) creditors.push({ id, c })
  }
  debtors.sort((a, b) => b.c - a.c)
  creditors.sort((a, b) => b.c - a.c)
  const out: Transfer[] = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!, cr = creditors[j]!
    const pay = Math.min(d.c, cr.c)
    if (pay > 0) out.push({ from: d.id, to: cr.id, amount: pay / 100 })
    d.c -= pay; cr.c -= pay
    if (d.c === 0) i++
    if (cr.c === 0) j++
  }
  return out
}

export const euros = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
