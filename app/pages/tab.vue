<script setup lang="ts">
import { Wallet, Plus, ArrowRight, Check, Share2, Trash2, X, LoaderCircle, BellRing, Receipt, HandCoins } from 'lucide-vue-next'
import type { Transfer } from '~/utils/settle'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const user = useMe()
const community = useCommunity()

const members = ref<{ user_id: string; name: string }[]>([])
const expenses = ref<any[]>([])
const shares = ref<any[]>([])
const settlements = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const hasDiscord = ref(false)

// expense form
const showExpense = ref(false)
const description = ref('')
const amount = ref<number | null>(null)
const paidBy = ref('')
const participants = ref<string[]>([])

const me = computed(() => user.value?.id || '')
const nameOf = (id: string) => id === me.value ? 'Tu' : (members.value.find(m => m.user_id === id)?.name || 'Ex-membro')

const balanceMap = computed(() => {
  const map: Record<string, number> = {}
  for (const m of members.value) map[m.user_id] = 0
  for (const e of expenses.value) map[e.paid_by] = (map[e.paid_by] || 0) + Number(e.amount)
  for (const s of shares.value) map[s.user_id] = (map[s.user_id] || 0) - Number(s.amount_owed)
  for (const s of settlements.value) {
    map[s.payer_id] = (map[s.payer_id] || 0) + Number(s.amount)
    map[s.payee_id] = (map[s.payee_id] || 0) - Number(s.amount)
  }
  return map
})
const myBalance = computed(() => Math.round((balanceMap.value[me.value] || 0) * 100) / 100)
const transfers = computed(() => simplifyDebts(balanceMap.value))
const myTransfers = computed(() => transfers.value.filter(t => t.from === me.value || t.to === me.value))
const otherTransfers = computed(() => transfers.value.filter(t => t.from !== me.value && t.to !== me.value))
const totalOpen = computed(() => transfers.value.reduce((sum, t) => sum + t.amount, 0))

const history = computed(() => {
  const rows = [
    ...expenses.value.map(e => ({ kind: 'expense' as const, id: e.id, at: e.created_at, row: e })),
    ...settlements.value.map(s => ({ kind: 'settlement' as const, id: s.id, at: s.created_at, row: s })),
  ]
  return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 30)
})
const sharesOf = (expenseId: string) => shares.value.filter(s => s.expense_id === expenseId)
const canDelete = (row: any) => row.created_by === me.value || row.paid_by === me.value

const perPerson = computed(() => amount.value && participants.value.length ? amount.value / participants.value.length : 0)

async function refresh() {
  if (!community.value || !me.value) return
  loading.value = true; error.value = ''
  const [memberRes, expenseRes, settlementRes, integrationRes] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', community.value),
    supabase.from('expenses').select('id,description,amount,paid_by,created_by,created_at').eq('group_id', community.value).order('created_at', { ascending: false }),
    supabase.from('settlements').select('id,payer_id,payee_id,amount,note,created_by,created_at').eq('group_id', community.value).order('created_at', { ascending: false }),
    supabase.from('group_integrations').select('discord_webhook_url').eq('group_id', community.value).maybeSingle(),
  ])
  const firstError = memberRes.error || expenseRes.error || settlementRes.error
  if (firstError) { error.value = firstError.message; loading.value = false; return }

  const ids = (memberRes.data || []).map((m: any) => m.user_id)
  const { data: people } = ids.length ? await supabase.from('profiles').select('id,display_name').in('id', ids) : { data: [] as any[] }
  members.value = ids.map((id: string) => ({ user_id: id, name: people?.find((p: any) => p.id === id)?.display_name || 'Membro' }))
  expenses.value = expenseRes.data || []
  settlements.value = settlementRes.data || []
  // RLS: only the owner can read the integration row; a member just won't see it.
  hasDiscord.value = !!integrationRes.data?.discord_webhook_url

  const expenseIds = expenses.value.map(e => e.id)
  if (expenseIds.length) {
    const { data, error: e } = await supabase.from('expense_shares').select('expense_id,user_id,amount_owed').in('expense_id', expenseIds)
    if (e) error.value = e.message
    shares.value = data || []
  } else shares.value = []
  loading.value = false
}

