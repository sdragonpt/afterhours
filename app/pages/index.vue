<script setup lang="ts">
import { ArrowUpRight, ImagePlus, Plus, Send, X, MapPin, Sparkles, Clapperboard, BarChart3, PenLine } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const me = useMe()
const route = useRoute()
const router = useRouter()
const community = useCommunity()
const crew = useCrew()
const ledger = useLedger()
const toast = useToast()

const feed = useFeed()
const plans = usePlans()
const posts = computed({ get: () => feed.data.value.posts, set: (v) => { feed.data.value = { ...feed.data.value, posts: v } } })
const mediaUrls = computed(() => feed.data.value.urls)
const nextPlan = computed(() => plans.data.value.find((e: any) => new Date(e.starts_at).getTime() > Date.now() - 3 * 3600000) || null)
const loading = computed(() => !feed.loaded.value)
const filter = ref<'Tudo' | 'Gaming' | 'IRL' | 'Sondagens'>('Tudo')
const shown = computed(() => {
  if (filter.value === 'Tudo') return posts.value
  if (filter.value === 'Sondagens') return posts.value.filter(p => p.poll)
  return posts.value.filter(p => p.category === filter.value)
})

const firstName = computed(() => (crew.meMember.value?.name || me.value?.email?.split('@')[0] || '').split(' ')[0])
const onVibe = computed(() => crew.members.value.filter(m => m.vibe && m.user_id !== me.value?.id))
const myVibe = computed(() => crew.meMember.value?.vibe ? VIBES[crew.meMember.value.vibe] : null)
const iAmGoing = computed(() => nextPlan.value?.rsvps?.some((r: any) => r.user_id === me.value?.id && r.status === 'going'))
const goingIds = computed<string[]>(() => (nextPlan.value?.rsvps || []).filter((r: any) => r.status === 'going').map((r: any) => r.user_id))
const myDebt = computed(() => ledger.myTransfers.value)

// ── load ────────────────────────────────────────────────
const gamingData = useGamingData()
function load() {
  if (!community.value || !me.value) return
  feed.refresh(); plans.refresh(); ledger.load(); gamingData.refresh()
}

async function goToPlan(e: MouseEvent) {
  if (!nextPlan.value || !me.value) return
  const status = iAmGoing.value ? 'maybe' : 'going'
  const { error } = await supabase.from('event_rsvps').upsert({ event_id: nextPlan.value.id, user_id: me.value.id, status, updated_at: new Date().toISOString() }, { onConflict: 'event_id,user_id' })
  if (error) return toast.error(error.message)
  nextPlan.value.rsvps = [...nextPlan.value.rsvps.filter((r: any) => r.user_id !== me.value!.id), { user_id: me.value.id, status }]
  if (status === 'going') { celebrate(originFrom(e)); toast.ok('Tás dentro!') }
}

// ── composer ────────────────────────────────────────────
type Mode = 'post' | 'poll' | 'clip'
const composer = ref<Mode | null>(null)
const body = ref('')
const category = ref<'Random' | 'IRL' | 'Gaming'>('Random')
const options = ref<string[]>(['', ''])
const file = ref<File | null>(null)
const preview = ref('')
const gameTitle = ref('')
const posting = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function openComposer(mode: Mode) {
  composer.value = mode
  body.value = ''; options.value = ['', '']; file.value = null; preview.value = ''; gameTitle.value = ''
  category.value = mode === 'clip' ? 'Gaming' : 'Random'
}
function pickFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] || null
  // big clips are fine: they get compressed before upload. Photos stay under the cap.
  if (f && !f.type.startsWith('video/') && f.size > MAX_UPLOAD_BYTES) { toast.error('Fotos até 100 MB.'); return }
  if (f && f.size > 2 * 1024 * 1024 * 1024) { toast.error('Clip demasiado grande (máx. 2 GB antes de comprimir).'); return }
  file.value = f
  preview.value = f ? URL.createObjectURL(f) : ''
}

const media = useMedia()
const stage = ref<null | 'compress' | 'upload' | 'save'>(null)
const progress = ref(0)
const savedNote = ref('')

