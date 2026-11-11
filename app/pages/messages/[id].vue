<script setup lang="ts">
import { ChevronLeft, Send } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const supabase = useSupabaseClient()
const me = useMe()
const toast = useToast()
const dms = useDMs()

const other = computed(() => String(route.params.id || ''))
const who = ref<{ name: string; color: string } | null>(null)
const canMessage = ref(true)
const rows = ref<(DM & { pending?: boolean })[]>([])
const loaded = ref(false)
const text = ref('')
const sending = ref(false)
const input = ref<HTMLTextAreaElement | null>(null)

useHead(() => ({ title: `${who.value?.name || 'Mensagens'} · Afterhours` }))

function scrollDown(smooth = false) {
  nextTick(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }))
}

async function load() {
  const uid = me.value?.id
  if (!uid || !other.value) return
  const [msgs, contacts, can] = await Promise.all([
    supabase.from('direct_messages').select('*')
      .or(`and(sender_id.eq.${uid},recipient_id.eq.${other.value}),and(sender_id.eq.${other.value},recipient_id.eq.${uid})`)
      .order('created_at', { ascending: false }).limit(200),
    supabase.rpc('dm_contacts'),
    supabase.rpc('can_message', { p_other: other.value }),
  ])
  rows.value = ((msgs.data || []) as DM[]).reverse()
  const c = ((contacts.data || []) as any[]).find(x => x.user_id === other.value)
  if (c) who.value = { name: c.name, color: c.color }
  else {
    const { data } = await supabase.rpc('dm_threads')
    const t = ((data || []) as any[]).find(x => x.other_id === other.value)
    who.value = t ? { name: t.name, color: t.color } : { name: 'Alguém', color: 'lime' }
  }
  canMessage.value = can.data === true
  loaded.value = true
  scrollDown()
  if (rows.value.some(r => r.recipient_id === uid && !r.read_at)) dms.markRead(other.value)
}

async function send() {
  const body = text.value.trim()
  if (!body || !me.value || sending.value) return
  sending.value = true
  const temp = { id: `tmp-${Date.now()}`, sender_id: me.value.id, recipient_id: other.value, body, created_at: new Date().toISOString(), read_at: null, pending: true }
  rows.value.push(temp)
  text.value = ''
  scrollDown(true)
  const { data, error } = await supabase.from('direct_messages').insert({ recipient_id: other.value, body }).select('*').single()
  sending.value = false
  if (error) {
    rows.value = rows.value.filter(r => r.id !== temp.id)
    text.value = body
    return toast.error(error.message.includes('row-level security') ? 'Já não partilham nenhuma comunidade.' : error.message)
  }
  // realtime may have delivered it already
  rows.value = rows.value.filter(r => r.id !== temp.id && r.id !== (data as DM).id)
  rows.value.push(data as DM)
  input.value?.focus()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !(e as any).isComposing && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); send() }
}

const off = dms.onMessage((m, kind) => {
  const pair = [m.sender_id, m.recipient_id]
  if (!pair.includes(other.value)) return
  if (kind === 'DELETE') { rows.value = rows.value.filter(r => r.id !== m.id); return }
  const i = rows.value.findIndex(r => r.id === m.id)
  if (i >= 0) rows.value[i] = m
  else if (kind === 'INSERT' && !rows.value.some(r => r.pending && r.body === m.body)) {
    rows.value.push(m)
    scrollDown(true)
    if (m.recipient_id === me.value?.id) dms.markRead(other.value)
  }
})

// grouping: day separators + consecutive bubbles from the same person
const items = computed(() => {
  const out: ({ kind: 'day'; key: string; label: string } | { kind: 'msg'; m: DM & { pending?: boolean }; mine: boolean; first: boolean; last: boolean })[] = []
  let lastDay = ''
  rows.value.forEach((m, i) => {
    const day = dayKey(new Date(m.created_at))
    if (day !== lastDay) { out.push({ kind: 'day', key: `d-${day}`, label: dayLabel(day) }); lastDay = day }
    const prev = rows.value[i - 1], next = rows.value[i + 1]
    const near = (a?: DM, b?: DM) => !!a && !!b && a.sender_id === b.sender_id && Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 5 * 60000 && dayKey(new Date(a.created_at)) === dayKey(new Date(b.created_at))
    out.push({ kind: 'msg', m, mine: m.sender_id === me.value?.id, first: !near(prev, m), last: !near(m, next) })
  })
  return out
})
const lastMineId = computed(() => [...rows.value].reverse().find(r => r.sender_id === me.value?.id)?.id)
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

watch(other, () => { rows.value = []; loaded.value = false; dms.openWith.value = other.value; load() })
onMounted(() => {
  if (!/^[0-9a-f-]{36}$/i.test(other.value)) return showError({ statusCode: 404, statusMessage: 'Conversa não encontrada' })
  dms.openWith.value = other.value; load()
})
onBeforeUnmount(() => { off(); dms.openWith.value = null })
</script>

