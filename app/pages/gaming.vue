<script setup lang="ts">
import { Plus, Swords, Trophy, Clapperboard, Trash2, Minus, Share2 } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const me = useMe()
const route = useRoute()
const router = useRouter()
const community = useCommunity()
const crew = useCrew()
const toast = useToast()

const gaming = useGamingData()
// hide lobbies past their 3h window even if this screen has been open for a while
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => { tick = setInterval(() => (now.value = Date.now()), 60_000) })
onBeforeUnmount(() => clearInterval(tick))
const lobbies = computed({
  get: () => gaming.data.value.lobbies.filter((l: any) => new Date(l.starts_at).getTime() + LOBBY_MS > now.value),
  set: (v) => { gaming.data.value = { ...gaming.data.value, lobbies: v } },
})
const endsAt = (l: any) => new Date(new Date(l.starts_at).getTime() + LOBBY_MS).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
const clips = computed(() => gaming.data.value.clips)
const urls = computed(() => gaming.data.value.urls)
const loading = computed(() => !gaming.loaded.value)
const game = ref('Todos')

const games = computed(() => ['Todos', ...new Set(clips.value.map(c => c.game_title || 'Outros'))])
const shownClips = computed(() => game.value === 'Todos' ? clips.value : clips.value.filter(c => (c.game_title || 'Outros') === game.value))
/** most-reacted clip of the last 7 days */
const clipOfWeek = computed(() => {
  const week = Date.now() - 7 * 86400000
  return [...clips.value].filter(c => new Date(c.created_at).getTime() > week && c.score > 0).sort((a, b) => b.score - a.score)[0] || null
})
const recentGames = computed(() => [...new Set([...lobbies.value.map(l => l.game), ...clips.value.map(c => c.game_title).filter(Boolean), 'CS2', 'Fortnite', 'Project Zomboid', 'EA FC'])].slice(0, 6))

const load = () => gaming.refresh()

const inLobby = (l: any) => l.players.includes(me.value?.id)
async function toggleLobby(l: any, e: MouseEvent) {
  if (!me.value) return
  if (inLobby(l)) {
    l.players = l.players.filter((id: string) => id !== me.value!.id)
    const { error } = await supabase.from('game_call_players').delete().eq('call_id', l.id).eq('user_id', me.value.id)
    if (error) { toast.error(error.message); load() }
  } else {
    if (l.players.length >= l.slots) return toast.error('Lobby cheio.')
    l.players = [...l.players, me.value.id]
    celebrate(originFrom(e))
    const { error } = await supabase.from('game_call_players').insert({ call_id: l.id, user_id: me.value.id })
    if (error) { toast.error(error.message); load() }
    else if (l.players.length === l.slots) toast.ok('Lobby cheio. GG!')
  }
}
async function removeLobby(l: any) {
  const { error } = await supabase.from('game_calls').delete().eq('id', l.id)
  if (error) return toast.error(error.message)
  lobbies.value = lobbies.value.filter(x => x.id !== l.id)
}
function shareLobby(l: any) {
  shareOut(`🎮 Quem joga ${l.game}? ${until(l.starts_at)} — ${l.players.length}/${l.slots}. Entra:`, '/gaming')
}

// ── new lobby ───────────────────────────────────────────
const creating = ref(false)
const newGame = ref('')
const when = ref('')
const slots = ref(5)
const saving = ref(false)
const times = computed(() => {
  const now = new Date(); now.setMinutes(now.getMinutes() + 5, 0, 0)
  return [{ label: 'Agora', d: now }, { label: '21h', d: nextAt(21) }, { label: '22h', d: nextAt(22) }, { label: '23h', d: nextAt(23) }]
})
function openCreate() { newGame.value = recentGames.value[0] || ''; when.value = toLocalInput(times.value[0]!.d); slots.value = 5; creating.value = true }
async function createLobby(e: MouseEvent) {
  if (!community.value || !newGame.value.trim()) return
  saving.value = true
  const { error } = await supabase.from('game_calls').insert({ group_id: community.value, created_by: me.value!.id, game: newGame.value.trim(), starts_at: new Date(when.value).toISOString(), slots: slots.value })
  saving.value = false
  if (error) return toast.error(error.message)
  creating.value = false
  celebrate(originFrom(e))
  toast.ok('Lobby aberto!')
  load()
}

