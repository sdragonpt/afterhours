<script setup lang="ts">
import { Flame, CalendarHeart, Gamepad2, Wallet, Plus, Users, ChevronDown, Check, PenLine, BarChart3, Clapperboard, Swords, Receipt, PartyPopper } from 'lucide-vue-next'

const supabase = useSupabaseClient()
const me = useMe()
const route = useRoute()
const community = useCommunity()
const crew = useCrew()
const toast = useToast()
const { toasts } = toast

const ready = ref(false)
const showSwitcher = ref(false)
const showAdd = ref(false)
const newName = ref('')
const creating = ref(false)

const tabs = [
  { to: '/', label: 'Hoje', icon: Flame },
  { to: '/plans', label: 'Planos', icon: CalendarHeart },
  { to: '/gaming', label: 'Gaming', icon: Gamepad2 },
  { to: '/tab', label: 'Tab', icon: Wallet },
]
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

const quickActions = [
  { label: 'Post', hint: 'Foto, texto, momento', icon: PenLine, color: 'paper', to: '/?new=post' },
  { label: 'Sondagem', hint: 'Decidam em 10 seg', icon: BarChart3, color: 'pink', to: '/?new=poll' },
  { label: 'Plano', hint: 'Jantar, saída, viagem', icon: PartyPopper, color: 'coral', to: '/plans?new=1' },
  { label: 'Quem joga?', hint: 'Abre um lobby', icon: Swords, color: 'sky', to: '/gaming?new=lobby' },
  { label: 'Clip', hint: 'A jogada do ano', icon: Clapperboard, color: 'sun', to: '/?new=clip' },
  { label: 'Despesa', hint: 'Quem pagou o quê', icon: Receipt, color: 'lime', to: '/tab?new=1' },
]

async function boot() {
  if (!me.value) return
  await crew.loadGroups()
  await crew.loadMembers(true)
  ready.value = true
  // warm every tab so switching feels instant
  prefetchAll()
}
async function switchTo(id: string) {
  community.value = id
  showSwitcher.value = false
  await crew.loadMembers(true)
  prefetchAll()
}
async function createCommunity() {
  if (!newName.value.trim()) return
  creating.value = true
  const { data, error } = await supabase.rpc('create_group', { p_name: newName.value.trim() })
  creating.value = false
  if (error) return toast.error(error.message)
  newName.value = ''
  showSwitcher.value = false
  await crew.loadGroups()
  community.value = data as string
  await crew.loadMembers(true)
  toast.ok('Comunidade criada. Agora convida a malta!')
  navigateTo('/community')
}
function go(to: string) { showAdd.value = false; navigateTo(to) }