/** compress → upload (shared with comments) → storage_path */
async function sendFile(f: File) {
  const r = await media.send(f, community.value!, me.value!.id, (s, p) => { stage.value = s; progress.value = p })
  savedNote.value = r.note
  return r
}
const canPost = computed(() => {
  if (composer.value === 'poll') return body.value.trim() && options.value.filter(o => o.trim()).length >= 2
  if (composer.value === 'clip') return !!file.value
  return body.value.trim() || file.value
})

async function publish(e: MouseEvent) {
  if (!community.value || !me.value || !canPost.value) return
  posting.value = true; savedNote.value = ''
  // 1) media first — if it fails, no empty post is created
  let sent: { path: string; file: File } | null = null
  if (file.value) {
    try { sent = await sendFile(file.value) } catch (err: any) {
      posting.value = false; stage.value = null
      return toast.error(err?.message || 'Falha no envio')
    }
  }
  stage.value = 'save'
  const text = body.value.trim() || (composer.value === 'clip' ? 'Olhem para isto 👀' : '📸')
  const { data: post, error } = await supabase.from('posts').insert({ group_id: community.value, author_id: me.value.id, body: text, category: category.value }).select('id').single()
  if (error) { posting.value = false; stage.value = null; if (sent) media.remove(sent.path); return toast.error(error.message) }
  if (composer.value === 'poll') {
    const { error: pe } = await supabase.from('post_polls').insert({ post_id: post.id, group_id: community.value, options: options.value.map(o => o.trim()).filter(Boolean) })
    if (pe) toast.error(pe.message)
  }
  if (sent) {
    const f = sent.file
    const { error: me2 } = await supabase.from('post_media').insert({ post_id: post.id, group_id: community.value, storage_path: sent.path, media_type: f.type.startsWith('video/') ? 'video' : 'image', file_name: f.name, file_size: f.size, game_title: gameTitle.value.trim() || null })
    if (me2) toast.error(me2.message)
  }
  posting.value = false; stage.value = null
  const mode = composer.value
  composer.value = null
  celebrate(originFrom(e))
  toast.ok(mode === 'clip' ? 'Clip no ar!' : mode === 'poll' ? 'Sondagem lançada!' : 'Publicado!')
  await load()
}

// ── comments ────────────────────────────────────────────
const commentsFor = ref<string | null>(null)
const commentRows = ref<any[]>([])
const commentText = ref('')
const commentPhoto = ref<File | null>(null)
const commentPhotoPreview = ref('')
const commentBusy = ref(false)
const commentUrls = ref<Record<string, string>>({})
const commentInput = ref<HTMLInputElement | null>(null)
async function openComments(id: string) {
  commentsFor.value = id; commentRows.value = []; commentText.value = ''; clearCommentPhoto()
  const { data } = await supabase.from('post_comments').select('id,user_id,body,media_path,created_at').eq('post_id', id).order('created_at')
  commentRows.value = data || []
  const paths = commentRows.value.map(c => c.media_path).filter(Boolean)
  if (paths.length) commentUrls.value = { ...commentUrls.value, ...(await media.sign(paths)) }
}
function pickCommentPhoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] || null
  if (f && !f.type.startsWith('image/')) return toast.error('Nos comentários só fotos.')
  commentPhoto.value = f
  commentPhotoPreview.value = f ? URL.createObjectURL(f) : ''
}
function clearCommentPhoto() { commentPhoto.value = null; commentPhotoPreview.value = ''; if (commentInput.value) commentInput.value.value = '' }
async function addComment() {
  if (!commentsFor.value || (!commentText.value.trim() && !commentPhoto.value) || !me.value) return
  commentBusy.value = true
  let mediaPath: string | null = null
  if (commentPhoto.value) {
    try { mediaPath = (await media.send(commentPhoto.value, community.value!, me.value.id)).path }
    catch (err: any) { commentBusy.value = false; return toast.error(err?.message || 'Falha no envio da foto') }
  }
  const row = { post_id: commentsFor.value, group_id: community.value, user_id: me.value.id, body: commentText.value.trim() || '📷', media_path: mediaPath }
  const preview = commentPhotoPreview.value
  commentText.value = ''; commentPhoto.value = null; commentPhotoPreview.value = ''
  const { data, error } = await supabase.from('post_comments').insert(row).select('id,user_id,body,media_path,created_at').single()
  commentBusy.value = false
  if (error) { if (mediaPath) media.remove(mediaPath); return toast.error(error.message) }
  if (mediaPath && preview) commentUrls.value = { ...commentUrls.value, [mediaPath]: preview }
  commentRows.value.push(data)
  const p = posts.value.find(x => x.id === row.post_id); if (p) p.comment_count++
}

