<script setup lang="ts">
import { Bell, Share } from 'lucide-vue-next'
/**
 * Bottom prompt shown every time the app opens while notifications are off.
 * "Agora não" hides it until the next app launch (sessionStorage), "Ativar" asks iOS.
 */
const push = usePush()
const toast = useToast()
const KEY = 'ah-notify-bar-dismissed'
const dismissed = ref(true) // decided on mount (avoid a flash before we know the state)
const delayDone = ref(false)

onMounted(() => {
  try { dismissed.value = sessionStorage.getItem(KEY) === '1' } catch { dismissed.value = false }
  setTimeout(() => (delayDone.value = true), 1200) // let the app settle first
})
const show = computed(() => delayDone.value && !dismissed.value && (push.state.value === 'off' || push.state.value === 'needs-install'))

function later() {
  dismissed.value = true
  try { sessionStorage.setItem(KEY, '1') } catch {}
}
async function turnOn(e: MouseEvent) {
  try {
    const ok = await push.enable()
    if (ok) { celebrate(originFrom(e)); toast.ok('Notificações ativas') }
    else if (push.state.value === 'denied') { toast.error('Bloqueaste as notificações. Ativa-as nas Definições do iPhone.'); later() }
  } catch (err: any) { toast.error(err?.message || 'Não deu para ativar') }
}
</script>

<template>
  <Transition name="bar">
    <div v-if="show" class="notify-bar" role="dialog" aria-label="Ativar notificações">
      <span class="bell fill-sun"><Bell :size="18" /></span>
      <div class="flex-1 min-w-0">
        <strong class="block">Ativa as notificações</strong>
        <small v-if="push.state.value === 'needs-install'">No iPhone: <b>Partilhar <Share :size="11" class="inline" /> → Adicionar ao ecrã principal</b> e abre por lá.</small>
        <small v-else>Planos, clips e lobbies novos, mesmo com a app fechada.</small>
      </div>
      <div class="actions">
        <button v-if="push.state.value === 'off'" class="btn btn-sm btn-primary" :disabled="push.busy.value" @click="turnOn">Ativar</button>
        <button class="later" @click="later">Agora não</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.notify-bar {
  position: fixed; left: 12px; right: 12px; z-index: 70;
  bottom: calc(max(10px, env(safe-area-inset-bottom) - 14px) + 78px);
  display: flex; align-items: center; gap: 10px; max-width: 520px; margin: 0 auto; padding: 10px 12px;
  border: 2px solid #000; border-radius: 22px; background: var(--ink-3); box-shadow: 4px 4px 0 #000, 0 10px 30px #0009;
}
.bell { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border: 2px solid #000; border-radius: 12px; }
strong { font-size: 14px; }
small { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 1.3; }
small b { color: var(--paper); font-weight: 600; }
.actions { display: flex; flex-direction: column; align-items: stretch; gap: 4px; flex: none; }
.later { padding: 2px 4px; border: 0; background: none; color: var(--faint); font-size: 12px; font-weight: 700; }
.later:hover { color: var(--paper); }
@media (min-width: 1024px) { .notify-bar { bottom: 24px; left: auto; right: 24px; max-width: 420px; } }
.bar-enter-active { transition: transform 320ms cubic-bezier(.22, 1, .36, 1), opacity 200ms ease-out; }
.bar-leave-active { transition: transform 180ms ease-in, opacity 150ms ease-in; }
.bar-enter-from, .bar-leave-to { transform: translateY(24px); opacity: 0; }
</style>
