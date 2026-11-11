<script setup lang="ts">
import { PenSquare, Search } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Mensagens · Afterhours' })

const supabase = useSupabaseClient()
const dms = useDMs()
const root = ref<HTMLElement | null>(null)
useSwipeBack(root, '/')

type Thread = { other_id: string; name: string; color: string; last_body: string; last_at: string; last_from_me: boolean; unread: number }
type Contact = { user_id: string; name: string; color: string }
const threads = useState<Thread[]>('dm-threads', () => [])
const loaded = ref(threads.value.length > 0)
const contacts = ref<Contact[]>([])
const showNew = ref(false)
const search = ref('')

async function load() {
  const { data, error } = await supabase.rpc('dm_threads')
  if (!error) threads.value = (data || []) as Thread[]
  loaded.value = true
}
async function openNew() {
  showNew.value = true; search.value = ''
  const { data } = await supabase.rpc('dm_contacts')
  contacts.value = (data || []) as Contact[]
}
const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('pt-PT')
  return q ? contacts.value.filter(c => c.name.toLocaleLowerCase('pt-PT').includes(q)) : contacts.value
})

let debounce: ReturnType<typeof setTimeout> | undefined
const off = dms.onMessage(() => { clearTimeout(debounce); debounce = setTimeout(load, 250) })
onBeforeUnmount(() => { off(); clearTimeout(debounce) })
onMounted(load)
</script>

<template>
  <div ref="root" class="flex flex-col gap-5 swipe-page">
    <header class="flex items-end justify-between gap-3 pt-2">
      <div>
        <p class="kicker">Privado</p>
        <h1 class="display h-xl m-0">Mensagens<span class="t-lime">.</span></h1>
      </div>
      <button class="btn btn-primary btn-sm" @click="openNew"><PenSquare :size="16" /> Nova</button>
    </header>

    <div v-if="!loaded" class="flex flex-col gap-3">
      <div v-for="i in 4" :key="i" class="skeleton" style="height:64px" />
    </div>

    <TransitionGroup v-else-if="threads.length" name="list" tag="div" class="flex flex-col">
      <NuxtLink v-for="t in threads" :key="t.other_id" :to="`/messages/${t.other_id}`" class="thread" :class="{ unread: t.unread }">
        <Avatar :name="t.name" :color="t.color" :size="52" />
        <span class="flex-1 min-w-0">
          <strong class="block truncate">{{ t.name }}</strong>
          <span class="preview truncate">{{ t.last_from_me ? 'Tu: ' : '' }}{{ t.last_body }}</span>
        </span>
        <span class="side">
          <small>{{ ago(t.last_at) }}</small>
          <i v-if="t.unread" class="dot">{{ t.unread > 9 ? '9+' : t.unread }}</i>
        </span>
      </NuxtLink>
    </TransitionGroup>

    <div v-else class="empty sticker">
      <p class="display h-md m-0">Nada por aqui ainda.</p>
      <p class="muted m-0 mt-1">Manda mensagem a alguém da tua malta. Só vocês os dois veem a conversa.</p>
      <button class="btn btn-primary mt-4" @click="openNew"><PenSquare :size="16" /> Nova mensagem</button>
    </div>

    <Sheet :open="showNew" kicker="Mensagem" title="Para quem?" @close="showNew = false">
      <div class="flex flex-col gap-3">
        <label class="search">
          <Search :size="16" class="faint" />
          <input v-model="search" class="flex-1" placeholder="Procurar na malta…" autocomplete="off">
        </label>
        <NuxtLink v-for="c in filtered" :key="c.user_id" :to="`/messages/${c.user_id}`" class="contact" @click="showNew = false">
          <Avatar :name="c.name" :color="c.color" :size="40" />
          <strong class="truncate">{{ c.name }}</strong>
        </NuxtLink>
        <p v-if="!filtered.length" class="muted text-center">{{ contacts.length ? 'Ninguém com esse nome.' : 'Ainda não tens ninguém nas tuas comunidades.' }}</p>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.thread { display: flex; align-items: center; gap: 14px; padding: 12px 6px; border-bottom: 1.5px solid var(--line); border-radius: 14px; transition: background-color var(--fast); }
.thread:hover { background: var(--ink-2); }
.thread:active { transform: scale(.99); }
.preview { display: block; margin-top: 2px; color: var(--muted); font-size: 14px; }
.thread.unread strong { color: var(--paper); }
.thread.unread .preview { color: var(--paper); font-weight: 700; }
.side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex: none; }
.side small { color: var(--faint); font-size: 12px; }
.dot { display: grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border: 2px solid #000; border-radius: 99px; background: var(--coral); color: #000; font-size: 11px; font-style: normal; font-weight: 800; }
.empty { padding: 22px; background: var(--ink-2); }
.search { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; border: 1.5px solid var(--line-strong); border-radius: 999px; background: var(--ink); }
.search input { border: 0; background: none; color: var(--paper); outline: none; font-size: 16px; }
.contact { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 14px; }
.contact:hover { background: var(--ink-3); }
</style>
