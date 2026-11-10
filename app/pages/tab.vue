<script setup lang="ts">
import { Plus, ArrowRight, Share2, BellRing, Trash2, Receipt, HandCoins, Check } from 'lucide-vue-next'
import type { Transfer } from '~/utils/settle'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const me = useMe()
const route = useRoute()
const router = useRouter()
const community = useCommunity()
const crew = useCrew()
const ledger = useLedger()
const toast = useToast()

const myId = computed(() => me.value?.id || '')
const others = computed(() => ledger.transfers.value.filter(t => t.from !== myId.value && t.to !== myId.value))
const totalSpent = computed(() => ledger.expenses.value.reduce((s, e) => s + Number(e.amount), 0))
const history = computed(() => [
  ...ledger.expenses.value.map(e => ({ kind: 'expense' as const, id: e.id, at: e.created_at, row: e })),
  ...ledger.settlements.value.map(s => ({ kind: 'settlement' as const, id: s.id, at: s.created_at, row: s })),
].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 40))
const splitCount = (id: string) => ledger.shares.value.filter(s => s.expense_id === id).length

async function markPaid(t: Transfer, e: MouseEvent) {
  const sentence = t.from === myId.value ? `pagaste ${euros(t.amount)} a ${crew.nameOf(t.to)}` : `${crew.nameOf(t.from)} te pagou ${euros(t.amount)}`
  if (!confirm(`Confirmas que ${sentence}?`)) return
  const { error } = await supabase.from('settlements').insert({ group_id: community.value, payer_id: t.from, payee_id: t.to, amount: t.amount, note: 'Acerto' })
  if (error) return toast.error(error.message)
  celebrate(originFrom(e))
  toast.ok('Contas acertadas!')
  ledger.load()
}
async function remove(kind: 'expense' | 'settlement', id: string) {
  if (!confirm(kind === 'expense' ? 'Apagar esta despesa?' : 'Apagar este pagamento?')) return
  const { error } = await supabase.from(kind === 'expense' ? 'expenses' : 'settlements').delete().eq('id', id)
  if (error) return toast.error(error.message)
  ledger.load()
}
function shareSummary() {
  const t = ledger.transfers.value
  shareOut(t.length ? ['🧾 The Tab — quem paga a quem:', ...t.map(x => `• ${crew.nameOf(x.from).replace(/^Tu$/, 'Eu')} → ${crew.nameOf(x.to).replace(/^Tu$/, 'mim')}: ${euros(x.amount)}`)].join('\n') : '🧾 The Tab: está tudo acertado 🙌', '/tab')
}
async function remind() {
  const { data, error } = await supabase.rpc('discord_send_tab_reminder', { p_group: community.value })
  if (error) return toast.error(error.message)
  data ? toast.ok('Lembrete enviado para o Discord') : toast.error('Discord não está ligado (dono liga em Malta).')
}

// ── new expense ─────────────────────────────────────────
const adding = ref(false)
const desc = ref('')
const amount = ref<number | null>(null)
const paidBy = ref('')
const who = ref<string[]>([])
const saving = ref(false)
const presets = ['Jantar', 'Finos', 'Gasolina', 'Uber', 'Supermercado', 'Bilhetes']
const each = computed(() => amount.value && who.value.length ? amount.value / who.value.length : 0)
function openAdd() {
  desc.value = ''; amount.value = null; paidBy.value = myId.value
  who.value = crew.members.value.map(m => m.user_id); adding.value = true
}
function toggleWho(id: string) { who.value = who.value.includes(id) ? who.value.filter(x => x !== id) : [...who.value, id] }
async function addExpense(e: MouseEvent) {
  if (!desc.value.trim() || !amount.value || amount.value <= 0 || !who.value.length) return
  saving.value = true
  const { error } = await supabase.rpc('create_expense', { p_group: community.value, p_description: desc.value.trim(), p_amount: amount.value, p_participants: who.value, p_paid_by: paidBy.value })
  saving.value = false
  if (error) return toast.error(error.message)
  adding.value = false
  celebrate(originFrom(e))
  toast.ok('Despesa registada')
  ledger.load()
}

watch(() => route.query.new, (n) => { if (n) { router.replace({ query: {} }); afterPageEnter(() => { if (crew.members.value.length) openAdd(); else watch(() => crew.members.value.length, (l) => l && openAdd(), { once: true }) }) } }, { immediate: true })
watch(community, () => ledger.load())
onMounted(() => ledger.load())
</script>

