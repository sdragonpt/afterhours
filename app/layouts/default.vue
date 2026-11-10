<script setup lang="ts">
import { House, Gamepad2, CalendarDays, Wallet, Users, Settings, Plus, ChevronDown, LogOut, Copy, Check, X, Menu } from 'lucide-vue-next'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const activeCommunity = useCommunity()
const route = useRoute()
const groups = ref<any[]>([])
const profile = ref<any>(null)
const loading = ref(true)
const showCreate = ref(false)
const showMobileNav = ref(false)
const groupName = ref('')
const inviteLink = ref('')
const copied = ref(false)
const error = ref('')
const creating = ref(false)

const nav = [
  { label: 'Overview', to: '/', icon: House },
  { label: 'Gaming hub', to: '/gaming', icon: Gamepad2 },
  { label: 'Plans & events', to: '/plans', icon: CalendarDays },
  { label: 'The Tab', to: '/tab', icon: Wallet },
  { label: 'Members', to: '/community', icon: Users },
]
const initials = computed(() => (profile.value?.display_name || user.value?.email || 'A').slice(0, 1).toUpperCase())
const activeGroup = computed(() => groups.value.find(g => g.id === activeCommunity.value))

async function loadShell() {
  if (!user.value) return
  loading.value = true
  const [groupResult, profileResult] = await Promise.all([
    supabase.from('groups').select('id,name,owner_id,created_at').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id,display_name').eq('id', user.value.id).maybeSingle(),
  ])
  if (!groupResult.error) {
    groups.value = groupResult.data || []
    if (!groups.value.some(g => g.id === activeCommunity.value)) activeCommunity.value = groups.value[0]?.id || null
  }
  profile.value = profileResult.data
  loading.value = false
}
async function createCommunity() {
  if (!groupName.value.trim()) return
  creating.value = true; error.value = ''
  const { data, error: rpcError } = await supabase.rpc('create_group', { p_name: groupName.value.trim() })
  creating.value = false
  if (rpcError) { error.value = rpcError.message; return }
  groupName.value = ''; showCreate.value = false
  await loadShell(); activeCommunity.value = data
}
async function makeInvite() {
  if (!activeCommunity.value) return
  if (activeGroup.value?.owner_id !== user.value?.id) { error.value = 'Only the community owner can create invite links.'; return }
  const { data, error: rpcError } = await supabase.rpc('create_group_invite', { p_group: activeCommunity.value })
  if (rpcError) { error.value = rpcError.message; return }
  inviteLink.value = `${window.location.origin}/join?token=${data}`
}
async function copyInvite() {
  await navigator.clipboard.writeText(inviteLink.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1800)
}
async function signOut() { await supabase.auth.signOut(); await navigateTo('/login') }
watch(() => user.value?.id, loadShell)
onMounted(loadShell)
</script>

