<script setup lang="ts">
import { MapPin, Search, LoaderCircle, Crosshair, X } from 'lucide-vue-next'

type LocationValue = { lat: number; lng: number; label: string } | null
const props = defineProps<{ modelValue: LocationValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: LocationValue] }>()

const mapElement = ref<HTMLElement | null>(null)
const searchText = ref('')
const results = ref<any[]>([])
const searching = ref(false)
const mapReady = ref(false)
const mapError = ref('')
let map: any = null
let marker: any = null
let leaflet: any = null

function setSelection(lat: number, lng: number, label: string) {
  const value = { lat, lng, label }
  emit('update:modelValue', value)
  searchText.value = label
  results.value = []
  if (map && leaflet) {
    map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true })
    if (marker) marker.remove()
    marker = leaflet.circleMarker([lat, lng], { radius: 9, color: '#d9ceff', weight: 3, fillColor: '#9478ff', fillOpacity: 1 }).addTo(map)
  }
}

async function reverseLookup(lat: number, lng: number) {
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`)
    if (!response.ok) throw new Error('Não foi possível identificar este local.')
    const data = await response.json()
    const p = data.features?.[0]?.properties
    const label = p ? [p.name, p.street, p.city || p.locality, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    setSelection(lat, lng, label)
  } catch {
    setSelection(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }
}

async function searchPlaces() {
  if (!searchText.value.trim()) return
  searching.value = true
  mapError.value = ''
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchText.value.trim())}&limit=6&lang=pt`)
    if (!response.ok) throw new Error('Pesquisa de locais indisponível.')
    const data = await response.json()
    results.value = data.features || []
    if (!results.value.length) mapError.value = 'Não encontrámos esse local. Experimenta outro nome.'
  } catch (e: any) {
    mapError.value = e?.message || 'Não foi possível pesquisar o local.'
  } finally {
    searching.value = false
  }
}

function chooseResult(feature: any) {
  const [lng, lat] = feature.geometry.coordinates
  const p = feature.properties || {}
  const label = [p.name, p.street, p.city || p.locality, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')
  setSelection(lat, lng, label || searchText.value)
}

onMounted(async () => {
  try {
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
    leaflet = L.default || L
    if (!mapElement.value) return
    map = leaflet.map(mapElement.value, { zoomControl: false, scrollWheelZoom: true }).setView([39.5, -8.0], 6)
    leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20,
    }).addTo(map)
    leaflet.control.zoom({ position: 'bottomright' }).addTo(map)
    map.on('click', (event: any) => reverseLookup(event.latlng.lat, event.latlng.lng))
    if (props.modelValue) setSelection(props.modelValue.lat, props.modelValue.lng, props.modelValue.label)
    mapReady.value = true
    setTimeout(() => map?.invalidateSize(), 100)
  } catch {
    mapError.value = 'Não foi possível carregar o mapa. Podes continuar a pesquisar locais.'
  }
})

watch(() => props.modelValue, (value) => {
  if (value && map && leaflet) setSelection(value.lat, value.lng, value.label)
})
onBeforeUnmount(() => { map?.remove(); map = null })
</script>

<template>
  <div class="location-picker">
    <form class="location-search" @submit.prevent="searchPlaces">
      <Search :size="16" />
      <input v-model="searchText" placeholder="Pesquisar restaurante, bar, morada..." aria-label="Pesquisar local" />
      <button type="submit" :disabled="searching"><LoaderCircle v-if="searching" class="spin" :size="15"/><Search v-else :size="15"/><span class="sr-only">Pesquisar</span></button>
    </form>
    <div v-if="results.length" class="location-results">
      <button v-for="(feature, index) in results" :key="index" type="button" @click="chooseResult(feature)">
        <MapPin :size="15"/><span><strong>{{ feature.properties.name || feature.properties.street || 'Local encontrado' }}</strong><small>{{ [feature.properties.street, feature.properties.city || feature.properties.locality, feature.properties.country].filter(Boolean).join(', ') }}</small></span>
      </button>
    </div>
    <div ref="mapElement" class="location-map" aria-label="Mapa interativo para escolher o local" />
    <div class="map-hint"><Crosshair :size="13"/> Pesquisa um local ou toca no mapa para colocar o marcador.</div>
    <div v-if="modelValue" class="selected-location"><MapPin :size="15"/><span><strong>Local selecionado</strong><small>{{ modelValue.label }}</small></span><button type="button" aria-label="Remover local" @click="emit('update:modelValue', null); searchText = ''; if(marker){marker.remove();marker=null}"><X :size="15"/></button></div>
    <p v-if="mapError" class="map-error">{{ mapError }}</p>
  </div>
</template>

<style scoped>
.location-picker{position:relative;display:flex;flex-direction:column;gap:9px}.location-search{height:43px;display:flex;align-items:center;gap:10px;padding:0 11px;border:1px solid var(--line);border-radius:9px;background:#11141c;color:#9d89f2}.location-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#eef0f8;font-size:11px}.location-search input::placeholder{color:#697184}.location-search button{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:7px;background:#9b83ff20;color:#c6baff}.location-search button:disabled{opacity:.5}.location-results{position:absolute;z-index:1000;top:49px;left:0;right:0;max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:9px;background:#191c26;box-shadow:0 14px 35px #0009}.location-results button{display:flex;width:100%;align-items:center;gap:10px;padding:10px 12px;border:0;border-bottom:1px solid var(--line);background:transparent;color:#bbaaff;text-align:left}.location-results button:hover{background:#ffffff08}.location-results span{min-width:0}.location-results strong,.location-results small,.selected-location strong,.selected-location small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.location-results strong{color:#e8e9f1;font-size:10px}.location-results small,.selected-location small{margin-top:3px;color:#858b9b;font-size:9px}.location-map{height:245px;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:#171a23;z-index:1}.map-hint{display:flex;align-items:center;gap:6px;color:#777f91;font-size:9px}.selected-location{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #9b83ff32;border-radius:9px;background:#9b83ff0d;color:#b9a7ff}.selected-location span{min-width:0;flex:1}.selected-location strong{color:#e4e2f2;font-size:10px}.selected-location button{display:grid;place-items:center;width:26px;height:26px;border:0;border-radius:7px;background:#ffffff08;color:#9299aa}.map-error{margin:0;color:#ff9aab;font-size:10px}
</style>
