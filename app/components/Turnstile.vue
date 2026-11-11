<script setup lang="ts">
/**
 * Cloudflare Turnstile (bot check for sign-up / login / password reset).
 * "interaction-only": invisible for almost everyone; only shows a checkbox when
 * Cloudflare isn't sure you're human. Tokens are single-use: call reset() after each try.
 */
const token = defineModel<string>({ default: '' })
const siteKey = useRuntimeConfig().public.turnstileSiteKey as string
const el = ref<HTMLElement | null>(null)
const failed = ref(false)
let widgetId: string | undefined

declare global { interface Window { turnstile?: any; __tsLoading?: Promise<void> } }

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!window.__tsLoading) {
    window.__tsLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { window.__tsLoading = undefined; reject(new Error('turnstile')) }
      document.head.appendChild(s)
    })
  }
  return window.__tsLoading
}

onMounted(async () => {
  if (!siteKey) return
  try { await loadScript() } catch { failed.value = true; return }
  if (!el.value) return
  widgetId = window.turnstile.render(el.value, {
    sitekey: siteKey,
    theme: 'dark',
    size: 'flexible',
    appearance: 'interaction-only',
    language: 'auto',
    callback: (t: string) => { token.value = t; failed.value = false },
    'expired-callback': () => { token.value = '' },
    'error-callback': () => { token.value = ''; failed.value = true },
  })
})
onBeforeUnmount(() => { if (widgetId && window.turnstile) window.turnstile.remove(widgetId) })

function reset() {
  token.value = ''
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
}
/** resolves with a fresh token (waits up to `ms` for Turnstile to finish) */
function ready(ms = 12000): Promise<string> {
  if (!siteKey) return Promise.resolve('')
  if (token.value) return Promise.resolve(token.value)
  return new Promise((resolve) => {
    const stop = watch(token, (t) => { if (t) { stop(); clearTimeout(timer); resolve(t) } })
    const timer = setTimeout(() => { stop(); resolve(token.value) }, ms)
  })
}
defineExpose({ reset, ready, enabled: !!siteKey })
</script>

<template>
  <div v-if="siteKey" class="ts">
    <div ref="el" />
    <p v-if="failed" class="ts-err">Não deu para verificar que és humano. Verifica a ligação e tenta outra vez.</p>
  </div>
</template>

<style scoped>
.ts:empty { display: none; }
.ts-err { margin: 6px 0 0; color: var(--coral); font-size: 13px; font-weight: 600; }
</style>
