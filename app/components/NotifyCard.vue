<script setup lang="ts">
import { Bell, BellOff, Share, X } from 'lucide-vue-next'
/** compact = the dismissible nudge on "Hoje"; full = the profile section */
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const push = usePush()
const toast = useToast()
const dismissed = ref(false)
const KEY = 'ah-notify-nudge-dismissed'
onMounted(() => { try { dismissed.value = localStorage.getItem(KEY) === '1' } catch {} })
function dismiss() { dismissed.value = true; try { localStorage.setItem(KEY, '1') } catch {} }

async function turnOn(e: MouseEvent) {
  try {
    const ok = await push.enable()
    if (ok) { celebrate(originFrom(e)); toast.ok('Notificações ativas') }
    else if (push.state.value === 'denied') toast.error('Bloqueaste as notificações. Ativa-as nas Definições do iPhone.')
  } catch (err: any) { toast.error(err?.message || 'Não deu para ativar') }
}
async function turnOff() { await push.disable(); toast.ok('Notificações desligadas') }

const visible = computed(() => !props.compact || (!dismissed.value && (push.state.value === 'off' || push.state.value === 'needs-install')))
</script>

<template>
  <section v-if="visible && push.state.value !== 'loading'" class="notify" :class="{ compact }">
    <button v-if="compact" class="close" aria-label="Dispensar" @click="dismiss"><X :size="15" /></button>
    <div class="row">
      <span class="bell" :class="push.state.value === 'on' ? 'fill-lime' : 'fill-sun'"><component :is="push.state.value === 'on' ? Bell : push.state.value === 'denied' ? BellOff : Bell" :size="20" /></span>
      <div class="flex-1 min-w-0">
        <strong class="block">{{ push.state.value === 'on' ? 'Notificações ativas' : 'Não percas nada' }}</strong>
        <p class="m-0 muted text-sm">
          <template v-if="push.state.value === 'needs-install'">No iPhone, as notificações só funcionam com a app no ecrã principal: <b>Partilhar <Share :size="12" class="inline" /> → Adicionar ao ecrã principal</b>, abre-a por lá e ativa aqui.</template>
          <template v-else-if="push.state.value === 'unsupported'">Este browser não suporta notificações.</template>
          <template v-else-if="push.state.value === 'denied'">Estão bloqueadas. Vai a <b>Definições → Notificações → Afterhours</b> e permite.</template>
          <template v-else-if="push.state.value === 'on'">Planos e clips novos, comentários nos teus posts, quem entra no teu lobby e quem vai aos teus planos.</template>
          <template v-else>Avisa-te de planos e clips novos, comentários nos teus posts, quem entra no teu lobby e quem vai aos teus planos.</template>
        </p>
      </div>
    </div>
    <button v-if="push.state.value === 'off'" class="btn btn-primary btn-block mt-3" :disabled="push.busy.value" @click="turnOn">{{ push.busy.value ? 'A ativar…' : 'Ativar notificações' }}</button>
    <button v-else-if="push.state.value === 'on' && !compact" class="btn btn-ghost btn-block mt-3" :disabled="push.busy.value" @click="turnOff">Desligar neste telemóvel</button>
  </section>
</template>

<style scoped>
.notify { position: relative; padding: 16px; border: 1.5px solid var(--line-strong); border-radius: var(--r-lg); background: var(--ink-2); }
.notify.compact { border-color: var(--sun); }
.row { display: flex; align-items: flex-start; gap: 12px; }
.bell { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border: 2px solid #000; border-radius: 14px; box-shadow: 3px 3px 0 #000; }
.notify b { color: var(--paper); font-weight: 600; }
.close { position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 999px; background: transparent; color: var(--faint); }
</style>