watch(() => route.query.new, (n) => { if (n) { router.replace({ query: {} }); afterPageEnter(() => openCreate()) } }, { immediate: true })
watch(community, load)
onMounted(load)
</script>

<template>
  <div class="gaming">
    <header class="page-head">
      <div>
        <p class="kicker">Gaming</p>
        <h1 class="display h-xl">Quem<br>joga<span class="t-sky">?</span></h1>
      </div>
      <button class="btn btn-sky" @click="openCreate"><Swords :size="18" /> Lobby</button>
    </header>

    <!-- lobbies -->
    <div v-if="loading && !lobbies.length" class="skeleton" style="height:150px" />
    <TransitionGroup v-else-if="lobbies.length" name="list" tag="div" class="flex flex-col gap-4 relative">
      <article v-for="l in lobbies" :key="l.id" class="lobby sticker">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="kicker lobby-kicker">{{ until(l.starts_at) }} · {{ crew.nameOf(l.created_by) }} · até às {{ endsAt(l) }}</p>
            <h2 class="display lobby-game">{{ l.game }}</h2>
          </div>
          <div class="flex gap-1">
            <button class="mini" aria-label="Partilhar" @click="shareLobby(l)"><Share2 :size="15" /></button>
            <button v-if="l.created_by === me?.id" class="mini" aria-label="Fechar lobby" @click="removeLobby(l)"><Trash2 :size="15" /></button>
          </div>
        </div>
        <div class="slots">
          <span v-for="i in l.slots" :key="i" class="slot" :class="{ filled: i <= l.players.length }">
            <Avatar v-if="l.players[i - 1]" :name="crew.nameOf(l.players[i - 1])" :color="crew.colorOf(l.players[i - 1])" :size="38" />
          </span>
        </div>
        <div class="flex items-center justify-between gap-3 mt-4">
          <b class="num text-2xl">{{ l.players.length }}/{{ l.slots }}</b>
          <button class="btn" :class="inLobby(l) ? 'btn-ghost-dark' : 'btn-ink'" :disabled="!inLobby(l) && l.players.length >= l.slots" @click="toggleLobby(l, $event)">
            {{ inLobby(l) ? 'Sair' : l.players.length >= l.slots ? 'Cheio' : 'Entrar' }}
          </button>
        </div>
      </article>
    </TransitionGroup>
    <button v-else class="lobby-empty" @click="openCreate">
      <Swords :size="22" class="t-sky" />
      <span><b>Nenhum lobby aberto.</b><br><span class="muted">Abre um e o Discord avisa a malta.</span></span>
      <Plus :size="20" />
    </button>

    <!-- clip of the week -->
    <section v-if="clipOfWeek" class="cotw">
      <div class="cotw-badge fill-sun"><Trophy :size="16" /> Clip da semana</div>
      <img v-if="clipOfWeek.media_type === 'image'" :src="urls[clipOfWeek.id]" alt="" class="cotw-img">
      <ClipVideo v-else :src="urls[clipOfWeek.id]" />
      <div class="cotw-info">
        <Avatar :name="crew.nameOf(clipOfWeek.author_id)" :color="crew.colorOf(clipOfWeek.author_id)" :size="36" />
        <div class="min-w-0 flex-1"><strong class="block truncate">{{ clipOfWeek.body }}</strong><small class="muted">{{ crew.nameOf(clipOfWeek.author_id) }} · {{ clipOfWeek.game_title || 'Outros' }} · {{ clipOfWeek.score }} reações</small></div>
      </div>
    </section>

    <!-- library -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <h2 class="display h-md m-0">Clips</h2>
        <NuxtLink to="/?new=clip" class="btn btn-ghost btn-sm"><Clapperboard :size="15" /> Enviar</NuxtLink>
      </div>
      <div v-if="games.length > 2" class="flex gap-2 overflow-x-auto mb-4" style="scrollbar-width:none">
        <button v-for="g in games" :key="g" class="chip" :class="{ on: game === g }" @click="game = g">{{ g }}</button>
      </div>
      <div v-if="!shownClips.length && !loading" class="empty">
        <p class="display">Zero highlights.</p>
        <p class="muted m-0">Grava a próxima jogada absurda e manda para aqui.</p>
      </div>
      <div class="clip-grid stagger">
        <article v-for="c in shownClips" :key="c.id" class="clip">
          <img v-if="c.media_type === 'image'" :src="urls[c.id]" alt="" loading="lazy" class="clip-img">
          <ClipVideo v-else :src="urls[c.id]" />
          <div class="clip-meta">
            <span class="tag fill-sky">{{ c.game_title || 'Outros' }}</span>
            <strong class="truncate">{{ c.body }}</strong>
            <small class="faint">{{ crew.nameOf(c.author_id) }} · {{ ago(c.created_at) }}</small>
          </div>
        </article>
      </div>
    </section>

    <Sheet :open="creating" kicker="Quem joga?" title="Abrir lobby" @close="creating = false">
      <div class="flex flex-col gap-5">
        <div>
          <span class="label">Jogo</span>
          <input v-model="newGame" class="field title-field" maxlength="60" placeholder="CS2, Zomboid…">
          <div class="flex gap-2 flex-wrap mt-2"><button v-for="g in recentGames" :key="g" class="chip" :class="{ on: newGame === g }" @click="newGame = g">{{ g }}</button></div>
        </div>
        <div>
          <span class="label">Quando</span>
          <div class="flex gap-2 flex-wrap mb-2"><button v-for="t in times" :key="t.label" class="chip" :class="{ on: when === toLocalInput(t.d) }" @click="when = toLocalInput(t.d)">{{ t.label }}</button></div>
          <input v-model="when" type="datetime-local" class="field">
        </div>
        <div>
          <span class="label">Lugares</span>
          <div class="stepper">
            <button class="icon-btn" aria-label="Menos" :disabled="slots <= 2" @click="slots--"><Minus :size="18" /></button>
            <span class="num text-4xl">{{ slots }}</span>
            <button class="icon-btn" aria-label="Mais" :disabled="slots >= 20" @click="slots++"><Plus :size="18" /></button>
          </div>
        </div>
        <button class="btn btn-sky btn-block" :disabled="saving || !newGame.trim()" @click="createLobby">{{ saving ? 'A abrir…' : 'Abrir lobby' }}</button>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.gaming { display: flex; flex-direction: column; gap: 22px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-top: 8px; }