watch(() => me.value?.id, boot)
onMounted(boot)
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <button v-if="crew.groups.value.length" class="crew-pill" @click="showSwitcher = true">
        <span class="crew-glyph fill-lime">{{ crew.group.value?.name.slice(0, 1).toUpperCase() }}</span>
        <span class="truncate">{{ crew.group.value?.name }}</span>
        <ChevronDown :size="16" class="faint" />
      </button>
      <NuxtLink v-else to="/" class="wordmark display">afterhours<span class="t-lime">.</span></NuxtLink>
      <div class="flex items-center gap-2">
        <NuxtLink to="/community" class="icon-btn" aria-label="Malta" :class="{ 'is-on': route.path === '/community' }"><Users :size="18" /></NuxtLink>
        <NuxtLink to="/profile" aria-label="Perfil">
          <Avatar :name="crew.meMember.value?.name || me?.email || '?'" :color="crew.meMember.value?.color" :vibe="crew.meMember.value?.vibe" :size="40" />
        </NuxtLink>
      </div>
    </header>

    <nav class="rail" aria-label="Navegação">
      <NuxtLink to="/" class="wordmark display">afterhours<span class="t-lime">.</span></NuxtLink>
      <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="rail-link" :class="{ on: isActive(t.to) }"><component :is="t.icon" :size="20" /> {{ t.label }}</NuxtLink>
      <NuxtLink to="/community" class="rail-link" :class="{ on: route.path === '/community' }"><Users :size="20" /> Malta</NuxtLink>
      <button class="btn btn-primary mt-4" @click="showAdd = true"><Plus :size="18" /> Criar</button>
    </nav>

    <main class="main">
      <div v-if="!ready" class="flex flex-col gap-3 pt-6">
        <div class="skeleton" style="height:46px;width:60%" />
        <div class="skeleton" style="height:180px" />
        <div class="skeleton" style="height:120px" />
      </div>

      <section v-else-if="!crew.groups.value.length" class="onboard stagger">
        <p class="kicker">Bem-vindo</p>
        <h1 class="display h-xl">Ainda não tens<br>malta aqui<span class="t-lime">.</span></h1>
        <p class="muted">Cria a comunidade do teu grupo ou abre o link de convite que te mandaram no WhatsApp.</p>
        <form class="flex flex-col gap-3 mt-2" @submit.prevent="createCommunity">
          <input v-model="newName" class="field" maxlength="60" placeholder="Nome do grupo (ex.: Os do costume)" required>
          <button class="btn btn-primary btn-block" :disabled="creating">{{ creating ? 'A criar…' : 'Criar comunidade' }}</button>
        </form>
        <NuxtLink to="/join" class="btn btn-ghost btn-block">Tenho um código de convite</NuxtLink>
      </section>

      <slot v-else />
    </main>

    <nav v-if="crew.groups.value.length" class="tabbar" aria-label="Navegação">
      <NuxtLink v-for="t in tabs.slice(0, 2)" :key="t.to" :to="t.to" class="tab" :class="{ on: isActive(t.to) }"><component :is="t.icon" :size="22" :stroke-width="isActive(t.to) ? 2.4 : 1.8" /><span>{{ t.label }}</span></NuxtLink>
      <button class="fab" aria-label="Criar" @click="showAdd = true"><Plus :size="28" :stroke-width="2.6" /></button>
      <NuxtLink v-for="t in tabs.slice(2)" :key="t.to" :to="t.to" class="tab" :class="{ on: isActive(t.to) }"><component :is="t.icon" :size="22" :stroke-width="isActive(t.to) ? 2.4 : 1.8" /><span>{{ t.label }}</span></NuxtLink>
    </nav>

    <Sheet :open="showAdd" kicker="O que se passa?" title="Criar" @close="showAdd = false">
      <div class="qa-grid stagger">
        <button v-for="a in quickActions" :key="a.label" class="qa" @click="go(a.to)">
          <span class="qa-icon" :class="a.color === 'paper' ? 'qa-paper' : `fill-${a.color}`"><component :is="a.icon" :size="22" :stroke-width="2.2" /></span>
          <strong>{{ a.label }}</strong>
          <small>{{ a.hint }}</small>
        </button>
      </div>
    </Sheet>

    <Sheet :open="showSwitcher" kicker="Comunidades" title="Muda de malta" @close="showSwitcher = false">
      <div class="flex flex-col gap-2">
        <button v-for="g in crew.groups.value" :key="g.id" class="switch-row" :class="{ on: g.id === community }" @click="switchTo(g.id)">
          <span class="crew-glyph fill-lime">{{ g.name.slice(0, 1).toUpperCase() }}</span>
          <span class="flex-1 text-left font-bold">{{ g.name }}</span>
          <Check v-if="g.id === community" :size="18" class="t-lime" />
        </button>
      </div>
      <form class="flex gap-2 mt-5" @submit.prevent="createCommunity">
        <input v-model="newName" class="field" maxlength="60" placeholder="Nova comunidade…">
        <button class="btn btn-primary" :disabled="creating || !newName.trim()">Criar</button>
      </form>
    </Sheet>

    <div class="toast-wrap">
      <TransitionGroup name="toast" tag="div" class="flex flex-col items-center gap-2">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="{ error: t.kind === 'error' }">{{ t.text }}</div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.shell { min-height: 100dvh; }
