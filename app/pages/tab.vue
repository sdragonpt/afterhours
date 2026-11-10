<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const community = useCommunity()
const members = ref<any[]>([])
const expenses = ref<any[]>([])
const shares = ref<any[]>([])
const settlements = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const description = ref('')
const amount = ref<number | null>(null)
const selectedParticipants = ref<string[]>([])
const settlementPayee = ref('')
const settlementAmount = ref<number | null>(null)
const showExpenseForm = ref(false)
const showSettlementForm = ref(false)

const money = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
const memberName = (id: string) => members.value.find(m => m.user_id === id)?.profile?.display_name || (id === user.value?.id ? 'Tu' : `Membro ${id.slice(0, 5)}`)

const balances = computed(() => {
  const map = new Map<string, number>()
  for (const member of members.value) map.set(member.user_id, 0)
  for (const expense of expenses.value) map.set(expense.paid_by, (map.get(expense.paid_by) || 0) + Number(expense.amount))
  for (const share of shares.value) map.set(share.user_id, (map.get(share.user_id) || 0) - Number(share.amount_owed))
  for (const settlement of settlements.value) {
    map.set(settlement.payer_id, (map.get(settlement.payer_id) || 0) + Number(settlement.amount))
    map.set(settlement.payee_id, (map.get(settlement.payee_id) || 0) - Number(settlement.amount))
  }
  return members.value.map(member => ({ ...member, balance: Math.round((map.get(member.user_id) || 0) * 100) / 100 }))
})
const myBalance = computed(() => balances.value.find(m => m.user_id === user.value?.id)?.balance || 0)
const totalOwedToMe = computed(() => Math.max(myBalance.value, 0))
const totalIOwe = computed(() => Math.max(-myBalance.value, 0))
const recentExpenses = computed(() => expenses.value.slice(0, 12))

async function refresh() {
  if (!community.value || !user.value) return
  loading.value = true
  error.value = ''
  const [memberResult, expenseResult, settlementResult] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', community.value),
    supabase.from('expenses').select('id,description,amount,paid_by,created_at').eq('group_id', community.value).order('created_at', { ascending: false }),
    supabase.from('settlements').select('id,payer_id,payee_id,amount,note,created_at').eq('group_id', community.value).order('created_at', { ascending: false })
  ])
  if (memberResult.error || expenseResult.error || settlementResult.error) {
    error.value = memberResult.error?.message || expenseResult.error?.message || settlementResult.error?.message || 'Não foi possível carregar as contas.'
    loading.value = false
    return
  }
  const memberRows = memberResult.data || []
  const memberIds = memberRows.map((m: any) => m.user_id)
  const { data: profileRows, error: profileError } = memberIds.length
    ? await supabase.from('profiles').select('id,display_name').in('id', memberIds)
    : { data: [], error: null }
  if (profileError) error.value = profileError.message
  members.value = memberRows.map((m: any) => ({ ...m, profile: (profileRows || []).find((p: any) => p.id === m.user_id) }))
  selectedParticipants.value = memberIds
  expenses.value = expenseResult.data || []
  settlements.value = settlementResult.data || []
  const expenseIds = expenses.value.map(e => e.id)
  if (expenseIds.length) {
    const { data, error: shareError } = await supabase.from('expense_shares').select('expense_id,user_id,amount_owed').in('expense_id', expenseIds)
    if (shareError) error.value = shareError.message
    shares.value = data || []
  } else shares.value = []
  loading.value = false
}

async function addExpense() {
  if (!community.value || !description.value.trim() || !amount.value || amount.value <= 0 || !user.value) return
  if (!selectedParticipants.value.includes(user.value.id)) {
    error.value = 'Tens de estar incluído na divisão, porque foste tu que pagaste.'
    return
  }
  loading.value = true; error.value = ''; success.value = ''
  const { error: rpcError } = await supabase.rpc('create_expense', {
    p_group: community.value,
    p_description: description.value.trim(),
    p_amount: amount.value,
    p_participants: selectedParticipants.value
  })
  loading.value = false
  if (rpcError) { error.value = rpcError.message; return }
  description.value = ''; amount.value = null; showExpenseForm.value = false
  success.value = 'Despesa adicionada e dividida com sucesso.'
  await refresh()
}

