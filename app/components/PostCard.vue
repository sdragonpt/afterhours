<script setup lang="ts">
import { MessageCircle, Gamepad2, Trash2, Share2 } from 'lucide-vue-next'
const REACTIONS = ['🔥', '😂', '💀', '🐐', '❤️'] as const

const props = defineProps<{ post: any; mediaUrl?: string }>()
const emit = defineEmits<{ comments: [id: string]; changed: []; deleted: [id: string] }>()
const supabase = useSupabaseClient()
const me = useMe()
const crew = useCrew()
const toast = useToast()
const media = useMedia()
const popped = ref<string | null>(null)

const counts = computed(() => {
  const map: Record<string, { n: number; mine: boolean }> = {}
  for (const r of props.post.reactions || []) {
    map[r.reaction] ||= { n: 0, mine: false }
    map[r.reaction]!.n++
    if (r.user_id === me.value?.id) map[r.reaction]!.mine = true
  }
  return map
})
const poll = computed(() => props.post.poll as { options: string[] } | null)
const votes = computed(() => (props.post.votes || []) as { user_id: string; option_index: number }[])
const myVote = computed(() => votes.value.find(v => v.user_id === me.value?.id)?.option_index ?? null)
const pct = (i: number) => votes.value.length ? Math.round(votes.value.filter(v => v.option_index === i).length / votes.value.length * 100) : 0
const leader = computed(() => {
  if (!votes.value.length || !poll.value) return -1
  let best = -1, bestN = 0
  poll.value.options.forEach((_, i) => { const n = votes.value.filter(v => v.option_index === i).length; if (n > bestN) { best = i; bestN = n } })
  return best
})

async function react(emoji: string) {
  if (!me.value) return
  const mine = counts.value[emoji]?.mine
  // optimistic
  props.post.reactions = mine
    ? props.post.reactions.filter((r: any) => !(r.user_id === me.value!.id && r.reaction === emoji))
    : [...(props.post.reactions || []), { user_id: me.value.id, reaction: emoji }]
  if (!mine) { popped.value = emoji; setTimeout(() => (popped.value = null), 380) }
  const { error } = mine
    ? await supabase.from('post_reactions').delete().eq('post_id', props.post.id).eq('user_id', me.value.id).eq('reaction', emoji)
    : await supabase.from('post_reactions').insert({ post_id: props.post.id, group_id: props.post.group_id, user_id: me.value.id, reaction: emoji })
  if (error) { toast.error(error.message); emit('changed') }
}

async function vote(i: number) {
  if (!me.value) return
  const had = myVote.value
  props.post.votes = [...votes.value.filter(v => v.user_id !== me.value!.id), ...(had === i ? [] : [{ user_id: me.value.id, option_index: i }])]
  const { error } = had === i
    ? await supabase.from('poll_votes').delete().eq('post_id', props.post.id).eq('user_id', me.value.id)
    : await supabase.from('poll_votes').upsert({ post_id: props.post.id, user_id: me.value.id, option_index: i }, { onConflict: 'post_id,user_id' })
  if (error) { toast.error(error.message); emit('changed') }
}

async function remove() {
  if (!confirm('Apagar este post?')) return
  const { error } = await supabase.from('posts').delete().eq('id', props.post.id)
  if (error) return toast.error(error.message)
  if (props.post.storage_path) media.remove(props.post.storage_path)
  emit('deleted', props.post.id)
}
function share() {
  const text = poll.value
    ? `📊 ${props.post.body}\n${poll.value.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\nVota no Afterhours 👇`
    : `${crew.nameOf(props.post.author_id)} no Afterhours: ${props.post.body}`
  shareOut(text, '/')
}
</script>

