<script setup lang="ts">
import { MapPin, Plus, Share2, Trash2, Map as MapIcon, ChevronDown } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const me = useMe()
const route = useRoute()
const router = useRouter()
const community = useCommunity()
const crew = useCrew()
const toast = useToast()

const events = ref<any[]>([])
const loading = ref(true)
const showPast = ref(false)
const upcoming = computed(() => events.value.filter(e => new Date(e.starts_at).getTime() > Date.now() - 3 * 3600000))
const past = computed(() => events.value.filter(e => new Date(e.starts_at).getTime() <= Date.now() - 3 * 3600000).reverse())

const statusOf = (ev: any) => ev.rsvps.find((r: any) => r.user_id === me.value?.id)?.status || null
const idsWith = (ev: any, s: string) => ev.rsvps.filter((r: any) => r.status === s).map((r: any) => r.user_id)

async function load() {
  if (!community.value) return
  loading.value = true
  const { data, error } = await supabase.from('events').select('id,created_by,title,description,location,latitude,longitude,starts_at').eq('group_id', community.value).order('starts_at').limit(100)
  if (error) { toast.error(error.message); loading.value = false; return }
  const ids = (data || []).map(e => e.id)
  const { data: rsvps } = ids.length ? await supabase.from('event_rsvps').select('event_id,user_id,status').in('event_id', ids) : { data: [] as any[] }
  events.value = (data || []).map(e => ({ ...e, rsvps: (rsvps || []).filter((r: any) => r.event_id === e.id) }))
  loading.value = false
}

async function rsvp(ev: any, status: 'going' | 'maybe' | 'declined', e: MouseEvent) {
  if (!me.value) return
  const prev = ev.rsvps
  ev.rsvps = [...ev.rsvps.filter((r: any) => r.user_id !== me.value!.id), { user_id: me.value.id, status }]
  if (status === 'going') celebrate(originFrom(e))
  const { error } = await supabase.from('event_rsvps').upsert({ event_id: ev.id, user_id: me.value.id, status, updated_at: new Date().toISOString() }, { onConflict: 'event_id,user_id' })
  if (error) { ev.rsvps = prev; toast.error(error.message) }
}
async function remove(ev: any) {
  if (!confirm(`Cancelar "${ev.title}"?`)) return
  const { error } = await supabase.from('events').delete().eq('id', ev.id)
  if (error) return toast.error(error.message)
  events.value = events.value.filter(x => x.id !== ev.id)
  toast.ok('Plano cancelado')
}
function share(ev: any) {
  const going = idsWith(ev, 'going').length
  shareOut(`📅 ${ev.title}\n🕗 ${until(ev.starts_at)}${ev.location ? `\n📍 ${ev.location}` : ''}\n${going ? `${going} já confirmaram.` : 'Sê o primeiro a confirmar.'} Vens?`, '/plans')
}

// ── create ──────────────────────────────────────────────
const creating = ref(false)
const saving = ref(false)
const title = ref('')
const description = ref('')
const startsAt = ref('')
const location = ref<{ lat: number; lng: number; label: string } | null>(null)
const showMap = ref(false)
const quick = [
  { label: 'Hoje 21h', at: () => nextAt(21) },
  { label: 'Amanhã', at: () => nextAt(21, 0, 1) },
  { label: 'Sexta', at: () => nextWeekday(5, 21) },
  { label: 'Sábado', at: () => nextWeekday(6, 21) },
]
const ideas = ['Jantar', 'Finos', 'Cinema', 'LAN party', 'Futebolada', 'Escapadinha']
function openCreate() {
  title.value = ''; description.value = ''; location.value = null; showMap.value = false
  startsAt.value = toLocalInput(nextAt(21))
  creating.value = true
}
async function create(e: MouseEvent) {
  if (!community.value || !me.value || !title.value.trim() || !startsAt.value) return
  if (new Date(startsAt.value).getTime() < Date.now() - 60000) return toast.error('Escolhe uma hora no futuro.')
  saving.value = true
  const { data, error } = await supabase.from('events').insert({
    group_id: community.value, created_by: me.value.id, title: title.value.trim(), description: description.value.trim() || null,
    location: location.value?.label || null, latitude: location.value?.lat ?? null, longitude: location.value?.lng ?? null,
    starts_at: new Date(startsAt.value).toISOString(),
  }).select('id').single()
  if (!error && data) await supabase.from('event_rsvps').insert({ event_id: data.id, user_id: me.value.id, status: 'going' })
  saving.value = false
  if (error) return toast.error(error.message)
  creating.value = false
  celebrate(originFrom(e))
  toast.ok('Plano lançado! Partilha no grupo.')
  await load()
}