async function addSettlement() {
  if (!community.value || !user.value || !settlementPayee.value || !settlementAmount.value || settlementAmount.value <= 0) return
  loading.value = true; error.value = ''; success.value = ''
  const { error: insertError } = await supabase.from('settlements').insert({
    group_id: community.value,
    payer_id: user.value.id,
    payee_id: settlementPayee.value,
    amount: settlementAmount.value,
    note: 'Acerto de contas'
  })
  loading.value = false
  if (insertError) { error.value = insertError.message; return }
  settlementPayee.value = ''; settlementAmount.value = null; showSettlementForm.value = false
  success.value = 'Pagamento registado.'
  await refresh()
}

watch(community, refresh)
onMounted(refresh)
</script>

<template>
  <main class="min-h-screen bg-[#101014] text-[#f5f5f7]">
    <div class="mx-auto max-w-5xl space-y-7 p-5 pb-24 md:p-10">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <NuxtLink to="/" class="text-xs font-bold uppercase tracking-[.22em] text-violet-300">← Afterhours</NuxtLink>
          <p class="mt-5 text-xs font-bold uppercase tracking-[.2em] text-violet-300">Community finances</p>
          <h1 class="mt-2 text-4xl font-extrabold tracking-tight">The Tab<span class="text-violet-400">.</span></h1>
          <p class="mt-2 text-zinc-400">Contas claras. Amizades intactas.</p>
        </div>
        <div class="flex gap-2">
          <button class="btn" @click="showExpenseForm = !showExpenseForm">+ Despesa</button>
          <button class="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/5" @click="showSettlementForm = !showSettlementForm">Registar pagamento</button>
        </div>
      </header>

      <div v-if="!community" class="panel text-zinc-300">Escolhe ou cria uma comunidade na página inicial para consultares as contas.</div>
      <template v-else>
        <div class="grid gap-3 sm:grid-cols-3">
          <section class="panel"><p class="text-xs uppercase tracking-wider text-zinc-500">O teu saldo</p><p class="mt-2 text-3xl font-bold tabular-nums" :class="myBalance > 0 ? 'text-emerald-300' : myBalance < 0 ? 'text-rose-300' : 'text-white'">{{ money(myBalance) }}</p><p class="mt-1 text-xs text-zinc-500">{{ myBalance > 0 ? 'Tens a receber' : myBalance < 0 ? 'Tens a pagar' : 'Contas acertadas' }}</p></section>
          <section class="panel"><p class="text-xs uppercase tracking-wider text-zinc-500">Tens a receber</p><p class="mt-2 text-3xl font-bold text-emerald-300 tabular-nums">{{ money(totalOwedToMe) }}</p><p class="mt-1 text-xs text-zinc-500">Dos restantes membros</p></section>
          <section class="panel"><p class="text-xs uppercase tracking-wider text-zinc-500">Tens a pagar</p><p class="mt-2 text-3xl font-bold text-rose-300 tabular-nums">{{ money(totalIOwe) }}</p><p class="mt-1 text-xs text-zinc-500">Aos restantes membros</p></section>
        </div>

        <p v-if="error" role="alert" class="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{{ error }}</p>
        <p v-if="success" role="status" class="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{{ success }}</p>

        <section v-if="showExpenseForm" class="panel space-y-4">
          <div><h2 class="text-xl font-bold">Adicionar despesa</h2><p class="text-sm text-zinc-400">A despesa será dividida igualmente entre os participantes selecionados.</p></div>
          <form class="space-y-3" @submit.prevent="addExpense">
            <input v-model="description" class="input" maxlength="120" placeholder="Ex.: Jantar de sábado" required>
            <div class="grid gap-3 sm:grid-cols-2"><label class="space-y-1 text-sm text-zinc-400">Valor total (€)<input v-model.number="amount" class="input" type="number" min="0.01" max="1000000" step="0.01" placeholder="0,00" required></label><div class="space-y-1"><p class="text-sm text-zinc-400">Pagaste tu</p><div class="input text-zinc-300">{{ user?.email }}</div></div></div>
            <div class="space-y-2"><p class="text-sm font-semibold">Dividir entre</p><label v-for="member in members" :key="member.user_id" class="flex items-center gap-3 rounded-xl bg-white/[.03] px-3 py-2 text-sm"><input v-model="selectedParticipants" type="checkbox" :value="member.user_id" class="accent-violet-400" :disabled="member.user_id === user?.id"><span>{{ memberName(member.user_id) }} <span v-if="member.user_id === user?.id" class="text-zinc-500">(tu)</span></span></label></div>
            <p v-if="amount && selectedParticipants.length" class="text-sm text-violet-200">{{ money(amount / selectedParticipants.length) }} por pessoa (aproximadamente).</p>
            <div class="flex justify-end gap-2"><button type="button" class="rounded-xl px-4 py-2 text-sm text-zinc-400" @click="showExpenseForm = false">Cancelar</button><button class="btn" :disabled="loading">{{ loading ? 'A guardar...' : 'Guardar despesa' }}</button></div>
          </form>
        </section>

        <section v-if="showSettlementForm" class="panel space-y-4">
          <div><h2 class="text-xl font-bold">Registar pagamento</h2><p class="text-sm text-zinc-400">Regista quando pagas a outro membro para acertar uma dívida.</p></div>
          <form class="grid gap-3 sm:grid-cols-3" @submit.prevent="addSettlement">
            <label class="space-y-1 text-sm text-zinc-400 sm:col-span-1">Pagaste a<select v-model="settlementPayee" class="input" required><option value="" disabled>Escolher membro</option><option v-for="m in members.filter(m => m.user_id !== user?.id)" :key="m.user_id" :value="m.user_id">{{ memberName(m.user_id) }}</option></select></label>
            <label class="space-y-1 text-sm text-zinc-400">Valor (€)<input v-model.number="settlementAmount" class="input" type="number" min="0.01" step="0.01" required placeholder="0,00"></label>
            <div class="flex items-end"><button class="btn w-full" :disabled="loading">Confirmar pagamento</button></div>
          </form>
          <p class="text-xs text-amber-200/80">Este registo atualiza os saldos, mas não movimenta dinheiro nem confirma uma transferência bancária.</p>
        </section>

        <div class="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section class="panel space-y-4">
            <div class="flex items-center justify-between"><h2 class="text-lg font-bold">Saldo dos membros</h2><span class="text-xs text-zinc-500">{{ members.length }} membros</span></div>
            <div v-if="!members.length" class="text-sm text-zinc-500">Ainda não existem membros nesta comunidade.</div>
            <div v-for="member in balances" :key="member.user_id" class="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
              <div class="flex min-w-0 items-center gap-3"><div class="grid size-9 shrink-0 place-items-center rounded-full bg-violet-400/15 font-bold text-violet-200">{{ memberName(member.user_id).slice(0,1).toUpperCase() }}</div><div class="min-w-0"><p class="truncate text-sm font-medium">{{ memberName(member.user_id) }}</p><p class="text-xs text-zinc-500">{{ member.user_id === user?.id ? 'A tua conta' : member.balance > 0 ? 'Tem a receber' : member.balance < 0 ? 'Tem a pagar' : 'Tudo acertado' }}</p></div></div>
              <p class="shrink-0 text-sm font-semibold tabular-nums" :class="member.balance > 0 ? 'text-emerald-300' : member.balance < 0 ? 'text-rose-300' : 'text-zinc-400'">{{ money(member.balance) }}</p>
            </div>
          </section>
          <section class="panel space-y-4">
            <h2 class="text-lg font-bold">Despesas recentes</h2>
            <div v-if="!recentExpenses.length" class="text-sm text-zinc-500">Ainda não há despesas registadas.</div>
            <div v-for="expense in recentExpenses" :key="expense.id" class="flex items-start justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0"><div class="min-w-0"><p class="truncate text-sm font-medium">{{ expense.description }}</p><p class="mt-1 text-xs text-zinc-500">{{ memberName(expense.paid_by) }} pagou · {{ new Date(expense.created_at).toLocaleDateString('pt-PT') }}</p></div><p class="shrink-0 text-sm font-semibold tabular-nums">{{ money(Number(expense.amount)) }}</p></div>
          </section>
        </div>
      </template>
      <div v-if="loading" class="text-center text-xs text-zinc-500">A atualizar...</div>
      <footer class="flex justify-between text-xs text-zinc-600"><NuxtLink to="/" class="hover:text-violet-300">← Voltar ao feed</NuxtLink><span>AFTERHOURS · THE TAB</span></footer>
    </div>
  </main>
</template>
