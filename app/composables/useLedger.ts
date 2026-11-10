import type { Transfer } from '~/utils/settle'

/** Expenses, shares and settlements of the active community + derived balances. */
export function useLedger() {
  const supabase = useSupabaseClient()
  const community = useCommunity()
  const me = useMe()
  const crew = useCrew()

  const expenses = ref<any[]>([])
  const shares = ref<any[]>([])
  const settlements = ref<any[]>([])
  const loading = ref(false)
  const error = ref('')

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

  async function load() {
    if (!community.value) return
    loading.value = true; error.value = ''
    const [e, s] = await Promise.all([
      supabase.from('expenses').select('id,description,amount,paid_by,created_by,created_at').eq('group_id', community.value).order('created_at', { ascending: false }),
      supabase.from('settlements').select('id,payer_id,payee_id,amount,created_by,created_at').eq('group_id', community.value).order('created_at', { ascending: false }),
    ])
    if (e.error || s.error) { error.value = (e.error || s.error)!.message; loading.value = false; return }
    expenses.value = e.data || []
    settlements.value = s.data || []
    const ids = expenses.value.map(x => x.id)
    if (ids.length) {
      const { data } = await supabase.from('expense_shares').select('expense_id,user_id,amount_owed').in('expense_id', ids)
      shares.value = data || []
    } else shares.value = []
    loading.value = false
  }

  return { expenses, shares, settlements, loading, error, balances, myBalance, transfers, myTransfers, topDebtor, load }
}
