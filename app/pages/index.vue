<script setup lang="ts">
import { ImagePlus, Send, MessageCircle, Heart, MoreHorizontal, Sparkles, CalendarDays, Gamepad2, Users, ArrowUpRight, Play, Plus, X, LoaderCircle, ChevronDown } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })
const supabase = useSupabaseClient()
const user = useMe()
const community = useCommunity()
const posts = ref<any[]>([])
const members = ref<any[]>([])
const profile = ref<any>(null)
const body = ref('')
const selectedFile = ref<File | null>(null)
const category = ref('Random')
const gameTitle = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref('')
const success = ref('')
const commentsOpen = ref<string | null>(null)
const commentText = ref('')
const commentRows = ref<any[]>([])
const busyComment = ref(false)
const mediaUrls = ref<Record<string,string>>({})
const activeFilter = ref('All activity')
const filters = ['All activity', 'Gaming', 'IRL', 'Random']
const reactedByMe = (post: any) => (post.reactions || []).some((r: any) => r.user_id === user.value?.id)
const goingCount = (event: any) => event.rsvps.filter((r: any) => r.status === 'going').length
function handleFileInput(event: Event) { const target = event.target as HTMLInputElement; selectedFile.value = target.files?.[0] || null }
const initials = (name: string) => (name || 'M').slice(0,1).toUpperCase()
const timeAgo = (date: string) => { const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000); if (mins < 1) return 'now'; if (mins < 60) return `${mins}m ago`; if (mins < 1440) return `${Math.floor(mins/60)}h ago`; return `${Math.floor(mins/1440)}d ago` }
const displayPosts = computed(() => activeFilter.value === 'All activity' ? posts.value : posts.value.filter(p => p.category === activeFilter.value))
const memberCount = computed(() => members.value.length)
const currentUserName = computed(() => profile.value?.display_name || user.value?.email?.split('@')[0] || 'You')