watch(() => route.query.new, (n) => { if (n) { openCreate(); router.replace({ query: {} }) } }, { immediate: true })
watch(community, load)
onMounted(load)
</script>

<template>
  <div class="plans">
    <header class="page-head">
      <div>
        <p class="kicker">Planos</p>
        <h1 class="display h-xl">Bora<span class="t-coral">?</span></h1>
      </div>
      <button class="btn btn-primary" @click="openCreate"><Plus :size="18" /> Plano</button>
    </header>

    <div v-if="loading && !events.length" class="flex flex-col gap-4"><div v-for="i in 2" :key="i" class="skeleton" style="height:240px" /></div>

    <div v-else-if="!upcoming.length" class="empty">
      <p class="display">Calendário vazio.</p>
      <p class="muted m-0">Jantar? Finos? LAN party? Alguém tem de começar.</p>
      <button class="btn btn-primary mt-5" @click="openCreate"><Plus :size="18" /> Lançar plano</button>
    </div>

    <TransitionGroup v-else name="list" tag="div" class="posters relative">
      <article v-for="(ev, i) in upcoming" :key="ev.id" class="poster sticker" :class="`fill-${posterColor(i)}`" :style="{ '--tilt': (i % 2 ? 1 : -1) * 1.2 + 'deg' }">
        <div class="flex items-start justify-between gap-3">
          <span class="when-badge">{{ until(ev.starts_at) }}</span>
          <div class="flex gap-1">
            <button class="mini" aria-label="Partilhar" @click="share(ev)"><Share2 :size="16" /></button>
            <button v-if="ev.created_by === me?.id" class="mini" aria-label="Cancelar plano" @click="remove(ev)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <h2 class="display poster-title">{{ ev.title }}</h2>
        <p class="poster-date">{{ capFirst(new Date(ev.starts_at).toLocaleString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) }}</p>
        <p v-if="ev.description" class="poster-desc">{{ ev.description }}</p>
        <a v-if="ev.location" class="poster-where" :href="ev.latitude ? `https://maps.apple.com/?ll=${ev.latitude},${ev.longitude}&q=${encodeURIComponent(ev.location.split(',')[0])}` : undefined" target="_blank" rel="noopener"><MapPin :size="15" /> {{ ev.location }}</a>

        <div class="crowd">
          <div v-if="idsWith(ev, 'going').length" class="flex items-center gap-2"><AvatarStack :ids="idsWith(ev, 'going')" :size="32" :max="6" /><b>{{ idsWith(ev, 'going').length }} vão</b></div>
          <b v-else>Ainda ninguém confirmou</b>
          <small v-if="idsWith(ev, 'maybe').length">+{{ idsWith(ev, 'maybe').length }} talvez</small>
        </div>

        <div class="rsvp" role="group" aria-label="Vais?">
          <button :class="{ on: statusOf(ev) === 'going' }" @click="rsvp(ev, 'going', $event)">Tô dentro</button>
          <button :class="{ on: statusOf(ev) === 'maybe' }" @click="rsvp(ev, 'maybe', $event)">Talvez</button>
          <button :class="{ on: statusOf(ev) === 'declined' }" @click="rsvp(ev, 'declined', $event)">Não dá</button>
        </div>
        <p class="byline">Lançado por {{ crew.nameOf(ev.created_by) }}</p>
      </article>
    </TransitionGroup>

    <section v-if="past.length" class="mt-6">
      <button class="past-toggle" @click="showPast = !showPast">
        <span class="kicker">Já foi · {{ past.length }}</span>
        <ChevronDown :size="18" :style="{ transform: showPast ? 'rotate(180deg)' : '' , transition: 'transform 200ms' }" />
      </button>
      <Transition name="fade">
        <div v-if="showPast" class="flex flex-col">
          <div v-for="ev in past" :key="ev.id" class="past-row">
            <span class="dot" :class="`fill-${colorFor(ev.id)}`" />
            <div class="flex-1 min-w-0"><strong class="block truncate">{{ ev.title }}</strong><small class="faint">{{ new Date(ev.starts_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) }}</small></div>
            <AvatarStack :ids="idsWith(ev, 'going')" :size="24" :max="4" />
          </div>
        </div>
      </Transition>
    </section>

    <Sheet :open="creating" kicker="Bora?" title="Novo plano" @close="creating = false">
      <div class="flex flex-col gap-5">
        <div>
          <input v-model="title" class="field title-field" maxlength="100" placeholder="O que é o plano?" autofocus>
          <div class="flex gap-2 flex-wrap mt-2">
            <button v-for="idea in ideas" :key="idea" class="chip" @click="title = idea">{{ idea }}</button>
          </div>
        </div>
        <div>
          <span class="label">Quando?</span>
          <div class="flex gap-2 flex-wrap mb-2">
            <button v-for="q in quick" :key="q.label" class="chip" :class="{ on: startsAt === toLocalInput(q.at()) }" @click="startsAt = toLocalInput(q.at())">{{ q.label }}</button>
          </div>
          <input v-model="startsAt" class="field" type="datetime-local">
          <p class="faint text-sm m-0 mt-2">{{ startsAt ? until(new Date(startsAt)) : '' }}</p>
        </div>
        <div>
          <span class="label">Onde? <span class="faint">(opcional)</span></span>
          <LocationPicker v-if="showMap" v-model="location" />
          <button v-else class="btn btn-ghost btn-block" @click="showMap = true"><MapIcon :size="17" /> Escolher no mapa</button>
        </div>
        <textarea v-model="description" class="field" rows="2" maxlength="1000" placeholder="Detalhes (opcional): quem leva o quê, dress code…" />
        <button class="btn btn-primary btn-block" :disabled="saving || !title.trim() || !startsAt" @click="create">{{ saving ? 'A lançar…' : 'Lançar plano' }}</button>
        <p class="faint text-xs text-center m-0">Se o Discord estiver ligado, a malta recebe aviso lá.</p>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.plans { display: flex; flex-direction: column; gap: 20px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-top: 8px; }
