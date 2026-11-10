<script setup lang="ts">
import { MapPin, Plus, Share2, Trash2, ChevronDown, Clock } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const me = useMe()
const route = useRoute()
const router = useRouter()
const community = useCommunity()
const crew = useCrew()
const toast = useToast()
const plans = usePlans()

const events = computed({ get: () => plans.data.value, set: (v) => { plans.data.value = v } })
const showPast = ref(false)
const cutoff = () => Date.now() - 3 * 3600000
const upcoming = computed(() => events.value.filter((e: any) => new Date(e.starts_at).getTime() > cutoff()))
const past = computed(() => events.value.filter((e: any) => new Date(e.starts_at).getTime() <= cutoff()).reverse())

/** day → poster colours, for the agenda dots */
const marks = computed(() => {
  const m: Record<string, string[]> = {}
  upcoming.value.forEach((e: any, i: number) => { (m[dayKey(e.starts_at)] ||= []).push(posterColor(i)) })
  return m
})
const agendaDay = ref<string | null>(null)
const highlighted = ref<string | null>(null)

function pickDay(key: string) {
  const first = upcoming.value.find((e: any) => dayKey(e.starts_at) === key)
  if (first) {
    highlighted.value = first.id
    document.getElementById(`plan-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => (highlighted.value = null), 1200)
  } else {
    openCreate(key)
  }
}

const statusOf = (ev: any) => ev.rsvps.find((r: any) => r.user_id === me.value?.id)?.status || null
const idsWith = (ev: any, s: string) => ev.rsvps.filter((r: any) => r.status === s).map((r: any) => r.user_id)

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
  events.value = events.value.filter((x: any) => x.id !== ev.id)
  toast.ok('Plano cancelado')
}
function share(ev: any) {
  const going = idsWith(ev, 'going').length
  shareOut(`📅 ${ev.title}\n🕗 ${dayLabel(dayKey(ev.starts_at))} às ${new Date(ev.starts_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}${ev.location ? `\n📍 ${ev.location}` : ''}\n${going ? `${going} já confirmaram.` : 'Sê o primeiro a confirmar.'} Vens?`, '/plans')
}

// ── create ──────────────────────────────────────────────
const creating = ref(false)
const saving = ref(false)
const title = ref('')
const description = ref('')
const day = ref(dayKey(new Date()))
const time = ref('21:00')
const customTime = ref(false)
const where = ref('')
const ideas = ['Jantar', 'Finos', 'Cinema', 'LAN party', 'Futebolada', 'Escapadinha']
const times = ['13:00', '18:00', '19:00', '20:00', '21:00', '21:30', '22:00', '23:00']
const recentPlaces = computed(() => [...new Set(events.value.map((e: any) => e.location).filter(Boolean))].slice(0, 5) as string[])
const when = computed(() => atDay(day.value, time.value))
const inPast = computed(() => when.value.getTime() < Date.now() - 60000)
const relative = computed(() => {
  const diff = when.value.getTime() - Date.now()
  if (diff < 6 * 3600000) return until(when.value)
  const days = Math.max(1, Math.round(diff / 86400000))
  return days === 1 ? 'daqui a 1 dia' : `daqui a ${days} dias`
})
const sameDay = computed(() => upcoming.value.filter((e: any) => dayKey(e.starts_at) === day.value))
const timesForDay = computed(() => times.filter(t => atDay(day.value, t).getTime() > Date.now()))

function openCreate(forDay?: string) {
  title.value = ''; description.value = ''; where.value = ''; customTime.value = false
  const now = new Date()
  day.value = forDay || (now.getHours() >= 22 ? dayKey(new Date(Date.now() + 86400000)) : dayKey(now))
  time.value = timesForDay.value.includes('21:00') ? '21:00' : (timesForDay.value[0] || '21:00')
  creating.value = true
}
watch(day, () => { if (!customTime.value && !timesForDay.value.includes(time.value) && timesForDay.value.length) time.value = timesForDay.value[0]! })

async function create(e: MouseEvent) {
  if (!community.value || !me.value || !title.value.trim()) return
  if (inPast.value) return toast.error('Essa hora já passou.')
  saving.value = true
  const { data, error } = await supabase.from('events').insert({
    group_id: community.value, created_by: me.value.id, title: title.value.trim(),
    description: description.value.trim() || null, location: where.value.trim() || null,
    starts_at: when.value.toISOString(),
  }).select('id,created_by,title,description,location,starts_at').single()
  if (!error && data) await supabase.from('event_rsvps').insert({ event_id: data.id, user_id: me.value.id, status: 'going' })
  saving.value = false
  if (error) return toast.error(error.message)
  // show it immediately, then sync
  events.value = [...events.value, { ...data, rsvps: [{ user_id: me.value.id, status: 'going' }] }].sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at))
  creating.value = false
  celebrate(originFrom(e))
  toast.ok('Plano lançado! Partilha no grupo.')
  plans.refresh()
}

watch(() => route.query.new, (n) => { if (n) { openCreate(); router.replace({ query: {} }) } }, { immediate: true })
watch(community, () => plans.refresh())
onMounted(() => plans.refresh())
</script>

<template>
  <div class="plans">
    <header class="page-head">
      <div>
        <p class="kicker">Planos</p>
        <h1 class="display h-xl">Bora<span class="t-coral">?</span></h1>
      </div>
      <button class="btn btn-primary" @click="openCreate()"><Plus :size="18" /> Plano</button>
    </header>

    <!-- agenda -->
    <section>
      <DayStrip v-model="agendaDay" :marks="marks" @pick="pickDay" />
      <p class="faint text-xs m-0 mt-1">Toca num dia livre para marcar um plano.</p>
    </section>

    <div v-if="!plans.loaded.value" class="flex flex-col gap-4"><div v-for="i in 2" :key="i" class="skeleton" style="height:220px" /></div>

    <div v-else-if="!upcoming.length" class="empty">
      <p class="display">Calendário vazio.</p>
      <p class="muted m-0">Jantar? Finos? LAN party? Alguém tem de começar.</p>
      <button class="btn btn-primary mt-5" @click="openCreate()"><Plus :size="18" /> Lançar plano</button>
    </div>

    <TransitionGroup v-else name="list" tag="div" class="posters relative">
      <article v-for="(ev, i) in upcoming" :id="`plan-${ev.id}`" :key="ev.id" class="poster sticker" :class="[`fill-${posterColor(i)}`, { flash: highlighted === ev.id }]" :style="{ '--tilt': (i % 2 ? 1 : -1) * 1.2 + 'deg' }">
        <div class="flex items-start justify-between gap-3">
          <span class="when-badge">{{ until(ev.starts_at) }}</span>
          <div class="flex gap-1">
            <button class="mini" aria-label="Partilhar" @click="share(ev)"><Share2 :size="16" /></button>
            <button v-if="ev.created_by === me?.id" class="mini" aria-label="Cancelar plano" @click="remove(ev)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <h2 class="display poster-title">{{ ev.title }}</h2>
        <p class="poster-date">{{ dayLabel(dayKey(ev.starts_at)) }} · {{ new Date(ev.starts_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }}</p>
        <p v-if="ev.description" class="poster-desc">{{ ev.description }}</p>
        <a v-if="ev.location" class="poster-where" :href="`https://maps.apple.com/?q=${encodeURIComponent(ev.location)}`" target="_blank" rel="noopener"><MapPin :size="15" /> {{ ev.location }}</a>

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

    <section v-if="past.length" class="mt-4">
      <button class="past-toggle" @click="showPast = !showPast">
        <span class="kicker">Já foi · {{ past.length }}</span>
        <ChevronDown :size="18" class="chev" :class="{ open: showPast }" />
      </button>
      <Transition name="fade">
        <div v-if="showPast" class="flex flex-col">
          <div v-for="(ev, i) in past" :key="ev.id" class="past-row">
            <span class="dot" :class="`fill-${posterColor(i + 2)}`" />
            <div class="flex-1 min-w-0"><strong class="block truncate">{{ ev.title }}</strong><small class="faint">{{ new Date(ev.starts_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) }}</small></div>
            <AvatarStack :ids="idsWith(ev, 'going')" :size="24" :max="4" />
          </div>
        </div>
      </Transition>
    </section>

    <Sheet :open="creating" kicker="Bora?" title="Novo plano" @close="creating = false">
      <div class="flex flex-col gap-6">
        <div>
          <input v-model="title" class="field title-field" maxlength="100" placeholder="O que é o plano?">
          <div class="flex gap-2 flex-wrap mt-2">
            <button v-for="idea in ideas" :key="idea" class="chip" :class="{ on: title === idea }" @click="title = idea">{{ idea }}</button>
          </div>
        </div>

        <div>
          <span class="label">Que dia?</span>
          <DayStrip v-model="day" :marks="marks" :days="28" compact />
          <Transition name="fade">
            <p v-if="sameDay.length" class="clash">Nesse dia já há: <b>{{ sameDay.map((e: any) => e.title).join(', ') }}</b></p>
          </Transition>
        </div>

        <div>
          <span class="label">A que horas?</span>
          <div class="times">
            <button v-for="t in timesForDay" :key="t" class="time" :class="{ on: !customTime && time === t }" @click="time = t; customTime = false">{{ t === '13:00' ? 'Almoço' : t.replace(':00', 'h').replace(':30', 'h30') }}</button>
            <button class="time" :class="{ on: customTime }" @click="customTime = true"><Clock :size="15" /> Outra</button>
          </div>
          <input v-if="customTime" v-model="time" type="time" class="field mt-2" step="900">
        </div>

        <div class="summary" :class="{ bad: inPast }">
          <span class="display">{{ dayLabel(day) }} · {{ time }}</span>
          <small>{{ inPast ? 'Essa hora já passou' : relative }}</small>
        </div>

        <div>
          <span class="label">Onde? <span class="faint">(opcional)</span></span>
          <input v-model="where" class="field" maxlength="160" placeholder="Tasca do Zé, lá em casa, Discord…">
          <div v-if="recentPlaces.length" class="flex gap-2 flex-wrap mt-2">
            <button v-for="p in recentPlaces" :key="p" class="chip" :class="{ on: where === p }" @click="where = p"><MapPin :size="13" /> {{ p.split(',')[0] }}</button>
          </div>
        </div>

        <textarea v-model="description" class="field" rows="2" maxlength="1000" placeholder="Detalhes (opcional): quem leva o quê, dress code…" />
        <button class="btn btn-primary btn-block" :disabled="saving || !title.trim() || inPast" @click="create">{{ saving ? 'A lançar…' : 'Lançar plano' }}</button>
        <p class="faint text-xs text-center m-0 -mt-3">Se o Discord estiver ligado, a malta recebe aviso lá.</p>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.plans { display: flex; flex-direction: column; gap: 18px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-top: 8px; }
.page-head h1 { margin: 4px 0 0; }
.posters { display: flex; flex-direction: column; gap: 24px; padding: 4px 4px 0; }
.poster { display: flex; flex-direction: column; padding: 20px; transform: rotate(var(--tilt)); transition: transform var(--base) var(--ease-spring), box-shadow var(--base); scroll-margin: 100px; }
.poster:hover { transform: rotate(0deg); }
.poster.flash { transform: rotate(0) scale(1.02); box-shadow: 6px 6px 0 #000, 0 0 0 4px var(--paper); }
.when-badge { padding: 6px 12px; border: 2px solid #000; border-radius: 999px; background: var(--ink); color: var(--paper); font-size: 13px; font-weight: 800; }
.mini { display: grid; place-items: center; width: 36px; height: 36px; border: 2px solid #000; border-radius: 999px; background: #ffffff55; transition: transform var(--fast) var(--ease-out), background-color var(--fast); }
.mini:hover { background: #ffffff99; }
.mini:active { transform: scale(.9); }
.poster-title { margin: 16px 0 0; font-size: clamp(38px, 12vw, 60px); overflow-wrap: anywhere; }
.poster-date { margin: 6px 0 0; font-weight: 800; opacity: .75; }
.poster-desc { margin: 10px 0 0; font-weight: 500; }
.poster-where { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.crowd { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
.crowd small { opacity: .7; font-weight: 700; }
.rsvp { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 16px; border: 2px solid #000; border-radius: 999px; overflow: hidden; background: #ffffff40; }
.rsvp button { height: 46px; border: 0; border-right: 2px solid #000; background: transparent; font-weight: 800; transition: background-color var(--fast), color var(--fast); }
.rsvp button:last-child { border-right: 0; }
.rsvp button.on { background: var(--ink); color: var(--paper); }
.rsvp button:active { background: #00000022; }
.byline { margin: 12px 0 0; font-size: 12px; font-weight: 700; opacity: .6; }
.past-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 0; background: none; border: 0; color: var(--muted); }
.chev { transition: transform var(--base) var(--ease-out); }
.chev.open { transform: rotate(180deg); }
.past-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1.5px solid var(--line); }
.dot { width: 14px; height: 14px; flex: none; border: 2px solid #000; border-radius: 50%; }
.title-field { font-family: var(--font-display); font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
.times { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.time { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 46px; border: 1.5px solid var(--line-strong); border-radius: 14px; background: var(--ink); font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--paper); transition: transform var(--fast) var(--ease-out), background-color var(--fast), color var(--fast); }
.time:active { transform: scale(.94); }
.time.on { background: var(--coral); color: var(--on-color); border: 2px solid #000; box-shadow: 3px 3px 0 #000; }
.summary { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 14px 16px; border: 2px solid #000; border-radius: var(--r-md); background: var(--paper); color: var(--on-color); box-shadow: 4px 4px 0 var(--coral); }
.summary .display { font-size: 22px; }
.summary small { font-weight: 700; opacity: .7; white-space: nowrap; }
.summary.bad { background: var(--coral); }
.clash { margin: 8px 0 0; font-size: 13px; color: var(--sun); }
</style>
