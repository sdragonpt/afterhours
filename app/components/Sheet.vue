<script setup lang="ts">
import { X } from 'lucide-vue-next'
const props = defineProps<{ open: boolean; title?: string; kicker?: string }>()
const emit = defineEmits<{ close: [] }>()
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && props.open) emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <!-- scrim and panel animate separately: scrim = opacity only, panel = transform only (GPU, no repaint) -->
    <Transition name="scrim">
      <div v-if="open" class="scrim" aria-hidden="true" @click="emit('close')" />
    </Transition>
    <Transition name="panel" :duration="{ enter: 280, leave: 180 }">
      <div v-if="open" class="sheet-wrap" @click.self="emit('close')">
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
.scrim { position: fixed; inset: 0; z-index: 150; background: rgba(0, 0, 0, .72); touch-action: none; }
.sheet-wrap { position: fixed; inset: 0; z-index: 151; display: flex; align-items: flex-end; justify-content: center; pointer-events: none; }
.sheet {
  pointer-events: auto;
  width: 100%; max-width: 560px; max-height: 92dvh; overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  padding: 8px 20px calc(24px + env(safe-area-inset-bottom));
  border: 2px solid #000; border-bottom: 0; border-radius: 28px 28px 0 0;
  background: var(--ink-2); box-shadow: 0 -2px 0 var(--line-strong) inset;
  will-change: transform; contain: layout paint;
}
.grabber { width: 42px; height: 5px; margin: 4px auto 14px; border-radius: 99px; background: var(--line-strong); }
.sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.sheet-head .kicker { margin: 0 0 6px; }
.sheet-head h2 { margin: 0; font-size: 28px; }
@media (min-width: 700px) {
  .sheet-wrap { align-items: center; }
  .sheet { border-radius: 28px; border-bottom: 2px solid #000; box-shadow: 8px 8px 0 #000; }
}

/* scrim: fade */
.scrim-enter-active { transition: opacity 200ms ease-out; }
.scrim-leave-active { transition: opacity 160ms ease-in; }
.scrim-enter-from, .scrim-leave-to { opacity: 0; }

/* panel: iOS-like slide (fast start, soft landing, no overshoot) */
.panel-enter-active .sheet { transition: transform 280ms cubic-bezier(.22, 1, .36, 1); }
.panel-leave-active .sheet { transition: transform 180ms cubic-bezier(.4, 0, 1, 1); }
.panel-enter-from .sheet, .panel-leave-to .sheet { transform: translate3d(0, 100%, 0); }
@media (min-width: 700px) {
  .panel-enter-from .sheet, .panel-leave-to .sheet { transform: translate3d(0, 20px, 0) scale(.97); opacity: 0; }
  .panel-enter-active .sheet { transition: transform 220ms cubic-bezier(.22, 1, .36, 1), opacity 160ms ease-out; }
}
</style>