<template>
  <div class="tab">
    <header class="page-head">
      <div>
        <p class="kicker">The Tab</p>
        <h1 class="display h-xl">Contas<br>claras<span class="t-lime">.</span></h1>
      </div>
      <button class="btn btn-primary" @click="openAdd"><Plus :size="18" /> Despesa</button>
    </header>

    <!-- hero balance -->
    <section class="balance sticker" :class="ledger.myBalance.value < -0.004 ? 'fill-coral' : ledger.myBalance.value > 0.004 ? 'fill-lime' : 'fill-paper'">
      <p class="kicker balance-k">{{ ledger.myBalance.value < -0.004 ? 'Tu deves' : ledger.myBalance.value > 0.004 ? 'Tens a receber' : 'O teu saldo' }}</p>
      <p class="display balance-n num">{{ euros(Math.abs(ledger.myBalance.value)) }}</p>
      <p class="balance-sub">{{ ledger.myBalance.value < -0.004 ? 'Paga antes que alguém te lembre no Discord.' : ledger.myBalance.value > 0.004 ? 'A malta deve-te. Cobra com estilo.' : 'Limpo como um lençol lavado.' }}</p>
      <div class="flex gap-2 mt-4">
        <button class="btn btn-sm btn-inkish" @click="shareSummary"><Share2 :size="15" /> Partilhar</button>
        <button class="btn btn-sm btn-inkish" @click="remind"><BellRing :size="15" /> Lembrar no Discord</button>
      </div>
    </section>

    <!-- my debts as tickets -->
    <section v-if="ledger.myTransfers.value.length" class="flex flex-col gap-3">
      <h2 class="kicker m-0">Contigo</h2>
      <TransitionGroup name="list" tag="div" class="flex flex-col gap-3 relative">
        <div v-for="t in ledger.myTransfers.value" :key="t.from + t.to" class="ticket" :class="t.from === myId ? 'owe' : 'get'">
          <Avatar :name="crew.nameOf(t.from === myId ? t.to : t.from)" :color="crew.colorOf(t.from === myId ? t.to : t.from)" :size="44" />
          <div class="flex-1 min-w-0">
            <strong class="block truncate">{{ t.from === myId ? `Pagas a ${crew.nameOf(t.to)}` : `${crew.nameOf(t.from)} paga-te` }}</strong>
            <span class="num ticket-n">{{ euros(t.amount) }}</span>
          </div>
          <button class="btn btn-sm" :class="t.from === myId ? 'btn-danger' : 'btn-primary'" @click="markPaid(t, $event)"><Check :size="15" /> {{ t.from === myId ? 'Paguei' : 'Recebi' }}</button>
        </div>
      </TransitionGroup>
    </section>

    <!-- rest of the group -->
    <section class="panel p-4">
      <div class="flex items-center justify-between mb-3"><h2 class="display h-md m-0">A malta</h2><span class="faint text-sm">{{ euros(totalSpent) }} gastos no total</span></div>
      <div class="flex flex-col">
        <div v-for="m in [...crew.members.value].sort((a, b) => (ledger.balances.value[a.user_id] || 0) - (ledger.balances.value[b.user_id] || 0))" :key="m.user_id" class="bal-row">
          <Avatar :name="m.name" :color="m.color" :size="34" />
          <span class="flex-1 font-semibold truncate">{{ crew.nameOf(m.user_id) }}
            <span v-if="ledger.topDebtor.value === m.user_id" class="tag fill-coral ml-1">Caloteiro-mor</span>
          </span>
          <span class="num" :class="(ledger.balances.value[m.user_id] || 0) > 0.004 ? 't-lime' : (ledger.balances.value[m.user_id] || 0) < -0.004 ? 't-coral' : 'faint'">{{ euros(ledger.balances.value[m.user_id] || 0) }}</span>
        </div>
      </div>
      <template v-if="others.length">
        <hr class="divider my-3">
        <p class="kicker m-0 mb-2">Entre os outros</p>
        <p v-for="t in others" :key="t.from + t.to" class="other-line"><b>{{ crew.nameOf(t.from) }}</b> <ArrowRight :size="13" class="inline" /> <b>{{ crew.nameOf(t.to) }}</b> <span class="num ml-auto">{{ euros(t.amount) }}</span></p>
      </template>
    </section>

    <!-- history -->
    <section>
      <h2 class="display h-md">Histórico</h2>
      <div v-if="!history.length" class="empty"><p class="display">Nada registado.</p><p class="muted m-0">Quem pagou o último jantar?</p></div>
      <TransitionGroup name="list" tag="div" class="flex flex-col relative">
        <div v-for="h in history" :key="h.kind + h.id" class="hist">
          <span class="hist-icon" :class="h.kind === 'expense' ? 'fill-paper' : 'fill-mint'"><Receipt v-if="h.kind === 'expense'" :size="16" /><HandCoins v-else :size="16" /></span>
          <div class="flex-1 min-w-0">
            <strong class="block truncate">{{ h.kind === 'expense' ? h.row.description : `${crew.nameOf(h.row.payer_id)} pagou a ${crew.nameOf(h.row.payee_id)}` }}</strong>
            <small class="faint">{{ h.kind === 'expense' ? `${crew.nameOf(h.row.paid_by)} pagou · ÷${splitCount(h.id)}` : 'Acerto' }} · {{ ago(h.at) }}</small>
          </div>
          <span class="num">{{ euros(Number(h.row.amount)) }}</span>
          <button v-if="h.row.created_by === myId || h.row.paid_by === myId" class="icon-btn icon-sm" aria-label="Apagar" @click="remove(h.kind, h.id)"><Trash2 :size="14" /></button>
        </div>
      </TransitionGroup>
    </section>

    <Sheet :open="adding" kicker="The Tab" title="Nova despesa" @close="adding = false">
      <div class="flex flex-col gap-5">
        <div class="amount-wrap">
          <input v-model.number="amount" class="amount" :style="{ width: (String(amount ?? 0).length + .4) + 'ch' }" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0" aria-label="Valor">
          <span class="amount-eur display">€</span>
        </div>
        <div>
          <input v-model="desc" class="field" maxlength="120" placeholder="Em quê?">
          <div class="flex gap-2 flex-wrap mt-2"><button v-for="p in presets" :key="p" class="chip" :class="{ on: desc === p }" @click="desc = p">{{ p }}</button></div>
        </div>
        <div>
          <span class="label">Quem pagou</span>
          <div class="people">
            <button v-for="m in crew.members.value" :key="m.user_id" class="person" :class="{ on: paidBy === m.user_id }" @click="paidBy = m.user_id">
              <Avatar :name="crew.nameOf(m.user_id)" :color="m.color" :size="40" /><small>{{ crew.nameOf(m.user_id) }}</small>
            </button>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between"><span class="label">Dividir por</span><button class="text-sm font-bold t-lime" @click="who = who.length === crew.members.value.length ? [] : crew.members.value.map(m => m.user_id)">{{ who.length === crew.members.value.length ? 'Ninguém' : 'Todos' }}</button></div>
          <div class="people">
            <button v-for="m in crew.members.value" :key="m.user_id" class="person" :class="{ on: who.includes(m.user_id) }" @click="toggleWho(m.user_id)">
              <Avatar :name="crew.nameOf(m.user_id)" :color="m.color" :size="40" /><small>{{ crew.nameOf(m.user_id) }}</small>
            </button>
          </div>
        </div>
        <p v-if="each" class="each"><span class="num text-2xl">{{ euros(each) }}</span> <span class="muted">por pessoa</span></p>
        <button class="btn btn-primary btn-block" :disabled="saving || !desc.trim() || !amount || !who.length" @click="addExpense">{{ saving ? 'A guardar…' : 'Registar' }}</button>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.tab { display: flex; flex-direction: column; gap: 22px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-top: 8px; }