const showVibe = ref(false)

// open composer from the global "+" sheet
watch(() => route.query.new, (n) => {
  if (n === 'post' || n === 'poll' || n === 'clip') { router.replace({ query: {} }); afterPageEnter(() => openComposer(n)) }
}, { immediate: true })
watch([community, () => me.value?.id], load)
onMounted(load)
</script>

<template>
  <div class="home">
    <!-- greeting -->
    <section class="hello">
      <p class="kicker">{{ new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
      <h1 class="display h-xl">{{ greeting() }},<br>{{ firstName }}<span class="t-lime">.</span></h1>
    </section>

    <!-- who's around -->
    <section class="vibe-strip">
      <button class="vibe-me" @click="showVibe = true">
        <Avatar :name="crew.meMember.value?.name || 'Tu'" :color="crew.meMember.value?.color" :vibe="crew.meMember.value?.vibe" :size="54" ring />
        <span class="vibe-label" :class="myVibe ? `fill-${myVibe.color}` : 'vibe-empty'">{{ myVibe ? myVibe.short : 'A tua vibe' }}</span>
      </button>
      <div v-for="m in onVibe" :key="m.user_id" class="vibe-friend">
        <Avatar :name="m.name" :color="m.color" :vibe="m.vibe" :size="54" />
        <span class="vibe-label" :class="`fill-${VIBES[m.vibe!].color}`">{{ VIBES[m.vibe!].short }}</span>
        <small class="vibe-name">{{ m.name.split(' ')[0] }}</small>
      </div>
      <p v-if="!onVibe.length" class="vibe-hint muted">Ninguém disse nada ainda. Começa tu: diz à malta se bora sair ou jogar.</p>
    </section>

    <!-- live / starting-soon lobbies -->
    <LiveLobbies />

    <!-- next plan poster -->
    <NuxtLink v-if="nextPlan" to="/plans" class="poster sticker fill-coral">
      <div class="flex items-center justify-between">
        <span class="kicker poster-kicker">Próximo plano</span>
        <ArrowUpRight :size="22" />
      </div>
      <h2 class="display poster-title">{{ nextPlan.title }}</h2>
      <p class="poster-when display">{{ until(nextPlan.starts_at) }}</p>
      <p v-if="nextPlan.location" class="poster-where"><MapPin :size="14" /> {{ nextPlan.location.split(',')[0] }}</p>
      <div class="poster-foot">
        <span class="flex items-center gap-2"><AvatarStack :ids="goingIds" :size="30" /><b v-if="goingIds.length">{{ goingIds.length }} vão</b><b v-else>Ninguém ainda</b></span>
        <button class="btn btn-sm poster-btn" :class="iAmGoing ? 'is-going' : ''" @click.prevent="goToPlan">{{ iAmGoing ? 'Tás dentro ✓' : 'Tô dentro' }}</button>
      </div>
    </NuxtLink>
    <NuxtLink v-else to="/plans?new=1" class="poster-empty">
      <Sparkles :size="20" class="t-lime" />
      <span><b>Nenhum plano à vista.</b><br><span class="muted">Sê tu a puxar pela malta.</span></span>
      <Plus :size="20" />
    </NuxtLink>

    <NotifyCard compact />

    <!-- money nudge -->
    <NuxtLink to="/tab" class="money" :class="ledger.myBalance.value < -0.004 ? 'owe' : ledger.myBalance.value > 0.004 ? 'get' : 'clean'">
      <span class="kicker">The Tab</span>
      <span v-if="ledger.myBalance.value < -0.004" class="money-line">Deves <b class="num">{{ euros(-ledger.myBalance.value) }}</b><template v-if="myDebt.length === 1"> a {{ crew.nameOf(myDebt[0]!.to) }}</template></span>
      <span v-else-if="ledger.myBalance.value > 0.004" class="money-line">Tens <b class="num">{{ euros(ledger.myBalance.value) }}</b> a receber</span>
      <span v-else class="money-line">Estás limpo. Respeito.</span>
      <ArrowUpRight :size="18" />
    </NuxtLink>

    <!-- composer launcher -->
    <section class="compose-row">
      <button class="compose-main" @click="openComposer('post')"><PenLine :size="18" /> O que se passa?</button>
      <button class="icon-btn" aria-label="Sondagem" @click="openComposer('poll')"><BarChart3 :size="18" /></button>
      <button class="icon-btn" aria-label="Clip" @click="openComposer('clip')"><Clapperboard :size="18" /></button>
    </section>

    <!-- feed -->
    <div class="filters">
      <button v-for="f in ['Tudo', 'IRL', 'Gaming', 'Sondagens'] as const" :key="f" class="chip" :class="{ on: filter === f }" @click="filter = f">{{ f }}</button>
    </div>

    <div v-if="loading && !posts.length" class="flex flex-col gap-3 mt-4">
      <div v-for="i in 3" :key="i" class="skeleton" style="height:110px" />
    </div>
    <div v-else-if="!shown.length" class="empty">
      <p class="display">Silêncio total.</p>
      <p class="muted m-0">Manda a primeira foto, meme ou sondagem.</p>
      <button class="btn btn-primary mt-5" @click="openComposer('post')"><Plus :size="18" /> Publicar</button>
    </div>
    <TransitionGroup v-else name="list" tag="div" class="relative">
      <PostCard v-for="p in shown" :key="p.id" :post="p" :media-url="mediaUrls[p.id]" @comments="openComments" @changed="load" @deleted="(id: string) => posts = posts.filter(x => x.id !== id)" />
    </TransitionGroup>

    <!-- sheets -->
    <Sheet :open="!!composer" :kicker="composer === 'poll' ? 'Decidam já' : composer === 'clip' ? 'Highlight' : 'Para a malta'" :title="composer === 'poll' ? 'Nova sondagem' : composer === 'clip' ? 'Novo clip' : 'Novo post'" @close="composer = null">
      <div class="flex flex-col gap-4">
        <textarea v-model="body" class="field" rows="3" maxlength="2000" :placeholder="composer === 'poll' ? 'Onde é o jantar de sábado?' : composer === 'clip' ? 'Conta o contexto…' : 'Diz qualquer coisa…'" />

        <div v-if="composer === 'poll'" class="flex flex-col gap-2">
          <TransitionGroup name="list" tag="div" class="flex flex-col gap-2">
            <div v-for="(o, i) in options" :key="i" class="flex gap-2">
              <input v-model="options[i]" class="field" maxlength="60" :placeholder="`Opção ${i + 1}`">
              <button v-if="options.length > 2" class="icon-btn self-center" aria-label="Remover opção" @click="options.splice(i, 1)"><X :size="16" /></button>
            </div>
          </TransitionGroup>
          <button v-if="options.length < 6" class="btn btn-ghost btn-sm self-start" @click="options.push('')"><Plus :size="15" /> Opção</button>
        </div>

        <template v-else>
          <div class="flex gap-2 flex-wrap">
            <button v-for="c in (['Random', 'IRL', 'Gaming'] as const)" :key="c" class="chip" :class="{ on: category === c }" @click="category = c">{{ c === 'Random' ? 'Random' : c }}</button>
          </div>
          <input ref="fileInput" type="file" class="hidden" accept="image/*,video/mp4,video/webm,video/quicktime" @change="pickFile">
          <button v-if="!file" class="drop" @click="fileInput?.click()"><ImagePlus :size="26" /><span>{{ composer === 'clip' ? 'Vídeo ou screenshot' : 'Foto ou vídeo' }}</span><small class="faint">clips são comprimidos sem perder qualidade</small></button>
          <div v-else class="drop-preview">
            <video v-if="file.type.startsWith('video/')" :src="preview" muted playsinline autoplay loop />
            <img v-else :src="preview" alt="">
            <button class="icon-btn" aria-label="Remover" @click="file = null; preview = ''"><X :size="16" /></button>
          </div>
          <input v-if="category === 'Gaming'" v-model="gameTitle" class="field" maxlength="60" placeholder="Jogo (ex.: CS2, Zomboid)">
        </template>

        <div v-if="stage" class="upload-progress">
          <div class="flex justify-between text-sm font-bold">
            <span>{{ stage === 'compress' ? 'A comprimir sem perder qualidade…' : stage === 'upload' ? 'A enviar…' : 'Quase…' }}</span>
            <span v-if="stage !== 'save'" class="num">{{ Math.round(progress * 100) }}%</span>
          </div>
          <div class="bar"><i :style="{ transform: `scaleX(${stage === 'save' ? 1 : progress})` }" /></div>
          <small v-if="savedNote" class="t-lime font-bold">{{ savedNote }}</small>
        </div>
        <button class="btn btn-primary btn-block" :disabled="!canPost || posting" @click="publish">
          <Send :size="17" /> {{ posting ? 'A enviar…' : 'Publicar' }}
        </button>
      </div>
    </Sheet>

    <Sheet :open="!!commentsFor" kicker="Conversa" title="Comentários" @close="commentsFor = null">
      <TransitionGroup name="list" tag="div" class="flex flex-col gap-4 relative">
        <div v-for="c in commentRows" :key="c.id" class="flex gap-3">
          <Avatar :name="crew.nameOf(c.user_id)" :color="crew.colorOf(c.user_id)" :size="32" />
          <div class="min-w-0 flex-1"><strong class="text-sm">{{ crew.nameOf(c.user_id) }}</strong> <span class="faint text-xs">{{ ago(c.created_at) }}</span><p v-if="c.body && !(c.media_path && c.body === '📷')" class="m-0 mt-1">{{ c.body }}</p><img v-if="c.media_path && commentUrls[c.media_path]" :src="commentUrls[c.media_path]" alt="" class="comment-photo" loading="lazy"></div>
        </div>
      </TransitionGroup>
      <p v-if="!commentRows.length" class="muted text-center">Ainda ninguém comentou.</p>
      <div v-if="commentPhotoPreview" class="comment-attach"><img :src="commentPhotoPreview" alt=""><button class="icon-btn" aria-label="Remover foto" @click="clearCommentPhoto"><X :size="15" /></button></div>
      <form class="flex gap-2 mt-5" @submit.prevent="addComment">
        <input ref="commentInput" type="file" accept="image/*" class="hidden" @change="pickCommentPhoto">
        <button type="button" class="icon-btn self-center" aria-label="Juntar foto" @click="commentInput?.click()"><ImagePlus :size="18" /></button>
        <input v-model="commentText" class="field" maxlength="1000" placeholder="Escreve…">
        <button class="btn btn-primary" :disabled="commentBusy || (!commentText.trim() && !commentPhoto)" aria-label="Enviar"><Send :size="17" /></button>
      </form>
    </Sheet>

    <Sheet :open="showVibe" kicker="Como estás hoje?" title="A tua vibe" @close="showVibe = false">
      <VibePicker @done="showVibe = false" />
    </Sheet>
  </div>
</template>

<style scoped>
.home { display: flex; flex-direction: column; gap: 18px; }
.hello { padding-top: 8px; animation: pop-in var(--slow) var(--ease-spring) both; }
.hello h1 { margin: 6px 0 0; }

.vibe-strip { display: flex; gap: 14px; overflow-x: auto; margin: 0 -16px; padding: 4px 16px 6px; scrollbar-width: none; }
.vibe-me, .vibe-friend { display: flex; flex-direction: column; align-items: center; gap: 0; flex: none; background: none; border: 0; padding: 0; }
.vibe-label { margin-top: -10px; position: relative; z-index: 1; padding: 3px 9px; border: 2px solid #000; border-radius: 999px; font-size: 11px; font-weight: 800; white-space: nowrap; transform: rotate(-3deg); }
.vibe-empty { background: var(--ink-3); color: var(--muted); border-color: var(--line-strong); }
.vibe-name { margin-top: 4px; color: var(--muted); font-size: 12px; font-weight: 600; }
.vibe-hint { align-self: center; max-width: 220px; margin: 0; font-size: 13px; line-height: 1.35; }

.poster { display: flex; flex-direction: column; gap: 4px; padding: 20px; transform: rotate(-1.2deg); transition: transform var(--base) var(--ease-spring); animation: pop-in var(--slow) var(--ease-spring) 80ms both; }
.poster:hover { transform: rotate(0deg) translateY(-2px); }
.poster:active { transform: rotate(0) scale(.98); }
.poster-kicker { color: #0c0c0ea6; }
.poster-title { margin: 10px 0 0; font-size: clamp(34px, 10vw, 52px); }
.poster-when { margin: 4px 0 0; font-size: 22px; font-weight: 700; opacity: .8; }
.poster-where { display: flex; align-items: center; gap: 5px; margin: 6px 0 0; font-weight: 600; }
.poster-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 16px; }
.poster-btn { background: var(--ink); color: var(--paper); border-color: #000; }
.poster-btn.is-going { background: var(--paper); color: var(--on-color); }
.poster-empty { display: flex; align-items: center; gap: 14px; padding: 18px; border: 2px dashed var(--line-strong); border-radius: var(--r-lg); transition: border-color var(--fast); }
.poster-empty:hover { border-color: var(--lime); }
.poster-empty > span { flex: 1; }

.money { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1.5px solid var(--line); border-radius: var(--r-md); background: var(--ink-2); transition: border-color var(--fast); }
.money .kicker { flex: none; }
.money-line { flex: 1; font-weight: 600; }
.money.owe { border-color: #ff5a3666; } .money.owe b { color: var(--coral); }
.money.get b { color: var(--lime); }

.compose-row { display: flex; gap: 8px; }
.compose-main { flex: 1; display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 16px; border: 1.5px solid var(--line-strong); border-radius: 999px; background: var(--ink-2); color: var(--muted); font-weight: 600; text-align: left; transition: border-color var(--fast); }
.compose-main:hover { border-color: var(--paper); color: var(--paper); }
.compose-row .icon-btn { width: 48px; height: 48px; }

.filters { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin-top: 4px; }
.drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 130px; border: 2px dashed var(--line-strong); border-radius: var(--r-md); background: var(--ink); color: var(--muted); font-weight: 700; transition: border-color var(--fast), color var(--fast); }
.drop:hover { border-color: var(--lime); color: var(--paper); }
.drop-preview { position: relative; overflow: hidden; border: 2px solid #000; border-radius: var(--r-md); background: #000; }
.drop-preview img, .drop-preview video { display: block; width: 100%; max-height: 280px; object-fit: contain; }
.drop-preview .icon-btn { position: absolute; top: 8px; right: 8px; }
.comment-photo { display: block; max-width: 100%; max-height: 320px; margin-top: 8px; border: 2px solid #000; border-radius: 14px; }
.comment-attach { position: relative; display: inline-block; margin-top: 14px; }
.comment-attach img { display: block; max-height: 140px; border: 2px solid #000; border-radius: 14px; }
.comment-attach .icon-btn { position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; }
.upload-progress { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--ink); }
.upload-progress .bar { height: 8px; overflow: hidden; border-radius: 99px; background: var(--ink-3); }
.upload-progress .bar i { display: block; height: 100%; background: var(--lime); transform-origin: left; transition: transform 200ms var(--ease-out); }
</style>