.page-head h1 { margin: 4px 0 0; }
.btn-sky { background: var(--sky); color: var(--on-color); box-shadow: var(--sticker-shadow); }
.btn-ink { background: var(--ink); color: var(--paper); border-color: #000; }
.btn-ghost-dark { background: transparent; color: var(--on-color); border-color: #000; }
.lobby { padding: 18px; background: var(--sky); color: var(--on-color); }
.lobby-kicker { color: #0c0c0e99; }
.lobby-game { margin: 6px 0 0; font-size: 38px; overflow-wrap: anywhere; }
.mini { display: grid; place-items: center; width: 36px; height: 36px; border: 2px solid #000; border-radius: 999px; background: #ffffff55; }
.slots { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.slot { display: grid; place-items: center; width: 42px; height: 42px; border: 2px dashed #0c0c0e66; border-radius: 999px; }
.slot.filled { border: 0; animation: pop-in var(--slow) var(--ease-spring) both; }
.lobby-empty { display: flex; align-items: center; gap: 14px; width: 100%; padding: 18px; border: 2px dashed var(--line-strong); border-radius: var(--r-lg); background: none; text-align: left; transition: border-color var(--fast); }
.lobby-empty:hover { border-color: var(--sky); }
.lobby-empty > span { flex: 1; }
.cotw { position: relative; overflow: hidden; border: 2px solid #000; border-radius: var(--r-lg); background: var(--ink-2); box-shadow: 6px 6px 0 var(--sun); }
.cotw-badge { position: absolute; z-index: 2; top: 12px; left: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 2px solid #000; border-radius: 999px; font-weight: 800; font-size: 13px; transform: rotate(-3deg); }
.cotw video, .cotw-img { display: block; width: 100%; aspect-ratio: 16/9; background: #000; object-fit: contain; }
.cotw-info { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
.clip-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 560px) { .clip-grid { grid-template-columns: 1fr 1fr; } }
.clip { overflow: hidden; border: 1.5px solid var(--line); border-radius: var(--r-md); background: var(--ink-2); }
.clip video, .clip-img { display: block; width: 100%; aspect-ratio: 16/9; background: #000; object-fit: cover; }
.clip-meta { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 12px 12px; }
.clip-meta strong { max-width: 100%; }
.stepper { display: flex; align-items: center; gap: 20px; }
.title-field { font-family: var(--font-display); font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
</style>