function openExpense() {
  description.value = ''; amount.value = null
  paidBy.value = me.value
  participants.value = members.value.map(m => m.user_id)
  showExpense.value = true; error.value = ''; success.value = ''
}
function toggleAll() {
  participants.value = participants.value.length === members.value.length ? [] : members.value.map(m => m.user_id)
}

async function addExpense() {
  if (!community.value || !description.value.trim() || !amount.value || amount.value <= 0) return
  if (!participants.value.length) { error.value = 'Escolhe pelo menos uma pessoa para dividir.'; return }
  saving.value = true; error.value = ''
  const { error: e } = await supabase.rpc('create_expense', {
    p_group: community.value,
    p_description: description.value.trim(),
    p_amount: amount.value,
    p_participants: participants.value,
    p_paid_by: paidBy.value || me.value,
  })
  saving.value = false
  if (e) { error.value = e.message; return }
  showExpense.value = false
  success.value = 'Despesa registada.'
  await refresh()
}

async function markPaid(t: Transfer) {
  const who = t.from === me.value ? `pagaste ${euros(t.amount)} a ${nameOf(t.to)}` : `${nameOf(t.from)} te pagou ${euros(t.amount)}`
  if (!confirm(`Confirmas que ${who}?`)) return
  saving.value = true; error.value = ''; success.value = ''
  const { error: e } = await supabase.from('settlements').insert({
    group_id: community.value, payer_id: t.from, payee_id: t.to, amount: t.amount, note: 'Acerto de contas',
  })
  saving.value = false
  if (e) { error.value = e.message; return }
  success.value = 'Pagamento registado. 🤝'
  await refresh()
}

async function removeRow(kind: 'expense' | 'settlement', id: string) {
  if (!confirm(kind === 'expense' ? 'Apagar esta despesa? Os saldos são recalculados.' : 'Apagar este pagamento?')) return
  const { error: e } = await supabase.from(kind === 'expense' ? 'expenses' : 'settlements').delete().eq('id', id)
  if (e) { error.value = e.message; return }
  await refresh()
}

function summaryText() {
  if (!transfers.value.length) return '🧾 The Tab: está tudo acertado! 🙌'
  return ['🧾 The Tab — quem deve a quem:', ...transfers.value.map(t => `• ${nameOf(t.from).replace('Tu', 'Eu')} → ${nameOf(t.to).replace('Tu', 'mim')}: ${euros(t.amount)}`)].join('\n')
}
async function shareSummary() { await shareOut(summaryText(), '/tab') }
async function remindDiscord() {
  const { data, error: e } = await supabase.rpc('discord_send_tab_reminder', { p_group: community.value })
  if (e) { error.value = e.message; return }
  success.value = data ? 'Lembrete enviado para o Discord. 😈' : 'Esta comunidade ainda não tem Discord ligado (o dono liga em Membros).'
}

watch([community, me], refresh)
onMounted(refresh)
</script>

