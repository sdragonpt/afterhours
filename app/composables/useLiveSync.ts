import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Keeps every tab fresh:
 *  • Supabase Realtime: any change in the active community refreshes the affected data
 *    (RLS applies — clients only receive rows they can read)
 *  • coming back to the app (iOS freezes home-screen apps in the background) or reconnecting
 */
export function useLiveSync() {
  const supabase = useSupabaseClient()
  const community = useCommunity()
  const me = useMe()
  const crew = useCrew()
  const feed = useFeed(), plans = usePlans(), gaming = useGamingData(), ledger = useLedger()

  const refreshers: Record<string, () => unknown> = {
    feed: () => feed.refresh(),
    plans: () => plans.refresh(),
    gaming: () => gaming.refresh(),
    ledger: () => ledger.load(),
    crew: () => crew.loadMembers(true),
  }
  // table → what to refresh
  const routes: Record<string, string[]> = {
    posts: ['feed', 'gaming'], post_media: ['feed', 'gaming'], post_reactions: ['feed', 'gaming'],
    post_comments: ['feed'], poll_votes: ['feed'],
    events: ['plans'], event_rsvps: ['plans'],
    game_calls: ['gaming'], game_call_players: ['gaming'],
    expenses: ['ledger'], expense_shares: ['ledger'], settlements: ['ledger'],
    profiles: ['crew'], group_members: ['crew'],
  }
  const withGroupId = ['posts', 'post_media', 'post_reactions', 'post_comments', 'events', 'game_calls', 'expenses', 'settlements', 'group_members']
  const withoutGroupId = ['poll_votes', 'event_rsvps', 'game_call_players', 'expense_shares', 'profiles']

  // debounce: a burst of changes (e.g. an expense + its shares) triggers one refresh
  const timers: Record<string, ReturnType<typeof setTimeout>> = {}
  function schedule(table: string) {
    for (const key of routes[table] || []) {
      clearTimeout(timers[key])
      timers[key] = setTimeout(() => refreshers[key]?.(), 400)
    }
  }

  let channel: RealtimeChannel | null = null
  async function subscribe() {
    if (channel) { await supabase.removeChannel(channel); channel = null }
    if (!community.value || !me.value) return
    const ch = supabase.channel(`crew:${community.value}`)
    for (const table of withGroupId) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `group_id=eq.${community.value}` }, () => schedule(table))
    }
    for (const table of withoutGroupId) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => schedule(table))
    }
    channel = ch.subscribe()
  }

  async function refreshAll() {
    await crew.loadGroups()
    await crew.loadMembers(true)
    await prefetchAll()
  }

  let hiddenAt = 0
  function onVisibility() {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
    if (hiddenAt && Date.now() - hiddenAt > 20_000) {
      refreshAll()
      subscribe() // sockets are usually dead after iOS suspends the app
    }
  }
  function onOnline() { refreshAll(); subscribe() }

  onMounted(() => {
    subscribe()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
  })
  watch([community, () => me.value?.id], () => subscribe())
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('online', onOnline)
    if (channel) supabase.removeChannel(channel)
  })

  return { refreshAll }
}