.page-head h1 { margin: 4px 0 0; }
.fill-paper { background: var(--paper); color: var(--on-color); }
.balance { padding: 22px; transform: rotate(-1deg); animation: pop-in var(--slow) var(--ease-spring) both; }
.balance-k { color: #0c0c0ea6; }
.balance-n { margin: 6px 0 0; font-size: clamp(54px, 17vw, 84px); }
.balance-sub { margin: 6px 0 0; font-weight: 600; opacity: .75; }
.btn-inkish { background: var(--ink); color: var(--paper); border-color: #000; }
.ticket { display: flex; align-items: center; gap: 12px; padding: 14px; border: 2px solid #000; border-radius: var(--r-md); background: var(--ink-2); box-shadow: 4px 4px 0 #000; }
.ticket.owe { box-shadow: 4px 4px 0 var(--coral); }
.ticket.get { box-shadow: 4px 4px 0 var(--lime); }
.ticket-n { font-size: 26px; }
.ticket.owe .ticket-n { color: var(--coral); }
.ticket.get .ticket-n { color: var(--lime); }
.bal-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; }
.other-line { display: flex; align-items: center; gap: 6px; margin: 6px 0; font-size: 14px; }
.hist { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1.5px solid var(--line); }
.hist-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border: 2px solid #000; border-radius: 12px; }
.icon-sm { width: 32px; height: 32px; border-color: transparent; background: transparent; color: var(--faint); }
.amount-wrap { display: flex; align-items: baseline; justify-content: center; gap: 6px; }
.amount { min-width: 1.4ch; max-width: 80%; border: 0; background: transparent; color: var(--paper); text-align: right; font-family: var(--font-display); font-size: 72px; font-weight: 800; letter-spacing: -.04em; outline: 0; -moz-appearance: textfield; }
.amount::-webkit-outer-spin-button, .amount::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.amount::placeholder { color: var(--line-strong); }
.amount-eur { font-size: 48px; color: var(--lime); }
.people { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 6px; scrollbar-width: none; }
.person { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 64px; flex: none; padding: 6px 0; border: 0; border-radius: 14px; background: none; opacity: .4; transition: opacity var(--fast), transform var(--fast) var(--ease-spring); }
.person small { max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 12px; }
.person.on { opacity: 1; transform: translateY(-2px); }
.person.on :deep(.av) { box-shadow: 0 0 0 2.5px var(--ink-2), 0 0 0 4.5px var(--lime); }
.each { margin: 0; text-align: center; }
</style>
