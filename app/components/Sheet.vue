<script setup lang="ts">
import { X } from 'lucide-vue-next'
const props = defineProps<{ open: boolean; title?: string; kicker?: string }>()
const emit = defineEmits<{ close: [] }>()
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && props.open) emit('close') }
watch(() => props.open, (o) => { if (typeof document !== 'undefined') document.documentElement.style.overflow = o ? 'hidden' : '' })
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" @click.self="emit('close')">
        <section class="sheet" role="dialog" aria-modal="true" :aria-label="title">
          <div class="grabber" />
          <header v-if="title" class="sheet-head">
            <div>
              <p v-if="kicker" class="kicker">{{ kicker }}</p>
              <h2 class="display h-md">{{ title }}</h2>
            </div>
            <button class="icon-btn" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button>
          </header>
          <div class="sheet-body"><slot /></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop { position: fixed; inset: 0; z-index: 150; display: flex; align-items: flex-end; justify-content: center; background: #000000b3; backdrop-filter: blur(6px); }
.sheet { width: 100%; max-width: 560px; max-height: 92dvh; overflow: auto; padding: 8px 20px calc(24px + env(safe-area-inset-bottom)); border: 2px solid #000; border-bottom: 0; border-radius: 28px 28px 0 0; background: var(--ink-2); box-shadow: 0 -2px 0 var(--line-strong) inset; }
.grabber { width: 42px; height: 5px; margin: 4px auto 14px; border-radius: 99px; background: var(--line-strong); }
.sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.sheet-head .kicker { margin: 0 0 6px; }
.sheet-head h2 { margin: 0; font-size: 28px; }
@media (min-width: 700px) {
  .sheet-backdrop { align-items: center; }
  .sheet { border-radius: 28px; border-bottom: 2px solid #000; box-shadow: 8px 8px 0 #000; }
}
.sheet-enter-active { transition: opacity var(--base) var(--ease-out); }
.sheet-leave-active { transition: opacity var(--fast) var(--ease-in); }
.sheet-enter-active .sheet { transition: transform var(--slow) cubic-bezier(.2, .9, .3, 1.08); }
.sheet-leave-active .sheet { transition: transform var(--fast) var(--ease-in); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
@media (min-width: 700px) { .sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(24px) scale(.96); } }
</style>