<template>
  <div class="chat">
    <header class="chat-head">
      <NuxtLink to="/messages" class="icon-btn" aria-label="Voltar"><ChevronLeft :size="20" /></NuxtLink>
      <Avatar v-if="who" :name="who.name" :color="who.color" :size="40" />
      <strong class="truncate text-lg">{{ who?.name || '…' }}</strong>
    </header>

    <div v-if="!loaded" class="flex flex-col gap-2 pt-4">
      <div class="skeleton self-start" style="height:38px;width:55%" />
      <div class="skeleton self-end" style="height:38px;width:40%" />
      <div class="skeleton self-start" style="height:38px;width:62%" />
    </div>

    <div v-else class="msgs">
      <div v-if="!rows.length" class="hello">
        <Avatar v-if="who" :name="who.name" :color="who.color" :size="76" />
        <p class="display h-md m-0 mt-3">{{ who?.name }}</p>
        <p class="muted m-0">Diz olá 👋 Só vocês os dois veem isto.</p>
      </div>
      <template v-for="it in items" :key="it.kind === 'day' ? it.key : it.m.id">
        <p v-if="it.kind === 'day'" class="day">{{ it.label }}</p>
        <div v-else class="row" :class="{ mine: it.mine, first: it.first, last: it.last }">
          <div class="bubble" :class="{ pending: it.m.pending }">
            <span class="txt">{{ it.m.body }}</span>
            <small v-if="it.last" class="t">{{ time(it.m.created_at) }}</small>
          </div>
          <small v-if="it.mine && it.m.id === lastMineId && it.m.read_at" class="seen">Visto</small>
        </div>
      </template>
    </div>

    <form v-if="loaded && canMessage" class="composer" @submit.prevent="send">
      <textarea ref="input" v-model="text" rows="1" maxlength="2000" placeholder="Mensagem…" enterkeyhint="send" @keydown="onKey" />
      <button class="send" :disabled="!text.trim()" aria-label="Enviar"><Send :size="18" /></button>
    </form>
    <p v-else-if="loaded" class="muted text-center composer-off">Já não estão na mesma comunidade, por isso não dá para responder.</p>
  </div>
</template>

<style scoped>
.chat { display: flex; flex-direction: column; min-height: 60vh; padding-bottom: 76px; }
.chat-head { position: sticky; top: calc(max(12px, env(safe-area-inset-top) + 6px) + 54px); z-index: 20; display: flex; align-items: center; gap: 10px; padding: 8px 0 12px; background: linear-gradient(var(--ink) 80%, transparent); }
.msgs { display: flex; flex-direction: column; gap: 2px; padding-top: 8px; }
.hello { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 40px 0 24px; text-align: center; }
.day { align-self: center; margin: 14px 0 8px; color: var(--faint); font-size: 12px; font-weight: 700; }
.row { display: flex; flex-direction: column; align-items: flex-start; }
.row.mine { align-items: flex-end; }
.row.first { margin-top: 6px; }
.bubble { position: relative; max-width: min(78%, 460px); padding: 9px 13px; border-radius: 20px; background: var(--ink-3); color: var(--paper); font-size: 16px; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; animation: pop-in 220ms var(--ease-spring) both; }
.row:not(.mine):not(.first) .bubble { border-top-left-radius: 6px; }
.row:not(.mine):not(.last) .bubble { border-bottom-left-radius: 6px; }
.row.mine .bubble { background: var(--lime); color: var(--on-color); }
.row.mine:not(.first) .bubble { border-top-right-radius: 6px; }
.row.mine:not(.last) .bubble { border-bottom-right-radius: 6px; }
.bubble.pending { opacity: .6; }
.t { display: block; margin-top: 2px; font-size: 10.5px; font-weight: 700; opacity: .55; text-align: right; }
.seen { margin: 3px 4px 0; color: var(--faint); font-size: 11px; font-weight: 700; }
.composer { position: fixed; left: 12px; right: 12px; z-index: 55; bottom: calc(max(10px, env(safe-area-inset-bottom) - 14px) + 80px); display: flex; align-items: flex-end; gap: 8px; max-width: 616px; margin: 0 auto; padding: 6px 6px 6px 16px; border: 2px solid #000; border-radius: 26px; background: var(--ink-3); box-shadow: 0 10px 30px #000a; }
.composer textarea { flex: 1; min-height: 38px; max-height: 140px; padding: 8px 0; border: 0; background: none; color: var(--paper); font: inherit; font-size: 16px; line-height: 1.35; resize: none; outline: none; field-sizing: content; }
.send { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border: 2px solid #000; border-radius: 50%; background: var(--lime); color: var(--on-color); transition: transform var(--fast) var(--ease-out), opacity var(--fast); }
.send:disabled { opacity: .35; }
.send:active { transform: scale(.88); }
.composer-off { margin-top: 20px; }
@media (min-width: 1024px) {
  .composer { left: calc(230px + 24px); right: 24px; bottom: 24px; max-width: 652px; margin-left: calc(max(0px, (100vw - 230px - 700px) / 2)); }
}
</style>
