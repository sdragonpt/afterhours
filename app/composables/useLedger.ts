import type { Transfer } from '~/utils/settle'

/** Expenses (+ shares) and settlements of the active community, cached + derived balances. */
export function useLedger() {
  const supabase = useSupabaseClient()
  const me = useMe()
  const crew = useCrew()

  const res = useResource('ledger', async (c) => {
    const [e, s] = await Promise.all([
      supabase.from('expenses').select('id,description,amount,paid_by,created_by,created_at,expense_shares(user_id,amount_owed)').eq('group_id', c).order('created_at', { ascending: false }),
      supabase.from('settlements').select('id,payer_id,payee_id,amount,created_by,created_at').eq('group_id', c).order('created_at', { ascending: false }),
    ])
    if (e.error) throw e.error
    if (s.error) throw s.error
    return { expenses: e.data || [], settlements: s.data || [] }
  }, () => ({ expenses: [] as any[], settlements: [] as any[] }))

  const expenses = computed(() => res.data.value.expenses)
  const settlements = computed(() => res.data.value.settlements)
  const shares = computed(() => expenses.value.flatMap((e: any) => (e.expense_shares || []).map((s: any) => ({ ...s, expense_id: e.id }))))

  const balances = computed(() => {
    const map: Record<string, number> = {}
    for (const m of crew.members.value) map[m.user_id] = 0
    for (const e of expenses.value) map[e.paid_by] = (map[e.paid_by] || 0) + Number(e.amount)
    for (const s of shares.value) map[s.user_id] = (map[s.user_id] || 0) - Number(s.amount_owed)
    for (const s of settlements.value) {
      map[s.payer_id] = (map[s.payer_id] || 0) + Number(s.amount)
      map[s.payee_id] = (map[s.payee_id] || 0) - Number(s.amount)
    }
    return map
  })
  const myBalance = computed(() => Math.round((balances.value[me.value?.id || ''] || 0) * 100) / 100)
  const transfers = computed<Transfer[]>(() => simplifyDebts(balances.value))
  const myTransfers = computed(() => transfers.value.filter(t => t.from === me.value?.id || t.to === me.value?.id))
  /** biggest debtor — gets the "Caloteiro-mor" badge (only if they owe ≥ 5€) */
  const topDebtor = computed(() => {
    let worst: string | null = null, value = -5
    for (const [id, b] of Object.entries(balances.value)) if (b < value) { worst = id; value = b }
    return worst
  })

  return { expenses, shares, settlements, loaded: res.loaded, balances, myBalance, transfers, myTransfers, topDebtor, load: res.refresh }
}