async function loadFeed() {
  if (!community.value || !user.value) { posts.value = []; return }
  loading.value = true; error.value = ''
  const [postResult, memberResult] = await Promise.all([
    supabase.from('posts').select('id,group_id,author_id,body,category,created_at').eq('group_id', community.value).order('created_at', { ascending: false }).limit(40),
    supabase.from('group_members').select('user_id,role').eq('group_id', community.value),
  ])
  if (postResult.error) error.value = postResult.error.message
  posts.value = postResult.data || []
  members.value = memberResult.data || []
  const postIds = posts.value.map(p => p.id)
  if (postIds.length) {
    const [reactionResult, commentResult] = await Promise.all([
      supabase.from('post_reactions').select('post_id,user_id,reaction').in('post_id', postIds),
      supabase.from('post_comments').select('post_id').in('post_id', postIds),
    ])
    if (reactionResult.error) error.value = reactionResult.error.message
    if (commentResult.error) error.value = commentResult.error.message
    posts.value = posts.value.map(p => ({
      ...p,
      reactions: (reactionResult.data || []).filter(r => r.post_id === p.id),
      comment_count: (commentResult.data || []).filter(c => c.post_id === p.id).length,
    }))
  }
  const ids = [...new Set([...posts.value.map(p => p.author_id), ...members.value.map(m => m.user_id)])]
  if (ids.length) {
    const { data } = await supabase.from('profiles').select('id,display_name').in('id', ids)
    const map = new Map((data || []).map(p => [p.id, p.display_name || 'Member']))
    posts.value = posts.value.map(p => ({ ...p, author_name: map.get(p.author_id) || 'Member' }))
    members.value = members.value.map(m => ({ ...m, display_name: map.get(m.user_id) || 'Member' }))
    profile.value = (data || []).find(p => p.id === user.value?.id) || null
  }
  loading.value = false
}
async function publish() {
  if (!community.value || !user.value || (!body.value.trim() && !selectedFile.value)) return
  loading.value = true; error.value = ''; success.value = ''
  if (selectedFile.value && selectedFile.value.size > 100 * 1024 * 1024) { error.value = 'O ficheiro ultrapassa o limite de 100 MB.'; loading.value = false; return }
  const { data: post, error: postError } = await supabase.from('posts').insert({ group_id: community.value, author_id: user.value.id, body: body.value.trim() || (selectedFile.value ? 'Shared a moment.' : ''), category: category.value }).select('id').single()
  if (postError) { error.value = postError.message; loading.value = false; return }
  if (selectedFile.value) {
    const file = selectedFile.value
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const path = `${community.value}/${user.value.id}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('community-media').upload(path, file, { upsert: false, contentType: file.type })
    if (uploadError) { error.value = `Publicação criada, mas o ficheiro não foi enviado: ${uploadError.message}`; loading.value = false; await loadFeed(); return }
    const { error: mediaError } = await supabase.from('post_media').insert({ post_id: post.id, group_id: community.value, storage_path: path, media_type: file.type.startsWith('video/') ? 'video' : 'image', file_name: file.name, file_size: file.size, game_title: category.value === 'Gaming' ? (gameTitle.value.trim() || null) : null })
    if (mediaError) error.value = `Publicação criada, mas o anexo não foi associado: ${mediaError.message}`
  }
  body.value = ''; selectedFile.value = null; category.value = 'Random'; gameTitle.value = ''
  if (fileInput.value) fileInput.value.value = ''
  loading.value = false; success.value = 'Posted to your community.'
  await loadFeed(); await loadMedia()
}
async function toggleReaction(post: any) {
  if (!user.value) return
  const existing = reactedByMe(post)
  const request = existing
    ? supabase.from('post_reactions').delete().eq('post_id', post.id).eq('user_id', user.value.id)
    : supabase.from('post_reactions').insert({ post_id: post.id, group_id: community.value, user_id: user.value.id, reaction: '🔥' })
  const { error: e } = await request
  if (e) { error.value = e.message; return }
  await loadFeed(); await loadMedia()
}
async function openComments(postId: string) {
  commentsOpen.value = postId; commentRows.value = []; commentText.value = ''
  const { data, error: e } = await supabase.from('post_comments').select('id,post_id,user_id,body,created_at').eq('post_id', postId).order('created_at', { ascending: true })
  if (e) { error.value = e.message; return }
  const ids = [...new Set((data || []).map(c => c.user_id))]
  const { data: people } = ids.length ? await supabase.from('profiles').select('id,display_name').in('id', ids) : { data: [] }
  const names = new Map((people || []).map(p => [p.id, p.display_name || 'Member']))
  commentRows.value = (data || []).map(c => ({ ...c, author_name: names.get(c.user_id) || 'Member' }))
}
async function addComment() {
  if (!commentsOpen.value || !commentText.value.trim() || !user.value) return
  busyComment.value = true
  const { error: e } = await supabase.from('post_comments').insert({ post_id: commentsOpen.value, group_id: community.value, user_id: user.value.id, body: commentText.value.trim() })
  busyComment.value = false
  if (e) { error.value = e.message; return }
  await openComments(commentsOpen.value)
}
async function loadMedia() {
  const ids = posts.value.map(p => p.id)
  if (!ids.length) return
  const { data } = await supabase.from('post_media').select('id,post_id,storage_path,media_type,game_title').in('post_id', ids)
  if (!data?.length) return
  const { data: signed } = await supabase.storage.from('community-media').createSignedUrls(data.map(m => m.storage_path), 3600)
  for (const media of data) {
    const url = signed?.find(r => r.path === media.storage_path)?.signedUrl
    if (url) mediaUrls.value[media.post_id] = url
    const post = posts.value.find(p => p.id === media.post_id)
    if (post) { post.media_type = media.media_type; post.game_title = media.game_title }
  }
}
watch(community, async () => { await loadFeed(); await loadMedia() })
onMounted(async () => { await loadFeed(); await loadMedia() })
</script>

<template>
  <div class="dashboard-grid">
    <section class="feed-column">
      <div class="page-heading-row">
        <div><span class="eyebrow"><Sparkles :size="13"/> YOUR COMMUNITY</span><h1 class="page-title">The lounge<span class="accent-dot">.</span></h1><p class="page-subtitle">The good stuff happens after hours.</p></div>
        <div class="heading-actions"><span class="live-pill"><i/> {{ memberCount }} MEMBERS</span></div>
      </div>

      <div v-if="!community" class="empty-state"><div class="empty-icon"><Users :size="25"/></div><h2>Your space is waiting.</h2><p>Create a community or join one with an invite link to start sharing moments.</p><NuxtLink to="/community" class="primary-button">Explore your community</NuxtLink></div>
      <template v-else>
        <section class="composer-card">
          <div class="composer-top"><span class="avatar">{{ initials(currentUserName) }}</span><textarea v-model="body" maxlength="2000" placeholder="What's happening with your crew?" rows="2"/></div>
          <div v-if="selectedFile" class="file-chip"><span>{{ selectedFile.name }}</span><button @click="selectedFile = null"><X :size="14"/></button></div>
          <div class="composer-bottom"><div class="composer-tools"><button class="tool-button" @click="fileInput?.click()"><ImagePlus :size="16"/> Photo / clip</button><select v-model="category" class="category-select" aria-label="Post category"><option>Random</option><option>Gaming</option><option>IRL</option></select><input ref="fileInput" type="file" class="hidden" accept="image/*,video/mp4,video/webm,video/quicktime" @change="handleFileInput"/><input v-if="category === 'Gaming' && selectedFile && selectedFile.type.startsWith('video/')" v-model="gameTitle" class="category-select game-title-input" placeholder="Game title (optional)"/><span class="composer-hint">Share with {{ memberCount }} members</span></div><button class="primary-button compact" :disabled="loading || (!body.trim() && !selectedFile)" @click="publish"><LoaderCircle v-if="loading" :size="15" class="spin"/><Send v-else :size="15"/> Post</button></div>
        </section>
        <p v-if="error" class="notice error-notice">{{ error }}</p><p v-if="success" class="notice success-notice">{{ success }}</p>
        <div class="feed-toolbar"><div class="filter-tabs"><button v-for="f in filters" :key="f" :class="{ selected: activeFilter === f }" @click="activeFilter = f">{{ f }}</button></div><span class="sort-label">LATEST <ChevronDown :size="13"/></span></div>
        <div v-if="loading && !posts.length" class="loading-state"><LoaderCircle class="spin"/> Loading your feed...</div>
        <div v-else-if="!displayPosts.length" class="empty-feed"><div class="empty-icon"><MessageCircle :size="22"/></div><h3>No posts yet</h3><p>Drop the first photo, thought or gaming moment. Get the conversation started.</p></div>
        <article v-for="post in displayPosts" :key="post.id" class="post-card">
          <div class="post-header"><span class="avatar">{{ initials(post.author_name) }}</span><div class="post-author"><strong>{{ post.author_name }}</strong><span>{{ timeAgo(post.created_at) }} <i>·</i> {{ post.author_id === user?.id ? 'You' : 'Community member' }}</span></div><button class="icon-button subtle"><MoreHorizontal :size="19"/></button></div>
          <div v-if="post.game_title" class="post-game-tag"><Gamepad2 :size="12"/> {{ post.game_title }}</div><p class="post-body">{{ post.body }}</p>
          <div v-if="mediaUrls[post.id]" class="post-media"><video v-if="post.media_type === 'video'" :src="mediaUrls[post.id]" controls playsinline preload="metadata"/><img v-else :src="mediaUrls[post.id]" alt="Community upload"/></div>
          <div class="post-actions"><button :class="{ reacted: reactedByMe(post) }" @click="toggleReaction(post)"><Heart :size="16"/> {{ post.reactions?.length || 0 }} <span>React</span></button><button @click="openComments(post.id)"><MessageCircle :size="16"/> {{ post.comment_count || 0 }} <span>Comments</span></button><span class="post-time">{{ new Date(post.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) }}</span></div>
        </article>
      </template>
    </section>

    <aside class="right-rail">
      <section class="rail-card welcome-card"><div class="welcome-orb"><Sparkles :size="21"/></div><span class="eyebrow">THE AFTERHOURS CLUB</span><h2>Same crew.<br/><em>New stories.</em></h2><p>Your private corner of the internet. Make it count.</p><NuxtLink to="/community" class="text-link">Meet the crew <ArrowUpRight :size="14"/></NuxtLink></section>
      <section class="rail-card"><div class="rail-heading"><h3>Who's around</h3><span class="online-count"><i/> {{ members.length }}</span></div><div v-if="!members.length" class="rail-empty">No members to show yet.</div><div v-for="member in members.slice(0,7)" :key="member.user_id" class="member-row"><span class="avatar avatar-tiny">{{ initials(member.display_name) }}</span><span class="member-name">{{ member.display_name }}</span><span v-if="member.user_id === user?.id" class="you-tag">YOU</span></div><NuxtLink to="/community" class="rail-footer-link">View all members <ArrowUpRight :size="13"/></NuxtLink></section>
      <section class="rail-card quick-links"><div class="rail-heading"><h3>Quick access</h3></div><NuxtLink to="/gaming" class="quick-link"><span class="quick-icon purple"><Gamepad2 :size="17"/></span><span><strong>Gaming hub</strong><small>Clips & highlights</small></span><ArrowUpRight :size="14"/></NuxtLink><NuxtLink to="/plans" class="quick-link"><span class="quick-icon blue"><CalendarDays :size="17"/></span><span><strong>Plans & events</strong><small>What are we doing?</small></span><ArrowUpRight :size="14"/></NuxtLink><NuxtLink to="/tab" class="quick-link"><span class="quick-icon green"><Users :size="17"/></span><span><strong>The Tab</strong><small>Settle up, stay friends</small></span><ArrowUpRight :size="14"/></NuxtLink></section>
      <p class="rail-footnote">AFTERHOURS <span>·</span> YOUR PEOPLE, YOUR WORLD.</p>
    </aside>

    <div v-if="commentsOpen" class="modal-backdrop" @click.self="commentsOpen = null"><section class="modal-card comments-modal"><div class="modal-heading"><div><span class="eyebrow">COMMUNITY</span><h2>Comments</h2></div><button class="icon-button" @click="commentsOpen = null"><X :size="18"/></button></div><div class="comments-list"><div v-for="comment in commentRows" :key="comment.id" class="comment-row"><span class="avatar avatar-tiny">{{ initials(comment.author_name) }}</span><div><strong>{{ comment.author_name }}</strong><p>{{ comment.body }}</p></div></div><p v-if="!commentRows.length" class="rail-empty">No comments yet. Start the conversation.</p></div><form class="comment-form" @submit.prevent="addComment"><input v-model="commentText" class="field" placeholder="Write a comment..." maxlength="1000" required/><button class="primary-button compact" :disabled="busyComment"><Send :size="15"/></button></form></section></div>
  </div>
</template>
