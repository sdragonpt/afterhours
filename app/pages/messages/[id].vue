<script setup lang="ts">
import { ChevronLeft, Send, ImagePlus, X, Check, CheckCheck } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const supabase = useSupabaseClient()
const me = useMe()
const toast = useToast()
const dms = useDMs()
const media = useMedia()

type Row = DM & { pending?: boolean; localUrl?: string; progress?: number }
const other = computed(() => String(route.params.id || ''))
const who = ref<{ name: string; color: string } | null>(null)
const canMessage = ref(true)
const rows = ref<Row[]>([])
const urls = ref<Record<string, string>>({})
const loaded = ref(false)
const text = ref('')
const photo = ref<File | null>(null)
const photoPreview = ref('')
const viewer = ref('')
const input = ref<HTMLTextAreaElement | null>(null)
const picker = ref<HTMLInputElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const root = ref<HTMLElement | null>(null)

useHead(() => ({ title: `${who.value?.name || 'Mensagens'} · Afterhours` }))
useSwipeBack(root, '/messages')

function scrollDown(smooth = false) {
  nextTick(() => { const el = scroller.value; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }) })
}
async function signNew(list: Row[]) {
  const paths = list.map(r => r.media_path).filter((p): p is string => !!p && !urls.value[p])
  if (!paths.length) return
  const signed = await media.sign(paths)
  urls.value = { ...urls.value, ...signed }
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
  signNew(rows.value).then(() => scrollDown())
  if (rows.value.some(r => r.recipient_id === uid && !r.read_at)) dms.markRead(other.value)
}

// ── photo ──
function pickPhoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (!f.type.startsWith('image/')) return toast.error('Só dá para enviar fotos.')
  clearPhoto()
  photo.value = f
  photoPreview.value = URL.createObjectURL(f)
}
function clearPhoto() {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photo.value = null; photoPreview.value = ''
}

async function send() {
  const body = text.value.trim()
  const f = photo.value
  if ((!body && !f) || !me.value) return
  const temp: Row = { id: `tmp-${Date.now()}`, sender_id: me.value.id, recipient_id: other.value, body, media_path: null, created_at: new Date().toISOString(), delivered_at: null, read_at: null, pending: true, localUrl: f ? URL.createObjectURL(f) : undefined, progress: f ? 0 : undefined }
  rows.value.push(temp)
  text.value = ''
  photo.value = null; photoPreview.value = ''
  scrollDown(true)
  const fail = (msg: string) => {
    rows.value = rows.value.filter(r => r.id !== temp.id)
    text.value = body
    toast.error(msg)
  }
  let path: string | null = null
  if (f) {
    try {
      path = await media.sendDM(f, other.value, p => { const r = rows.value.find(x => x.id === temp.id); if (r) r.progress = p })
    } catch (e: any) { return fail(e?.message || 'Não deu para enviar a foto') }
  }
  const { data, error } = await supabase.from('direct_messages').insert({ recipient_id: other.value, body, media_path: path }).select('*').single()
  if (error) {
    if (path) media.remove(path)
    return fail(error.message.includes('row-level security') ? 'Já não partilham nenhuma comunidade.' : error.message)
  }
  const saved = data as DM
  if (path && temp.localUrl) urls.value = { ...urls.value, [path]: temp.localUrl } // keep showing the local copy
  rows.value = rows.value.filter(r => r.id !== temp.id && r.id !== saved.id)
  rows.value.push(saved)
  if (!f) input.value?.focus()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !(e as any).isComposing && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); send() }
}

const off = dms.onMessage((m, kind) => {
  if (![m.sender_id, m.recipient_id].includes(other.value)) return
  if (kind === 'DELETE') { rows.value = rows.value.filter(r => r.id !== m.id); return }
  const i = rows.value.findIndex(r => r.id === m.id)
  if (i >= 0) { rows.value[i] = { ...rows.value[i], ...m }; return }
  if (kind !== 'INSERT') return
  if (m.sender_id === me.value?.id && rows.value.some(r => r.pending)) return // our own send, handled above
  rows.value.push(m)
  signNew([m])
  scrollDown(true)
  if (m.recipient_id === me.value?.id) dms.markRead(other.value)
})

