<script setup lang="ts">
import { CalendarHeart, Gamepad2, Wallet, ShieldCheck, Flame } from 'lucide-vue-next'
/** Name + which features the community uses + language filter. Used to create and to edit. */
const model = defineModel<CommunityDraft>({ required: true })
defineProps<{ submitLabel: string; busy?: boolean }>()
defineEmits<{ submit: [] }>()

const options = [
  { key: 'plans', label: 'Planos', hint: 'Agenda, presenças, pôr no calendário', icon: CalendarHeart, color: 'coral' },
  { key: 'gaming', label: 'Gaming', hint: 'Lobbies, clips, quem joga', icon: Gamepad2, color: 'sky' },
  { key: 'tab', label: 'Tab', hint: 'Despesas e quem deve a quem', icon: Wallet, color: 'sun' },
] as const
function toggle(k: keyof Features) { model.value = { ...model.value, features: { ...model.value.features, [k]: !model.value.features[k] } } }
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="$emit('submit')">
    <div class="flex flex-col gap-2">
      <label class="label" for="cf-name">Nome</label>
      <input id="cf-name" v-model="model.name" class="field" maxlength="60" placeholder="Ex.: Os do costume" required>
    </div>

    <div class="flex flex-col gap-2">
      <span class="label">O que querem usar</span>
      <div class="opt always">
        <span class="opt-icon qa-paper"><Flame :size="18" /></span>
        <span class="flex-1 min-w-0"><b>Hoje</b><small>Feed, fotos, sondagens. Sempre ligado.</small></span>
      </div>
      <button v-for="o in options" :key="o.key" type="button" class="opt" :class="{ on: model.features[o.key] }" role="switch" :aria-checked="model.features[o.key]" @click="toggle(o.key)">
        <span class="opt-icon" :class="`fill-${o.color}`"><component :is="o.icon" :size="18" /></span>
        <span class="flex-1 min-w-0 text-left"><b>{{ o.label }}</b><small>{{ o.hint }}</small></span>
        <span class="switch" aria-hidden="true"><i /></span>
      </button>
    </div>

    <div class="flex flex-col gap-2">
      <span class="label">Linguagem</span>
      <button type="button" class="opt" :class="{ on: model.filter }" role="switch" :aria-checked="model.filter" @click="model = { ...model, filter: !model.filter }">
        <span class="opt-icon fill-mint"><ShieldCheck :size="18" /></span>
        <span class="flex-1 min-w-0 text-left"><b>Filtro de palavrões</b><small>Esconde asneiras em posts, comentários, sondagens e planos (ex.: c******). Bom para grupos de família.</small></span>
        <span class="switch" aria-hidden="true"><i /></span>
      </button>
    </div>

    <button class="btn btn-primary btn-block" :disabled="busy || !model.name.trim()">{{ busy ? 'A guardar…' : submitLabel }}</button>
  </form>
</template>

<style scoped>
.opt { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px; border: 1.5px solid var(--line); border-radius: 18px; background: var(--ink-2); color: var(--paper); transition: border-color var(--fast), background-color var(--fast); }
.opt.on { border-color: var(--line-strong); background: var(--ink-3); }
.opt.always { opacity: .75; }
.opt b { display: block; font-size: 15px; }
.opt small { display: block; margin-top: 1px; color: var(--muted); font-size: 12px; line-height: 1.3; }
.opt-icon { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border: 2px solid #000; border-radius: 12px; color: var(--on-color); }
.qa-paper { background: var(--paper); }
.switch { position: relative; flex: none; width: 44px; height: 26px; border: 2px solid #000; border-radius: 99px; background: var(--ink-4); transition: background-color var(--fast); }
.switch i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--paper); transition: transform var(--base) var(--ease-spring); }
.opt.on .switch { background: var(--lime); }
.opt.on .switch i { transform: translateX(18px); background: #000; }
</style>
