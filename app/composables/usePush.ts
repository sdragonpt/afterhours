export type PushState = 'loading' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

/** Web Push on this device: state + enable/disable. */
export function usePush() {
  const supabase = useSupabaseClient()
  const me = useMe()
  const vapid = useRuntimeConfig().public.vapidPublicKey as string
  const state = useState<PushState>('push-state', () => 'loading')
  const busy = ref(false)

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

  async function refresh() {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      // iOS Safari only exposes push inside the home-screen app
      state.value = isIOS() && !standalone() ? 'needs-install' : 'unsupported'
      return
    }
    if (Notification.permission === 'denied') { state.value = 'denied'; return }
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    state.value = sub && Notification.permission === 'granted' ? 'on' : 'off'
  }

  async function enable() {
    if (!me.value || !vapid) return false
    busy.value = true
    try {
      const perm = await Notification.requestPermission() // must run from a tap on iOS
      if (perm !== 'granted') { await refresh(); return false }
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription())
        || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapid) })
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const { error } = await supabase.from('push_subscriptions').upsert(
        { user_id: me.value.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
        { onConflict: 'endpoint' },
      )
      if (error) throw error
      state.value = 'on'
      return true
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    busy.value = true
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      state.value = 'off'
    } finally {
      busy.value = false
    }
  }

  onMounted(refresh)
  return { state, busy, enable, disable, refresh }
}