// ── grouping: day separators + consecutive bubbles from the same person ──
const items = computed(() => {
  const out: ({ kind: 'day'; key: string; label: string } | { kind: 'msg'; m: Row; mine: boolean; first: boolean; last: boolean })[] = []
  let lastDay = ''
  const near = (a?: Row, b?: Row) => !!a && !!b && a.sender_id === b.sender_id && Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 5 * 60000 && dayKey(new Date(a.created_at)) === dayKey(new Date(b.created_at))
  rows.value.forEach((m, i) => {
    const day = dayKey(new Date(m.created_at))
    if (day !== lastDay) { out.push({ kind: 'day', key: `d-${day}`, label: dayLabel(day) }); lastDay = day }
    out.push({ kind: 'msg', m, mine: m.sender_id === me.value?.id, first: !near(rows.value[i - 1], m), last: !near(m, rows.value[i + 1]) })
  })
  return out
})
// receipt under my latest message: A enviar… / Enviada / Entregue / Visto
const lastMine = computed(() => [...rows.value].reverse().find(r => r.sender_id === me.value?.id))
const lastIsMine = computed(() => rows.value.length > 0 && rows.value[rows.value.length - 1]!.sender_id === me.value?.id)
const receipt = computed(() => {
  const m = lastMine.value
  if (!m) return null
  if (m.pending) return { label: m.progress !== undefined && m.progress < 1 ? `A enviar… ${Math.round((m.progress || 0) * 100)}%` : 'A enviar…', icon: null, seen: false }
  if (m.read_at) return { label: `Visto ${time(m.read_at)}`, icon: CheckCheck, seen: true }
  if (m.delivered_at) return { label: 'Entregue', icon: CheckCheck, seen: false }
  return { label: 'Enviada', icon: Check, seen: false }
})
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
const srcOf = (m: Row): string => m.localUrl || (m.media_path ? urls.value[m.media_path] || '' : '')

function goBack() {
  if ((window.history.state as any)?.back) useRouter().back()
  else navigateTo('/messages', { replace: true })
}

watch(other, () => { rows.value = []; loaded.value = false; dms.openWith.value = other.value; load() })
onMounted(() => {
  if (!/^[0-9a-f-]{36}$/i.test(other.value)) return showError({ statusCode: 404, statusMessage: 'Conversa não encontrada' })
  dms.openWith.value = other.value; load()
})
onBeforeUnmount(() => { off(); dms.openWith.value = null; clearPhoto() })
</script>

<template>
  <div ref="root" class="chat">
    <header class="chat-head">
      <button class="icon-btn" aria-label="Voltar" @click="goBack"><ChevronLeft :size="20" /></button>
      <Avatar v-if="who" :name="who.name" :color="who.color" :size="38" />
      <strong class="truncate text-lg">{{ who?.name || '…' }}</strong>
    </header>

    <div ref="scroller" class="msgs">
      <div v-if="!loaded" class="flex flex-col gap-2 pt-4">
        <div class="skeleton self-start" style="height:38px;width:55%" />
        <div class="skeleton self-end" style="height:38px;width:40%" />
        <div class="skeleton self-start" style="height:38px;width:62%" />
      </div>
      <template v-else>
        <div v-if="!rows.length" class="hello">
          <Avatar v-if="who" :name="who.name" :color="who.color" :size="76" />
          <p class="display h-md m-0 mt-3">{{ who?.name }}</p>
          <p class="muted m-0">Diz olá 👋 Só vocês os dois veem isto.</p>
        </div>
        <template v-for="it in items" :key="it.kind === 'day' ? it.key : it.m.id">
          <p v-if="it.kind === 'day'" class="day">{{ it.label }}</p>
          <div v-else class="row" :class="{ mine: it.mine, first: it.first, last: it.last }">
            <button v-if="it.m.media_path || it.m.localUrl" type="button" class="photo" :class="{ pending: it.m.pending }" :disabled="!srcOf(it.m)" @click="viewer = srcOf(it.m)">
              <img v-if="srcOf(it.m)" :src="srcOf(it.m)" alt="Foto" loading="lazy" @load="it.m.pending && scrollDown()">
              <span v-else class="photo-wait" />
              <span v-if="it.m.pending && it.m.progress !== undefined" class="photo-bar"><i :style="{ width: `${Math.round((it.m.progress || 0) * 100)}%` }" /></span>
            </button>
            <div v-if="it.m.body" class="bubble" :class="{ pending: it.m.pending }">
              <span class="txt">{{ it.m.body }}</span>
              <small v-if="it.last" class="t">{{ time(it.m.created_at) }}</small>
            </div>
          </div>
        </template>
        <Transition name="fade">
          <p v-if="receipt && lastIsMine" class="receipt" :class="{ seen: receipt.seen }"><component :is="receipt.icon" v-if="receipt.icon" :size="14" /> {{ receipt.label }}</p>
        </Transition>
      </template>
    </div>

    <div class="bottom">
      <div v-if="photoPreview" class="attach">
        <img :src="photoPreview" alt="">
        <button class="attach-x" aria-label="Remover foto" @click="clearPhoto"><X :size="14" /></button>
      </div>
      <form v-if="loaded && canMessage" class="composer" @submit.prevent="send">
        <input ref="picker" type="file" accept="image/*" class="hidden" @change="pickPhoto">
        <button type="button" class="tool" aria-label="Enviar foto" @click="picker?.click()"><ImagePlus :size="20" /></button>
        <textarea ref="input" v-model="text" rows="1" maxlength="2000" placeholder="Mensagem…" enterkeyhint="send" @keydown="onKey" />
        <button class="send" :disabled="!text.trim() && !photo" aria-label="Enviar"><Send :size="18" /></button>
      </form>
      <p v-else-if="loaded" class="muted text-center m-0 py-3">Já não estão na mesma comunidade, por isso não dá para responder.</p>
    </div>

    <Transition name="fade">
      <div v-if="viewer" class="viewer" data-no-swipe @click="viewer = ''">
        <img :src="viewer" alt="Foto">
        <button class="icon-btn viewer-x" aria-label="Fechar"><X :size="18" /></button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* full-screen conversation (top bar and tab bar are hidden by the layout) */