.topbar { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: calc(10px + env(safe-area-inset-top)) 16px 10px; background: linear-gradient(var(--ink) 70%, transparent); }
.crew-pill { display: flex; align-items: center; gap: 9px; min-width: 0; max-width: 62vw; height: 44px; padding: 0 12px 0 5px; border: 1.5px solid var(--line-strong); border-radius: 999px; background: var(--ink-2); font-weight: 700; transition: transform var(--fast) var(--ease-out); }
.crew-pill:active { transform: scale(.97); }
.crew-glyph { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border: 2px solid #000; border-radius: 999px; font-family: var(--font-display); font-weight: 800; }
.wordmark { font-size: 26px; }
.icon-btn.is-on { background: var(--paper); color: var(--on-color); border-color: var(--paper); }
.main { width: 100%; max-width: 640px; margin: 0 auto; padding: 6px 16px calc(120px + env(safe-area-inset-bottom)); }

.tabbar { position: fixed; left: 12px; right: 12px; bottom: calc(10px + env(safe-area-inset-bottom)); z-index: 60; display: grid; grid-template-columns: repeat(5, 1fr); align-items: center; max-width: 520px; margin: 0 auto; height: 68px; padding: 0 6px; border: 2px solid #000; border-radius: 999px; background: #1c1c21f2; backdrop-filter: blur(16px); box-shadow: 0 10px 30px #000a; }
.tab { display: flex; flex-direction: column; align-items: center; gap: 3px; color: var(--faint); font-size: 11px; font-weight: 700; transition: color var(--fast), transform var(--fast) var(--ease-out); }
.tab:active { transform: scale(.9); }
.tab.on { color: var(--paper); }
.tab.on span { color: var(--lime); }
.fab { justify-self: center; display: grid; place-items: center; width: 58px; height: 58px; margin-top: -26px; border: 2px solid #000; border-radius: 999px; background: var(--lime); color: var(--on-color); box-shadow: 0 0 0 5px var(--ink), 4px 6px 0 5px #000; transition: transform var(--base) var(--ease-spring); }
.fab:hover { transform: rotate(90deg); }
.fab:active { transform: scale(.88) rotate(90deg); }

.rail { display: none; }
@media (min-width: 1024px) {
  .rail { position: fixed; top: 0; bottom: 0; left: 0; z-index: 40; display: flex; flex-direction: column; gap: 4px; width: 230px; padding: 28px 18px; border-right: 1.5px solid var(--line); }
  .rail .wordmark { margin: 0 10px 26px; }
  .rail-link { display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 14px; border-radius: 999px; color: var(--muted); font-weight: 700; transition: background-color var(--fast), color var(--fast); }
  .rail-link:hover { background: var(--ink-3); color: var(--paper); }
  .rail-link.on { background: var(--paper); color: var(--on-color); }
  .tabbar { display: none; }
  .topbar { margin-left: 230px; }
  .topbar > .wordmark { display: none; }
  .main { max-width: 700px; padding-left: 24px; padding-right: 24px; padding-bottom: 60px; margin-left: calc(230px + max(0px, (100vw - 230px - 700px) / 2)); }
}

.onboard { display: flex; flex-direction: column; gap: 14px; padding-top: 40px; }
.onboard h1, .onboard p { margin: 0; }

.qa-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.qa { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 14px; border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--ink-3); text-align: left; transition: transform var(--fast) var(--ease-out), border-color var(--fast); }
.qa:hover { border-color: var(--paper); }
.qa:active { transform: scale(.96); }
.qa-icon { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 8px; border: 2px solid #000; border-radius: 14px; box-shadow: 3px 3px 0 #000; }
.qa-paper { background: var(--paper); color: var(--on-color); }
.qa strong { font-size: 16px; }
.qa small { color: var(--muted); font-size: 12px; }
.switch-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: var(--r-md); background: var(--ink-3); }
.switch-row.on { border-color: var(--lime); }
</style>