<template>
  <div class="app-shell min-h-screen">
    <aside class="sidebar hidden lg:flex">
      <NuxtLink to="/" class="brand-lockup">
        <span class="brand-mark">A<span>.</span></span>
        <span><strong>AFTERHOURS</strong><small>YOUR PEOPLE. YOUR WORLD.</small></span>
      </NuxtLink>

      <div class="sidebar-section">
        <div class="section-heading"><span>WORKSPACE</span><button class="icon-button small" title="Criar comunidade" @click="showCreate = true"><Plus :size="15"/></button></div>
        <div class="community-switcher">
          <span class="community-glyph">{{ activeGroup?.name?.slice(0,1).toUpperCase() || 'A' }}</span>
          <select v-model="activeCommunity" aria-label="Selecionar comunidade">
            <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
            <option v-if="!groups.length" value="">Sem comunidades</option>
          </select>
          <ChevronDown :size="14" class="muted-icon"/>
        </div>
      </div>

      <div class="sidebar-section nav-section">
        <div class="section-heading"><span>MENU</span></div>
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="nav-link" :class="{ active: route.path === item.to }">
          <component :is="item.icon" :size="18" :stroke-width="1.8"/><span>{{ item.label }}</span>
          <span v-if="item.to === '/tab'" class="nav-dot"/>
        </NuxtLink>
      </div>

      <div class="sidebar-section community-tools">
        <div class="section-heading"><span>YOUR SPACE</span></div>
        <button v-if="activeGroup?.owner_id === user?.id" class="nav-link" @click="makeInvite"><Copy :size="17"/><span>Invite friends</span></button>
        <NuxtLink to="/profile" class="nav-link" :class="{ active: route.path === '/profile' }"><Settings :size="17"/><span>Profile settings</span></NuxtLink>
      </div>

      <div class="sidebar-bottom">
        <div class="sidebar-status"><span class="online-pulse"/><span>{{ groups.length }} {{ groups.length === 1 ? 'community' : 'communities' }} connected</span></div>
        <button class="user-card" @click="navigateTo('/profile')">
          <span class="avatar">{{ initials }}</span>
          <span class="user-meta"><strong>{{ profile?.display_name || user?.email?.split('@')[0] || 'Member' }}</strong><small>Community member</small></span>
          <ChevronDown :size="15" class="muted-icon"/>
        </button>
        <button class="signout-link" @click="signOut"><LogOut :size="15"/> Sign out</button>
      </div>
    </aside>

    <div class="mobile-topbar lg:hidden">
      <NuxtLink to="/" class="brand-lockup"><span class="brand-mark">A<span>.</span></span><strong>AFTERHOURS</strong></NuxtLink>
      <button class="icon-button" @click="showMobileNav = !showMobileNav"><Menu :size="20"/></button>
    </div>
    <div v-if="showMobileNav" class="mobile-menu lg:hidden">
      <div class="community-switcher"><span class="community-glyph">{{ activeGroup?.name?.slice(0,1).toUpperCase() || 'A' }}</span><select v-model="activeCommunity"><option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option></select></div>
      <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="nav-link" @click="showMobileNav = false"><component :is="item.icon" :size="18"/>{{ item.label }}</NuxtLink>
      <button class="nav-link" @click="showCreate = true; showMobileNav = false"><Plus :size="18"/> Create community</button><button v-if="activeGroup?.owner_id === user?.id" class="nav-link" @click="makeInvite"><Copy :size="18"/> Invite friends</button>
      <button class="nav-link" @click="signOut"><LogOut :size="18"/> Sign out</button>
    </div>

    <div class="main-column">
      <header class="topbar hidden lg:flex">
        <div class="breadcrumb"><span>Workspace</span><span class="breadcrumb-slash">/</span><strong>{{ activeGroup?.name || 'Your space' }}</strong></div>
        <div class="topbar-actions">
          <span class="topbar-community">{{ groups.length }} {{ groups.length === 1 ? 'community' : 'communities' }}</span>
          <button class="avatar avatar-small" @click="navigateTo('/profile')">{{ initials }}</button>
        </div>
      </header>
      <main class="page-content"><slot /></main>
    </div>

    <nav class="mobile-bottom-nav lg:hidden">
      <NuxtLink v-for="item in nav.slice(0,4)" :key="item.to" :to="item.to" :class="{ active: route.path === item.to }"><component :is="item.icon" :size="19"/><span>{{ item.label === 'Gaming hub' ? 'Gaming' : item.label === 'Plans & events' ? 'Plans' : item.label === 'The Tab' ? 'Tab' : 'Home' }}</span></NuxtLink>
      <NuxtLink to="/community" :class="{ active: route.path === '/community' }"><Users :size="19"/><span>Group</span></NuxtLink>
    </nav>

    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
      <section class="modal-card">
        <div class="modal-heading"><div><span class="eyebrow">NEW WORKSPACE</span><h2>Create a community</h2></div><button class="icon-button" @click="showCreate = false"><X :size="18"/></button></div>
        <form class="stack-form" @submit.prevent="createCommunity"><label>Community name<input v-model="groupName" class="field" maxlength="60" placeholder="e.g. The usual suspects" required/></label><p v-if="error" class="form-error">{{ error }}</p><button class="primary-button" :disabled="creating">{{ creating ? 'Creating...' : 'Create community' }}</button></form>
      </section>
    </div>
    <div v-if="inviteLink" class="toast-card"><div><strong>Invite link ready</strong><span>{{ inviteLink }}</span></div><button class="icon-button small" @click="copyInvite">{{ copied ? 'Copied' : 'Copy' }}</button><button class="icon-button small" @click="inviteLink = ''"><X :size="15"/></button></div>
  </div>
</template>