<template>
  <div class="content-page">
    <header class="content-header">
      <div>
        <span class="eyebrow"><Wallet :size="13"/> CONTAS DO GRUPO</span>
        <h1>The Tab<span class="accent-dot">.</span></h1>
        <p>Contas claras. Amizades intactas.</p>
      </div>
      <div class="flex gap-2">
        <button class="secondary-button flex items-center gap-2" :disabled="!community" @click="shareSummary"><Share2 :size="14"/> Partilhar</button>
        <button class="primary-button" :disabled="!community" @click="openExpense"><Plus :size="15"/> Despesa</button>
      </div>
    </header>

    <div v-if="!community" class="surface-card empty-inline">Cria ou entra numa comunidade para usares o The Tab.</div>
    <template v-else>
      <p v-if="error" class="notice error-notice">{{ error }}</p>
      <p v-if="success" class="notice success-notice">{{ success }}</p>

      <div class="stat-grid">
        <div class="stat-card hero-balance" :class="myBalance > 0 ? 'pos' : myBalance < 0 ? 'neg' : ''">
          <span>O teu saldo</span>
          <strong>{{ euros(myBalance) }}</strong>
          <small>{{ myBalance > 0 ? 'Tens a receber' : myBalance < 0 ? 'Tens a pagar' : 'Estás em dia ✨' }}</small>
        </div>
        <div class="stat-card"><span>Em aberto no grupo</span><strong>{{ euros(totalOpen) }}</strong><small>{{ transfers.length }} {{ transfers.length === 1 ? 'pagamento pendente' : 'pagamentos pendentes' }}</small></div>
        <div class="stat-card"><span>Despesas registadas</span><strong>{{ expenses.length }}</strong><small>{{ euros(expenses.reduce((s, e) => s + Number(e.amount), 0)) }} no total</small></div>
      </div>

      <div class="tab-grid">
        <section class="surface-card">
          <div class="section-head mb-3">
            <h2 class="surface-title !mb-0">Quem paga a quem</h2>
            <button class="secondary-button flex items-center gap-2" title="Envia o resumo das dívidas para o canal do Discord" @click="remindDiscord"><BellRing :size="13"/> Lembrar no Discord</button>
          </div>
          <p class="text-muted text-[11px] mb-3">Calculado com o mínimo de transferências possível.</p>

          <div v-if="loading && !members.length" class="loading-state"><LoaderCircle class="spin"/> A carregar…</div>
          <div v-else-if="!transfers.length" class="empty-inline">🙌 Ninguém deve nada a ninguém.</div>

          <div class="stack-list">
            <div v-for="t in myTransfers" :key="t.from + t.to" class="transfer-row mine">
              <span class="avatar avatar-tiny">{{ nameOf(t.from).slice(0,1) }}</span>
              <div class="transfer-main">
                <strong>{{ nameOf(t.from) }} <ArrowRight :size="12" class="inline"/> {{ nameOf(t.to) }}</strong>
                <small>{{ t.from === me ? 'Tens de pagar' : 'Tens a receber' }}</small>
              </div>
              <strong class="transfer-amount" :class="t.from === me ? 'neg' : 'pos'">{{ euros(t.amount) }}</strong>
              <button class="icon-button" :disabled="saving" title="Marcar como pago" @click="markPaid(t)"><Check :size="15"/></button>
            </div>
            <div v-for="t in otherTransfers" :key="t.from + t.to" class="transfer-row">
              <span class="avatar avatar-tiny">{{ nameOf(t.from).slice(0,1) }}</span>
              <div class="transfer-main"><strong>{{ nameOf(t.from) }} <ArrowRight :size="12" class="inline"/> {{ nameOf(t.to) }}</strong></div>
              <strong class="transfer-amount">{{ euros(t.amount) }}</strong>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <h2 class="surface-title">Saldos</h2>
          <div class="stack-list">
            <div v-for="m in [...members].sort((a, b) => (balanceMap[b.user_id] || 0) - (balanceMap[a.user_id] || 0))" :key="m.user_id" class="balance-row">
              <span class="avatar avatar-tiny">{{ m.name.slice(0,1).toUpperCase() }}</span>
              <span class="flex-1 truncate">{{ nameOf(m.user_id) }}</span>
              <span class="tabular-nums font-semibold" :class="(balanceMap[m.user_id] || 0) > 0.004 ? 'pos' : (balanceMap[m.user_id] || 0) < -0.004 ? 'neg' : 'text-muted'">{{ euros(balanceMap[m.user_id] || 0) }}</span>
            </div>
          </div>
        </section>
      </div>

      <section class="surface-card mt-4">
        <h2 class="surface-title">Histórico</h2>
        <div v-if="!history.length" class="empty-inline">Ainda não há movimentos. Quem pagou o último jantar? 👀</div>
        <div class="stack-list">
          <div v-for="h in history" :key="h.kind + h.id" class="list-row">
            <span class="quick-icon" :class="h.kind === 'expense' ? 'purple' : 'green'"><Receipt v-if="h.kind === 'expense'" :size="15"/><HandCoins v-else :size="15"/></span>
            <div class="list-row-main">
              <template v-if="h.kind === 'expense'">
                <strong>{{ h.row.description }}</strong>
                <small>{{ nameOf(h.row.paid_by) }} pagou · dividido por {{ sharesOf(h.id).length }} · {{ new Date(h.at).toLocaleDateString('pt-PT') }}</small>
              </template>
              <template v-else>
                <strong>{{ nameOf(h.row.payer_id) }} pagou a {{ nameOf(h.row.payee_id) }}</strong>
                <small>Acerto · {{ new Date(h.at).toLocaleDateString('pt-PT') }}</small>
              </template>
            </div>
            <strong class="tabular-nums text-[12px]">{{ euros(Number(h.row.amount)) }}</strong>
            <button v-if="canDelete(h.row)" class="icon-button small" title="Apagar" @click="removeRow(h.kind, h.id)"><Trash2 :size="13"/></button>
          </div>
        </div>
      </section>
    </template>

    <div v-if="showExpense" class="modal-backdrop" @click.self="showExpense = false">
      <section class="modal-card">
        <div class="modal-heading"><div><span class="eyebrow">NOVA DESPESA</span><h2>Quem pagou o quê?</h2></div><button class="icon-button" @click="showExpense = false"><X :size="18"/></button></div>
        <form class="stack-form flex flex-col gap-3" @submit.prevent="addExpense">
          <label>Descrição<input v-model="description" class="field" maxlength="120" placeholder="Jantar de sábado, gasolina, Steam sale…" required></label>
          <div class="form-grid">
            <label>Valor total (€)<input v-model.number="amount" class="field" type="number" inputmode="decimal" min="0.01" max="1000000" step="0.01" placeholder="0,00" required></label>
            <label>Quem pagou<select v-model="paidBy" class="field"><option v-for="m in members" :key="m.user_id" :value="m.user_id">{{ nameOf(m.user_id) }}</option></select></label>
          </div>
          <div>
            <div class="flex items-center justify-between"><span class="text-[10px] font-bold text-[#a7adbc]">Dividir entre</span><button type="button" class="text-link" @click="toggleAll">{{ participants.length === members.length ? 'Ninguém' : 'Todos' }}</button></div>
            <div class="chip-grid">
              <label v-for="m in members" :key="m.user_id" class="person-chip" :class="{ on: participants.includes(m.user_id) }">
                <input v-model="participants" type="checkbox" :value="m.user_id" class="sr-only">{{ nameOf(m.user_id) }}
              </label>
            </div>
          </div>
          <p v-if="perPerson" class="text-[11px] text-[#c5b7ff]">≈ {{ euros(perPerson) }} por pessoa</p>
          <p v-if="error" class="form-error">{{ error }}</p>
          <button class="primary-button" :disabled="saving">{{ saving ? 'A guardar…' : 'Guardar despesa' }}</button>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tab-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px;margin-top:14px}
.stat-card small{display:block;margin-top:5px;color:#747c8e;font-size:10px}
.hero-balance.pos strong,.pos{color:#7ce0b5}
.hero-balance.neg strong,.neg{color:#fda4af}
.transfer-row,.balance-row{display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:#151821;font-size:12px}
.transfer-row.mine{border-color:#9b83ff40;background:#9b83ff0c}
.transfer-main{flex:1;min-width:0}
.transfer-main strong{display:block;font-size:12px}
.transfer-main small{display:block;margin-top:3px;color:#8b92a2;font-size:10px}
.transfer-amount{font-variant-numeric:tabular-nums;font-size:13px}
.chip-grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.person-chip{padding:7px 11px;border:1px solid var(--line);border-radius:99px;color:#8a90a1;font-size:11px;cursor:pointer;user-select:none}
.person-chip.on{border-color:#9b83ff66;background:#9b83ff1c;color:#d4caff}
.modal-card .field{font-size:16px}
@media(max-width:800px){.tab-grid{grid-template-columns:1fr}}
</style>