<template>
  <article class="post">
    <header class="post-head">
      <Avatar :name="crew.nameOf(post.author_id)" :color="crew.colorOf(post.author_id)" :size="38" />
      <div class="flex-1 min-w-0">
        <strong class="block truncate">{{ crew.nameOf(post.author_id) }}</strong>
        <span class="faint text-xs">{{ ago(post.created_at) }}<template v-if="post.category && post.category !== 'Random'"> · {{ post.category }}</template></span>
      </div>
      <button class="icon-btn icon-sm" aria-label="Partilhar" @click="share"><Share2 :size="15" /></button>
      <button v-if="post.author_id === me?.id" class="icon-btn icon-sm" aria-label="Apagar" @click="remove"><Trash2 :size="15" /></button>
    </header>

    <span v-if="post.game_title" class="tag fill-sky mt-3"><Gamepad2 :size="12" /> {{ post.game_title }}</span>
    <p v-if="post.body && post.body !== 'Shared a moment.'" class="post-body" :class="{ 'poll-q display': poll }">{{ post.body }}</p>

    <div v-if="poll" class="poll">
      <button v-for="(opt, i) in poll.options" :key="i" class="poll-opt" :class="{ mine: myVote === i, lead: leader === i && myVote !== null }" @click="vote(i)">
        <span class="poll-bar" :style="{ transform: `scaleX(${myVote === null ? 0 : pct(i) / 100})` }" />
        <span class="relative flex-1 text-left">{{ opt }}</span>
        <span v-if="myVote !== null" class="relative num text-sm">{{ pct(i) }}%</span>
      </button>
      <p class="faint text-xs m-0 mt-1">{{ votes.length }} {{ votes.length === 1 ? 'voto' : 'votos' }}<template v-if="myVote === null"> · vota para ver os resultados</template></p>
    </div>

    <div v-if="mediaUrl" class="media">
      <ClipVideo v-if="post.media_type === 'video'" :src="mediaUrl" />
      <img v-else :src="mediaUrl" alt="" loading="lazy">
    </div>

    <footer class="post-foot">
      <div class="reactions">
        <button v-for="e in REACTIONS" :key="e" class="react" :class="{ mine: counts[e]?.mine, wiggle: popped === e }" :aria-label="`Reagir ${e}`" @click="react(e)">
          <span class="emoji">{{ e }}</span><span v-if="counts[e]?.n" class="num">{{ counts[e]?.n }}</span>
        </button>
      </div>
      <button class="react comments" @click="emit('comments', post.id)"><MessageCircle :size="16" /><span class="num">{{ post.comment_count || 0 }}</span></button>
    </footer>
  </article>
</template>

<style scoped>
.post { padding: 16px 0 14px; border-bottom: 1.5px solid var(--line); }
.post-head { display: flex; align-items: center; gap: 10px; }
.icon-sm { width: 34px; height: 34px; border-color: transparent; background: transparent; color: var(--faint); }
.icon-sm:hover { color: var(--paper); }
.post-body { margin: 12px 0 0; font-size: 16px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.poll-q { font-size: 24px; line-height: 1.05; }
.poll { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.poll-opt { position: relative; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 14px; overflow: hidden; border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--ink-2); font-weight: 600; transition: border-color var(--fast), transform var(--fast) var(--ease-out); }
.poll-opt:active { transform: scale(.98); }
.poll-opt.mine { border-color: var(--pink); }
.poll-bar { position: absolute; inset: 0; transform-origin: left; background: #ff8ad82e; transition: transform 520ms var(--ease-spring); }
.poll-opt.lead .poll-bar { background: #ff8ad855; }
.media { margin-top: 12px; overflow: hidden; border: 2px solid #000; border-radius: var(--r-md); background: #000; }
.media img, .media video { display: block; width: 100%; max-height: 520px; object-fit: contain; }
.post-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
.reactions { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.react { display: inline-flex; align-items: center; gap: 5px; height: 34px; padding: 0 10px; border: 1.5px solid var(--line); border-radius: 999px; background: var(--ink-2); color: var(--muted); font-size: 13px; transition: transform var(--fast) var(--ease-out), border-color var(--fast), background-color var(--fast); }
.react .emoji { font-size: 16px; line-height: 1; filter: grayscale(.6); transition: filter var(--fast); }
.react:hover .emoji, .react.mine .emoji { filter: none; }
.react.mine { border-color: var(--lime); background: #d4ff3a14; color: var(--paper); }
.react:active { transform: scale(.88); }
.comments { flex: none; }
</style>
