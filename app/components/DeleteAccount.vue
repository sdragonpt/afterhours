<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
const supabase = useSupabaseClient()
const me = useMe()
const media = useMedia()
const toast = useToast()
const open = ref(false)
const confirmText = ref('')
const busy = ref(false)
const step = ref('')

async function run() {
  if (!me.value || confirmText.value.trim().toUpperCase() !== 'APAGAR') return
  busy.value = true
  try {
    // 1) my files first (the session is still valid now)
    step.value = 'A apagar fotos e clips…'
    const [posts, comments, groups, dmPhotos] = await Promise.all([
      supabase.from('posts').select('post_media(storage_path)').eq('author_id', me.value.id),
      supabase.from('post_comments').select('media_path').eq('user_id', me.value.id).not('media_path', 'is', null),
      supabase.from('group_members').select('group_id').eq('user_id', me.value.id),
      supabase.from('direct_messages').select('media_path').eq('sender_id', me.value.id).not('media_path', 'is', null),
    ])
    const paths = [
      ...(posts.data || []).flatMap((p: any) => (p.post_media || []).map((m: any) => m.storage_path)),
      ...(comments.data || []).map((c: any) => c.media_path),
      ...(dmPhotos.data || []).map((d: any) => d.media_path),
    ].filter(Boolean) as string[]
    for (const p of paths) await media.remove(p)
    // legacy Supabase Storage folders: <group>/<me>/*
    for (const g of groups.data || []) {
      const folder = `${g.group_id}/${me.value.id}`
      const { data: files } = await supabase.storage.from('community-media').list(folder, { limit: 1000 })
      if (files?.length) await supabase.storage.from('community-media').remove(files.map(f => `${folder}/${f.name}`))
    }

    // 2) the account itself
    step.value = 'A apagar a conta…'
    const { error } = await supabase.rpc('delete_my_account')
    if (error) throw error
    try { localStorage.clear() } catch {}
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    toast.ok('Conta apagada. Até à próxima 👋')
    await navigateTo('/login', { replace: true })
  } catch (e: any) {
    toast.error(e?.message || 'Não foi possível apagar a conta')
  } finally {
    busy.value = false; step.value = ''
  }
}
</script>

<template>
  <section class="danger">
    <button class="btn btn-ghost btn-block danger-btn" @click="open = true"><Trash2 :size="16" /> Apagar a minha conta</button>
    <Sheet :open="open" kicker="Conta" title="Apagar a conta?" @close="open = false">
      <div class="flex flex-col gap-4">
        <div class="muted text-sm flex flex-col gap-2">
          <p class="m-0"><b>É apagado:</b> o teu email e password, posts, fotos e clips, comentários, reações, planos e lobbies que criaste, notificações e widget.</p>
          <p class="m-0"><b>Fica anónimo:</b> as despesas e pagamentos em que participaste continuam no Tab como <b>"Ex-membro"</b>, para as contas dos outros baterem certo. Se deves dinheiro a alguém, isso não desaparece.</p>
          <p class="m-0"><b>Comunidades tuas:</b> passam para o membro mais antigo (ou são apagadas se estiveres sozinho).</p>
          <p class="m-0 t-coral font-bold">Não dá para desfazer.</p>
        </div>
        <label class="label" for="del-confirm">Escreve APAGAR para confirmar</label>
        <input id="del-confirm" v-model="confirmText" class="field" autocomplete="off" autocapitalize="characters" placeholder="APAGAR">
        <button class="btn btn-danger btn-block" :disabled="busy || confirmText.trim().toUpperCase() !== 'APAGAR'" @click="run">{{ busy ? step || 'A apagar…' : 'Apagar para sempre' }}</button>
      </div>
    </Sheet>
  </section>
</template>

<style scoped>
.danger-btn { color: var(--coral); border-color: #ff5a3655; }
.danger b { color: var(--paper); font-weight: 600; }
</style>