.chat { position: fixed; inset: 0; z-index: 45; display: flex; flex-direction: column; background: var(--ink); will-change: transform; }
.chat-head { display: flex; align-items: center; gap: 10px; flex: none; padding: max(12px, calc(env(safe-area-inset-top) + 12px)) 14px 10px; border-bottom: 1.5px solid var(--line); background: var(--ink); }
.msgs { flex: 1; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 2px; padding: 10px 14px 12px; }
.msgs > :first-child { margin-top: auto; }
.hello { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 40px 0 24px; text-align: center; }
.day { align-self: center; margin: 14px 0 8px; color: var(--faint); font-size: 12px; font-weight: 700; }
.row { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
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
.photo { position: relative; display: block; max-width: min(70%, 320px); padding: 0; overflow: hidden; border: 2px solid #000; border-radius: 20px; background: var(--ink-3); animation: pop-in 220ms var(--ease-spring) both; }
.photo img { display: block; width: 100%; max-height: 380px; object-fit: cover; }
.photo.pending img { opacity: .7; }
.photo-wait { display: block; width: 200px; height: 240px; background: linear-gradient(90deg, var(--ink-3), var(--ink-4), var(--ink-3)); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
.photo-bar { position: absolute; left: 10px; right: 10px; bottom: 10px; height: 5px; overflow: hidden; border-radius: 9px; background: #0008; }
.photo-bar i { display: block; height: 100%; background: var(--lime); transition: width 150ms; }
.receipt { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin: 4px 2px 0; color: var(--faint); font-size: 11.5px; font-weight: 700; }
.receipt.seen { color: var(--sky); }

.bottom { flex: none; padding: 8px 12px max(10px, env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--ink) 14px); }
.attach { position: relative; display: inline-block; margin: 0 0 8px 4px; }
.attach img { display: block; max-height: 110px; border: 2px solid #000; border-radius: 14px; }
.attach-x { position: absolute; top: -8px; right: -8px; display: grid; place-items: center; width: 26px; height: 26px; border: 2px solid #000; border-radius: 50%; background: var(--paper); color: #000; }
.composer { display: flex; align-items: flex-end; gap: 6px; max-width: 700px; margin: 0 auto; padding: 5px; border: 2px solid #000; border-radius: 26px; background: var(--ink-3); }
.tool { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border: 0; border-radius: 50%; background: transparent; color: var(--sky); }
.tool:active { transform: scale(.9); }
.composer textarea { flex: 1; min-height: 38px; max-height: 140px; padding: 9px 0; border: 0; background: none; color: var(--paper); font: inherit; font-size: 16px; line-height: 1.35; resize: none; outline: none; field-sizing: content; }
.send { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border: 2px solid #000; border-radius: 50%; background: var(--lime); color: var(--on-color); transition: transform var(--fast) var(--ease-out), opacity var(--fast); }
.send:disabled { opacity: .35; }
.send:active { transform: scale(.88); }

.viewer { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: calc(env(safe-area-inset-top) + 50px) 12px calc(env(safe-area-inset-bottom) + 20px); background: #000e; }
.viewer img { max-width: 100%; max-height: 100%; border-radius: 12px; object-fit: contain; }
.viewer-x { position: absolute; top: calc(env(safe-area-inset-top) + 12px); right: 14px; }

@media (min-width: 1024px) {
  .chat { left: 230px; }
  .msgs, .chat-head { padding-left: max(24px, calc((100% - 700px) / 2)); padding-right: max(24px, calc((100% - 700px) / 2)); }
}
</style>
