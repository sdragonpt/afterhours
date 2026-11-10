/**
 * Cached, per-community data with stale-while-revalidate.
 * Pages render what's cached instantly and refresh in the background,
 * so switching tabs never shows a blank/skeleton screen twice.
 */
export function useResource<T>(key: string, fetcher: (community: string) => Promise<T>, initial: () => T) {
  const community = useCommunity()
  const store = useState<Record<string, T>>(`res:${key}`, () => ({}))
  const inflight = useState<Record<string, boolean>>(`res:${key}:inflight`, () => ({}))

  const data = computed<T>({
    get: () => (community.value && store.value[community.value] !== undefined ? store.value[community.value]! : initial()),
    set: (v) => { if (community.value) store.value = { ...store.value, [community.value]: v } },
  })
  const loaded = computed(() => !!community.value && store.value[community.value] !== undefined)

  // If a refresh is requested while one is running (e.g. right after saving something
  // during the background prefetch), run once more afterwards so the UI never shows stale data.
  const again = useState<Record<string, boolean>>(`res:${key}:again`, () => ({}))
  async function refresh(): Promise<void> {
    const c = community.value
    if (!c) return
    if (inflight.value[c]) { again.value = { ...again.value, [c]: true }; return }
    inflight.value = { ...inflight.value, [c]: true }
    try {
      const v = await fetcher(c)
      store.value = { ...store.value, [c]: v }
    } catch (e: any) {
      useToast().error(e?.message || 'Falha a carregar')
    } finally {
      inflight.value = { ...inflight.value, [c]: false }
      if (again.value[c]) { again.value = { ...again.value, [c]: false }; await refresh() }
    }
  }
  return { data, loaded, refresh }
}

/** lobbies live 3h after their start time (then the DB deletes them) */
export const LOBBY_MS = 3 * 3600000

const one = <T>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null))

// ── feed ────────────────────────────────────────────────
export function useFeed() {
  const supabase = useSupabaseClient()
  const media = useMedia()
  return useResource('feed', async (c) => {
    const { data, error } = await supabase.from('posts')
      .select('id,group_id,author_id,body,category,created_at,post_reactions(user_id,reaction),post_comments(count),post_media(storage_path,media_type,game_title),post_polls(options,poll_votes(user_id,option_index))')
      .eq('group_id', c).order('created_at', { ascending: false }).limit(40)
    if (error) throw error
    const posts = (data || []).map((p: any) => {
      const media = one(p.post_media) as any
      const poll = one(p.post_polls) as any
      return {
        id: p.id, group_id: p.group_id, author_id: p.author_id, body: p.body, category: p.category, created_at: p.created_at,
        reactions: p.post_reactions || [],
        comment_count: one(p.post_comments as any[])?.count ?? 0,
        storage_path: media?.storage_path, media_type: media?.media_type, game_title: media?.game_title,
        poll: poll ? { options: poll.options } : null,
        votes: poll?.poll_votes || [],
      }
    })
    const urls: Record<string, string> = {}
    const paths = posts.filter(p => p.storage_path).map(p => p.storage_path as string)
    if (paths.length) {
      const signed = await media.sign(paths)
      for (const p of posts) { const u = p.storage_path ? signed[p.storage_path] : undefined; if (u) urls[p.id] = u }
    }
    return { posts, urls }
  }, () => ({ posts: [] as any[], urls: {} as Record<string, string> }))
}

// ── plans ───────────────────────────────────────────────
export function usePlans() {
  const supabase = useSupabaseClient()
  return useResource('plans', async (c) => {
    const { data, error } = await supabase.from('events')
      .select('id,created_by,title,description,location,starts_at,event_rsvps(user_id,status)')
      .eq('group_id', c).order('starts_at').limit(150)
    if (error) throw error
    return (data || []).map((e: any) => ({ ...e, rsvps: e.event_rsvps || [] }))
  }, () => [] as any[])
}

// ── gaming ──────────────────────────────────────────────
export function useGamingData() {
  const supabase = useSupabaseClient()
  const storage = useMedia()
  return useResource('gaming', async (c) => {
    const [calls, media] = await Promise.all([
      supabase.from('game_calls').select('id,created_by,game,starts_at,slots,game_call_players(user_id,joined_at)')
        .eq('group_id', c).gte('starts_at', new Date(Date.now() - LOBBY_MS).toISOString()).order('starts_at'),
      supabase.from('post_media').select('id,post_id,storage_path,media_type,game_title,created_at,posts(author_id,body,category,post_reactions(count))')
        .eq('group_id', c).in('media_type', ['video', 'image']).order('created_at', { ascending: false }).limit(40),
    ])
    if (calls.error) throw calls.error
    if (media.error) throw media.error
    const lobbies = (calls.data || []).map((l: any) => ({
      ...l,
      players: [...(l.game_call_players || [])].sort((a: any, b: any) => +new Date(a.joined_at) - +new Date(b.joined_at)).map((p: any) => p.user_id),
    }))
    const clips = (media.data || []).map((m: any) => {
      const p = one(m.posts) as any
      return { ...m, author_id: p?.author_id, body: p?.body, category: p?.category, score: one(p?.post_reactions as any[])?.count ?? 0 }
    }).filter((c: any) => c.author_id && (c.media_type === 'video' || c.category === 'Gaming')) // clips + gaming screenshots
    const urls: Record<string, string> = {}
    if (clips.length) {
      const signed = await storage.sign(clips.map((c: any) => c.storage_path))
      for (const c of clips) { const u = signed[c.storage_path]; if (u) urls[c.id] = u }
    }
    return { lobbies, clips, urls }
  }, () => ({ lobbies: [] as any[], clips: [] as any[], urls: {} as Record<string, string> }))
}

/** Warm every tab's cache in the background (called once after boot). */
export function prefetchAll() {
  const feed = useFeed(), plans = usePlans(), gaming = useGamingData(), ledger = useLedger()
  return Promise.allSettled([feed.refresh(), plans.refresh(), gaming.refresh(), ledger.load()])
}
