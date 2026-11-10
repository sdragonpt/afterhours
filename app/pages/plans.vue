<script setup lang="ts">
import { CalendarDays, MapPin, Clock3, Plus, Check, HelpCircle, X, LoaderCircle, ChevronLeft, ChevronRight, Compass, Sparkles, Share2 } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })
const supabase = useSupabaseClient()
const user = useMe()
const community = useCommunity()
const events = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const showForm = ref(false)
const title = ref('')
const description = ref('')
const startsAt = ref('')
const selectedLocation = ref<{lat:number;lng:number;label:string}|null>(null)
const now = new Date()
const defaultDate = new Date(now.getTime() + 86400000)
defaultDate.setHours(20, 0, 0, 0)
const minDateTime = computed(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,16) })
const goingCount = (event: any) => event.rsvps.filter((r: any) => r.status === 'going').length
const localStatus = (event: any) => event.rsvps?.find((r: any) => r.user_id === user.value?.id)?.status || ''
const upcoming = computed(() => events.value.filter(e => new Date(e.starts_at).getTime() >= Date.now()).sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()))
const past = computed(() => events.value.filter(e => new Date(e.starts_at).getTime() < Date.now()).sort((a,b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()))
function localDateTime(date: Date) { const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return d.toISOString().slice(0,16) }
function setQuickDate(kind: 'today'|'tomorrow'|'weekend') {
  const d = new Date()
  if (kind === 'tomorrow') d.setDate(d.getDate()+1)
  if (kind === 'weekend') { const days = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate()+days) }
  d.setHours(20,0,0,0); startsAt.value = localDateTime(d)
}
function formatDate(date: string) { return new Intl.DateTimeFormat('pt-PT',{weekday:'short',day:'2-digit',month:'short'}).format(new Date(date)) }
function formatTime(date: string) { return new Intl.DateTimeFormat('pt-PT',{hour:'2-digit',minute:'2-digit'}).format(new Date(date)) }
async function load() {
  if (!community.value) { events.value = []; return }
  loading.value = true; error.value = ''
  const { data, error: e } = await supabase.from('events').select('id,group_id,created_by,title,description,location,latitude,longitude,starts_at,created_at').eq('group_id', community.value).order('starts_at',{ascending:true}).limit(80)
  if (e) { error.value = e.message; loading.value = false; return }
  const rows = data || []; const ids = rows.map(r => r.id)
  const { data: rsvps, error: re } = ids.length ? await supabase.from('event_rsvps').select('event_id,user_id,status').in('event_id',ids) : { data: [], error: null }
  if (re) error.value = re.message
  events.value = rows.map(ev => ({ ...ev, rsvps: (rsvps || []).filter(r => r.event_id === ev.id) }))
  loading.value = false
}
function openCreate() {
  title.value = ''; description.value = ''; selectedLocation.value = null
  const d = new Date(); d.setDate(d.getDate()+1); d.setHours(20,0,0,0); startsAt.value = localDateTime(d)
  showForm.value = true; error.value = ''; success.value = ''
}
async function createEvent() {
  if (!community.value || !user.value || !title.value.trim() || !startsAt.value) return
  if (new Date(startsAt.value).getTime() <= Date.now()) { error.value = 'Escolhe uma data e hora no futuro.'; return }
  saving.value = true; error.value = ''; success.value = ''
  const payload: Record<string, any> = { group_id: community.value, created_by: user.value.id, title: title.value.trim(), description: description.value.trim() || null, location: selectedLocation.value?.label || null, starts_at: new Date(startsAt.value).toISOString() }
  if (selectedLocation.value) { payload.latitude = selectedLocation.value.lat; payload.longitude = selectedLocation.value.lng }
  const { error: e } = await supabase.from('events').insert(payload)
  saving.value = false
  if (e) { error.value = e.message; return }
  showForm.value = false; success.value = 'Plano criado! Partilha-o com o grupo.'; await load()
}
async function rsvp(event: any, status: string) {
  if (!user.value) return
  const { error: e } = await supabase.from('event_rsvps').upsert({ event_id: event.id, user_id: user.value.id, status, updated_at: new Date().toISOString() }, { onConflict: 'event_id,user_id' })
  if (e) { error.value = e.message; return }
  await load()
}
async function shareEvent(event: any) {
  const going = goingCount(event)
  const text = `📅 ${event.title}\n🕗 ${formatDate(event.starts_at)} às ${formatTime(event.starts_at)}${event.location ? `\n📍 ${event.location}` : ''}\n${going} já confirmaram. Vens?`
  await shareOut(text, '/plans')
}
watch(community, load)
onMounted(load)
</script>
<template>
  <div class="content-page plans-page">
    <header class="content-header"><div><span class="eyebrow"><CalendarDays :size="13"/> OFF THE SCREEN</span><h1>Plans & events<span class="accent-dot">.</span></h1><p>Good plans. Better people.</p></div><button class="primary-button" @click="openCreate"><Plus :size="15"/> New plan</button></header>
    <p v-if="error" class="notice error-notice">{{ error }}</p><p v-if="success" class="notice success-notice">{{ success }}</p>
    <div v-if="loading" class="loading-state"><LoaderCircle class="spin"/> Loading plans...</div>
    <section v-else><div class="section-label"><h2>UP NEXT</h2><span>{{ upcoming.length }} upcoming</span></div><div v-if="!upcoming.length" class="surface-card empty-inline"><div class="empty-icon"><CalendarDays :size="22"/></div><strong class="block text-white mb-2">Nothing on the calendar</strong>Start a plan and get everyone together.<button class="primary-button compact mt-4" @click="openCreate"><Plus :size="14"/> Create first plan</button></div><div class="event-list"><article v-for="event in upcoming" :key="event.id" class="event-card"><div class="event-date"><strong>{{ new Date(event.starts_at).getDate() }}</strong><span>{{ new Date(event.starts_at).toLocaleDateString('pt-PT',{month:'short'}).toUpperCase() }}</span></div><div class="event-main"><div class="event-topline"><span class="pill">{{ formatDate(event.starts_at) }} · {{ formatTime(event.starts_at) }}</span><span class="event-going">{{ goingCount(event) }} going</span></div><h3>{{ event.title }}</h3><p v-if="event.description">{{ event.description }}</p><div v-if="event.location" class="event-location"><MapPin :size="13"/> {{ event.location }} <a v-if="event.latitude && event.longitude" :href="`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=16/${event.latitude}/${event.longitude}`" target="_blank" rel="noopener">Ver mapa</a></div><div class="rsvp-actions"><button :class="{ chosen: localStatus(event)==='going' }" @click="rsvp(event,'going')"><Check :size="13"/> Going</button><button :class="{ chosen: localStatus(event)==='maybe' }" @click="rsvp(event,'maybe')"><HelpCircle :size="13"/> Maybe</button><button :class="{ chosen: localStatus(event)==='declined' }" @click="rsvp(event,'declined')"><X :size="13"/> Can't go</button><button class="share-btn" title="Partilhar no WhatsApp/Discord" @click="shareEvent(event)"><Share2 :size="13"/> Partilhar</button></div></div></article></div>
      <div v-if="past.length" class="section-label past-label"><h2>PAST EVENTS</h2><span>{{ past.length }} archived</span></div><div class="past-list"><div v-for="event in past" :key="event.id" class="list-row"><span class="quick-icon purple"><CalendarDays :size="16"/></span><div class="list-row-main"><strong>{{ event.title }}</strong><small>{{ formatDate(event.starts_at) }} · {{ event.location || 'No location' }}</small></div><span class="pill">Completed</span></div></div></section>

    <div v-if="showForm" class="plan-overlay" @click.self="showForm = false"><section class="plan-modal"><header class="plan-modal-head"><div><span class="eyebrow"><Sparkles :size="13"/> MAKE IT HAPPEN</span><h2>Create a plan<span class="accent-dot">.</span></h2><p>Pick a time, drop a pin and let the crew know.</p></div><button class="icon-button" aria-label="Close" @click="showForm = false"><X :size="18"/></button></header>
      <form @submit.prevent="createEvent" class="plan-form">
        <label class="plan-field"><span>WHAT'S THE PLAN?</span><input v-model="title" class="field plan-title-input" maxlength="100" placeholder="Dinner, game night, road trip..." required autofocus/></label>
        <div class="plan-field"><span>WHEN?</span><div class="quick-dates"><button type="button" @click="setQuickDate('today')">Today</button><button type="button" @click="setQuickDate('tomorrow')">Tomorrow</button><button type="button" @click="setQuickDate('weekend')">This weekend</button></div><div class="date-time-grid"><label><span>DATE</span><input v-model="startsAt" class="field" type="datetime-local" :min="minDateTime" required/></label><div class="time-preview"><Clock3 :size="15"/><span>{{ startsAt ? formatTime(new Date(startsAt).toISOString()) : 'Choose a time' }}</span></div></div></div>
        <div class="plan-field"><span>WHERE? <small>OPTIONAL</small></span><LocationPicker v-model="selectedLocation"/></div>
        <details class="extra-details"><summary>Add a description <ChevronRight :size="14"/></summary><textarea v-model="description" class="field" rows="2" maxlength="1000" placeholder="Extra details for the group..."/></details>
        <p v-if="error" class="form-error">{{ error }}</p>
        <footer class="plan-form-footer"><span><MapPin :size="13"/> Visible to this community</span><button class="primary-button" :disabled="saving || !title.trim() || !startsAt"><LoaderCircle v-if="saving" class="spin" :size="14"/><Sparkles v-else :size="14"/> {{ saving ? 'Creating...' : 'Create plan' }}</button></footer>
      </form>
    </section></div>
  </div>
