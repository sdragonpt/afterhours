import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Direct messages: unread badge + one Realtime channel per signed-in user.
 * Pages subscribe with onMessage() to get new/updated messages live.
 */
export type DM = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null }
type Listener = (m: DM, kind: 'INSERT' | 'UPDATE' | 'DELETE') => void

const listeners = new Set<Listener>()
let channel: RealtimeChannel | null = null
let channelFor: string | null = null
let visibilityHooked = false

export function useDMs() {
  const supabase = useSupabaseClient()
  const me = useMe()
  const unread = useState('dm-unread', () => 0)
  /** the conversation currently open (its messages count as read) */
  const openWith = useState<string | null>('dm-open-with', () => null)

  async function refreshUnread() {
    if (!me.value) { unread.value = 0; return }
    const { data } = await supabase.rpc('dm_unread_count')
    if (typeof data === 'number') unread.value = data
  }

  async function start() {
    if (!import.meta.client) return
    const uid = me.value?.id || null
    if (uid === channelFor) return
    if (channel) { await supabase.removeChannel(channel); channel = null }
    channelFor = uid
    if (!uid) { unread.value = 0; return }
    const emit = (kind: any, row: any) => { for (const l of listeners) l(row as DM, kind) }
    channel = supabase.channel(`dm:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${uid}` }, (p: any) => {
        const row = p.eventType === 'DELETE' ? p.old : p.new
        if (p.eventType === 'INSERT' && row.sender_id !== openWith.value) unread.value++
        else if (p.eventType !== 'INSERT') refreshUnread()
        emit(p.eventType, row)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${uid}` }, (p: any) => {
        emit(p.eventType, p.eventType === 'DELETE' ? p.old : p.new)
      })
      .subscribe()
    refreshUnread()
    if (!visibilityHooked) {
      visibilityHooked = true
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshUnread() })
    }
  }

  function onMessage(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  }

  async function markRead(other: string) {
    await supabase.rpc('dm_mark_read', { p_other: other })
    refreshUnread()
  }

  if (import.meta.client) watch(() => me.value?.id, start, { immediate: true })

  return { unread, openWith, refreshUnread, onMessage, markRead }
}
