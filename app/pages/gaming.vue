<script setup lang="ts">
import { Gamepad2, Upload, Play, Image as ImageIcon, Trophy, ArrowUpRight, LoaderCircle } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })
const supabase = useSupabaseClient()
const community = useCommunity()
const clips = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const urls = ref<Record<string,string>>({})
const games = computed(() => ['All games', ...new Set(clips.value.map(c => c.game_title || 'Other'))])
const selectedGame = ref('All games')
const filtered = computed(() => selectedGame.value === 'All games' ? clips.value : clips.value.filter(c => (c.game_title || 'Other') === selectedGame.value))
async function load() {
  if (!community.value) { clips.value = []; return }
  loading.value = true; error.value = ''
  const { data: media, error: e } = await supabase.from('post_media').select('id,post_id,storage_path,media_type,file_name,game_title,created_at').eq('group_id', community.value).eq('media_type','video').order('created_at',{ascending:false}).limit(40)
  if (e) { error.value = e.message; loading.value = false; return }
  const postIds = (media || []).map(m => m.post_id)
  if (!postIds.length) { clips.value = []; loading.value = false; return }
  const { data: postRows } = await supabase.from('posts').select('id,body,author_id,created_at').in('id', postIds)
  const authorIds = [...new Set((postRows || []).map(p => p.author_id))]
  const { data: people } = authorIds.length ? await supabase.from('profiles').select('id,display_name').in('id', authorIds) : { data: [] }
  const names = new Map((people || []).map(p => [p.id,p.display_name || 'Member']))
  clips.value = (media || []).map(m => ({ ...m, post: (postRows || []).find(p => p.id === m.post_id), author_name: names.get((postRows || []).find(p => p.id === m.post_id)?.author_id) || 'Member' })).filter(m => m.post)
  // one request for every signed URL instead of one per clip
  if (clips.value.length) {
    const { data: signed } = await supabase.storage.from('community-media').createSignedUrls(clips.value.map(c => c.storage_path), 3600)
    for (const row of signed || []) {
      const clip = clips.value.find(c => c.storage_path === row.path)
      if (clip && row.signedUrl) urls.value[clip.id] = row.signedUrl
    }
  }
  loading.value = false
}
watch(community, load)
onMounted(load)
</script>
<template>
  <div class="content-page">
    <header class="content-header"><div><span class="eyebrow"><Gamepad2 :size="13"/> GAME ON</span><h1>Gaming hub<span class="accent-dot">.</span></h1><p>Your crew's best plays, worst fails and everything in between.</p></div><NuxtLink to="/" class="secondary-button">Share a clip <ArrowUpRight :size="13"/></NuxtLink></header>
    <section class="gaming-hero"><div class="gaming-hero-copy"><span class="eyebrow">THE HIGHLIGHT REEL</span><h2>Moments worth<br/><em>replaying.</em></h2><p>Every clutch, every chaos moment, saved in one place.</p><NuxtLink to="/" class="primary-button">Upload a moment <Upload :size="14"/></NuxtLink></div><div class="gaming-hero-art"><div class="art-grid"/><div class="art-controller"><Gamepad2 :size="82" stroke-width="1"/></div><span class="art-tag">CREW ONLY / 001</span></div></section>
    <div class="gaming-toolbar"><div><h2 class="surface-title">Latest clips</h2><p class="text-muted">Private highlights from your community.</p></div><select v-model="selectedGame" class="field game-filter"><option v-for="g in games" :key="g">{{ g }}</option></select></div>
    <p v-if="error" class="notice error-notice">{{ error }}</p>
    <div v-if="loading" class="loading-state"><LoaderCircle class="spin"/> Loading clips...</div>
    <div v-else-if="!filtered.length" class="surface-card empty-inline"><div class="empty-icon"><Play :size="22"/></div><strong class="block text-white mb-2">No clips in the library yet</strong>Share a video from the lounge feed and it will appear here automatically.</div>
    <div v-else class="clip-grid"><article v-for="clip in filtered" :key="clip.id" class="clip-card"><video :src="urls[clip.id]" controls playsinline preload="metadata"/><div class="clip-info"><div><strong>{{ clip.post.body }}</strong><small>{{ clip.game_title || 'Other game' }} · {{ clip.author_name }} · {{ new Date(clip.created_at).toLocaleDateString('pt-PT') }}</small></div><span class="clip-play"><Play :size="13" fill="currentColor"/></span></div></article></div>
    <section class="surface-card gaming-tip"><div class="quick-icon purple"><Trophy :size="18"/></div><div><strong>Hall of fame coming soon</strong><p class="text-muted">Community voting and weekly top plays will turn your best moments into legends.</p></div><span class="pill">NEXT UPDATE</span></section>
  </div>
</template>
<style scoped>
.gaming-hero{position:relative;display:grid;grid-template-columns:1fr .8fr;min-height:230px;overflow:hidden;border:1px solid #a18bff22;border-radius:16px;background:radial-gradient(circle at 78% 35%,#8b70ff2b,transparent 35%),linear-gradient(115deg,#201b35,#12141c 70%);margin-bottom:27px}.gaming-hero-copy{position:relative;z-index:2;padding:27px}.gaming-hero h2{margin:12px 0 7px;font-family:'Space Grotesk';font-size:34px;line-height:1.03;letter-spacing:-.06em}.gaming-hero h2 em{color:#b8a6ff;font-style:normal}.gaming-hero p{margin:0 0 17px;color:#9298aa;font-size:11px}.gaming-hero-art{position:relative;display:grid;place-items:center;overflow:hidden;color:#b5a3ff}.art-grid{position:absolute;inset:0;background-image:linear-gradient(#a18bff10 1px,transparent 1px),linear-gradient(90deg,#a18bff10 1px,transparent 1px);background-size:25px 25px;transform:perspective(250px) rotateY(-18deg) scale(1.3);mask-image:linear-gradient(90deg,transparent,#000)}.art-controller{display:grid;place-items:center;width:145px;height:115px;border:1px solid #b9a8ff40;border-radius:30px;background:#b19cff12;box-shadow:0 0 65px #967bff30;transform:rotate(-12deg)}.art-tag{position:absolute;right:20px;bottom:16px;color:#8276b6;font-size:8px;letter-spacing:.2em}.gaming-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}.gaming-toolbar .surface-title{margin-bottom:4px}.gaming-toolbar p{margin:0;font-size:10px}.game-filter{width:190px;margin:0}.clip-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.clip-card{overflow:hidden;border:1px solid var(--line);border-radius:13px;background:#151821}.clip-card video{display:block;width:100%;aspect-ratio:16/9;background:#07080b;object-fit:contain}.clip-info{display:flex;align-items:center;gap:10px;padding:12px}.clip-info>div{min-width:0;flex:1}.clip-info strong,.clip-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.clip-info strong{font-size:10px}.clip-info small{margin-top:4px;color:#7d8495;font-size:9px}.clip-play{display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:#a18bff19;color:#bbaaff}.gaming-tip{display:flex;align-items:center;gap:12px;margin-top:18px}.gaming-tip>div:nth-child(2){flex:1}.gaming-tip strong{font-size:11px}.gaming-tip p{margin:4px 0 0;font-size:9px}.gaming-tip .pill{white-space:nowrap}@media(max-width:650px){.gaming-hero{grid-template-columns:1fr}.gaming-hero-art{position:absolute;inset:0 0 0 45%;opacity:.5}.gaming-hero-copy{padding:22px}.gaming-hero h2{font-size:29px}.clip-grid{grid-template-columns:1fr}.gaming-tip .pill{display:none}.game-filter{width:145px}}
</style>