</template>
<style scoped>
.section-label{display:flex;align-items:center;justify-content:space-between;margin:25px 0 12px}.section-label h2{margin:0;color:#a7adbc;font-size:9px;letter-spacing:.16em}.section-label>span{color:#707789;font-size:9px}.event-list{display:flex;flex-direction:column;gap:11px}.event-card{display:flex;gap:16px;padding:17px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(145deg,#171a23,#12141b)}.event-date{width:55px;height:62px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #a18bff25;border-radius:10px;background:#a18bff12;color:#b9a7ff}.event-date strong{font-family:'Space Grotesk';font-size:24px;line-height:1}.event-date span{margin-top:4px;font-size:8px;font-weight:800;letter-spacing:.1em}.event-main{min-width:0;flex:1}.event-topline{display:flex;align-items:center;justify-content:space-between;gap:8px}.event-going{color:#8fe0bb;font-size:9px}.event-main h3{margin:9px 0 5px;font-family:'Space Grotesk';font-size:16px}.event-main>p{margin:0 0 7px;color:#8b92a2;font-size:10px;line-height:1.5}.event-location{display:flex;align-items:center;gap:5px;color:#81899a;font-size:9px}.event-location a{margin-left:5px;color:#b9a7ff;text-decoration:underline}.rsvp-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.rsvp-actions .share-btn{margin-left:auto;color:#b9a7ff}.rsvp-actions button{display:flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;background:#ffffff04;color:#81899a;font-size:9px}.rsvp-actions button.chosen{border-color:#9b83ff55;background:#9b83ff18;color:#c5b7ff}.past-label{margin-top:30px}.past-list{display:flex;flex-direction:column;gap:8px}
.plan-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;background:#05060bd9;backdrop-filter:blur(12px)}.plan-modal{width:min(100%,680px);max-height:min(92vh,900px);overflow:auto;border:1px solid #ffffff12;border-radius:18px;background:#12141c;box-shadow:0 30px 100px #000b}.plan-modal-head{display:flex;justify-content:space-between;gap:20px;padding:23px 25px 18px;border-bottom:1px solid var(--line)}.plan-modal-head h2{margin:9px 0 5px;font-family:'Space Grotesk';font-size:25px;letter-spacing:-.04em}.plan-modal-head p{margin:0;color:#858b9b;font-size:11px}.plan-form{display:flex;flex-direction:column;gap:19px;padding:21px 25px 23px}.plan-field{display:flex;flex-direction:column;gap:9px}.plan-field>span,.date-time-grid label>span{color:#9da3b2;font-size:9px;font-weight:800;letter-spacing:.14em}.plan-field>span small{color:#626a7b;font-size:8px}.plan-title-input{height:48px;font-family:'Space Grotesk';font-size:15px}.quick-dates{display:flex;gap:7px}.quick-dates button{padding:7px 11px;border:1px solid var(--line);border-radius:7px;background:#ffffff05;color:#aeb3c0;font-size:9px}.quick-dates button:hover{border-color:#9b83ff66;color:#d4caff;background:#9b83ff12}.date-time-grid{display:grid;grid-template-columns:minmax(0,1fr) 140px;align-items:end;gap:10px}.date-time-grid label{display:flex;flex-direction:column;gap:7px}.time-preview{height:40px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid var(--line);border-radius:8px;background:#171a23;color:#b9a7ff;font-size:10px}.extra-details{border-top:1px solid var(--line);padding-top:13px}.extra-details summary{display:flex;align-items:center;gap:5px;color:#9ba2b2;font-size:10px;cursor:pointer;list-style:none}.extra-details[open] summary{margin-bottom:10px}.extra-details[open] summary svg{transform:rotate(90deg)}.extra-details textarea{width:100%;resize:vertical}.plan-form-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:13px;border-top:1px solid var(--line)}.plan-form-footer>span{display:flex;align-items:center;gap:6px;color:#777f90;font-size:9px}.form-error{margin:0;color:#ff9aab;font-size:10px}@media(max-width:560px){.plan-overlay{align-items:flex-end;padding:0}.plan-modal{width:100%;max-height:94dvh;border-radius:18px 18px 0 0}.plan-modal-head{padding:19px 17px 15px}.plan-form{padding:17px}.date-time-grid{grid-template-columns:minmax(0,1fr) 112px}.location-map{height:210px}.plan-form-footer{align-items:flex-start;flex-direction:column}.plan-form-footer .primary-button{width:100%}.quick-dates{flex-wrap:wrap}}
</style>