.page-head h1 { margin: 4px 0 0; }
.posters { display: flex; flex-direction: column; gap: 26px; padding: 4px 4px 0; }
.poster { display: flex; flex-direction: column; padding: 20px; transform: rotate(var(--tilt)); transition: transform var(--base) var(--ease-spring); }
.poster:hover { transform: rotate(0deg); }
.when-badge { padding: 6px 12px; border: 2px solid #000; border-radius: 999px; background: var(--ink); color: var(--paper); font-size: 13px; font-weight: 800; }
.mini { display: grid; place-items: center; width: 36px; height: 36px; border: 2px solid #000; border-radius: 999px; background: #ffffff55; transition: transform var(--fast) var(--ease-out), background-color var(--fast); }
.mini:hover { background: #ffffff99; }
.mini:active { transform: scale(.9); }
.poster-title { margin: 16px 0 0; font-size: clamp(38px, 12vw, 60px); overflow-wrap: anywhere; }
.poster-date { margin: 6px 0 0; font-weight: 700; opacity: .75; }
.poster-desc { margin: 10px 0 0; font-weight: 500; }
.poster-where { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.crowd { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
.crowd small { opacity: .7; font-weight: 700; }
.rsvp { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 16px; border: 2px solid #000; border-radius: 999px; overflow: hidden; background: #ffffff40; }
.rsvp button { height: 46px; border: 0; border-right: 2px solid #000; background: transparent; font-weight: 800; transition: background-color var(--fast), color var(--fast); }
.rsvp button:last-child { border-right: 0; }
.rsvp button.on { background: var(--ink); color: var(--paper); }
.rsvp button:active { background: #00000022; }
.byline { margin: 12px 0 0; font-size: 12px; font-weight: 700; opacity: .6; }
.past-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 0; background: none; border: 0; color: var(--muted); }
.past-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1.5px solid var(--line); }
.dot { width: 14px; height: 14px; flex: none; border: 2px solid #000; border-radius: 50%; }
.title-field { font-family: var(--font-display); font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
</style>
