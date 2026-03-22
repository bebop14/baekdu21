<template>
  <div class="app-container">
    <!-- 지도 (전체 화면) -->
    <div
      id="map"
      role="application"
      aria-label="백두대간 종주 경로 지도"
    ></div>

    <!-- 지도 위 오버레이 패널 -->
    <div class="overlay-panel">
      <h1 class="title">이우백두 21기</h1>
      <p class="subtitle">백두대간 종주 기록</p>

      <!-- 진행 현황 -->
      <div class="progress-info">
        <div class="progress-bar-container">
          <div
            class="progress-bar-fill"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
        <span class="progress-text">
          {{ completedFiles.length }} / {{ dataFiles.length }} 구간 완료
        </span>
      </div>

      <!-- 토글 컨트롤 -->
      <div class="controls">
        <label class="toggle-label">
          <span class="toggle-text">완료 구간만 보기</span>
          <button
            type="button"
            role="switch"
            :aria-checked="showCompletedOnly"
            class="toggle-switch"
            :class="{ active: showCompletedOnly }"
            @click="showCompletedOnly = !showCompletedOnly"
          >
            <span class="toggle-knob"></span>
          </button>
        </label>
        <label class="toggle-label">
          <span class="toggle-text">마커 표시</span>
          <button
            type="button"
            role="switch"
            :aria-checked="showMarkers"
            class="toggle-switch"
            :class="{ active: showMarkers }"
            @click="showMarkers = !showMarkers"
          >
            <span class="toggle-knob"></span>
          </button>
        </label>
      </div>
    </div>

    <!-- 로딩 표시기 -->
    <div v-if="isLoading" class="loading-indicator">
      <div class="loading-spinner"></div>
      <span>{{ loadedCount }} / {{ totalCount }} 구간 로드 중...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-gpx'

const config = useRuntimeConfig()
const baseURL = config.app.baseURL || '/'

const defaultIcon = L.icon({
  iconUrl: `${baseURL}marker-icon.png`,
  iconRetinaUrl: `${baseURL}marker-icon-2x.png`,
  shadowUrl: `${baseURL}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const showMarkers = ref(true)
const showCompletedOnly = ref(true)
let map: L.Map | null = null
let gpxLayers: any[] = []
let markerLayers: L.Marker[] = []

const dataFiles = ref<string[]>([])
const completedFiles = ref<string[]>([])

const isLoading = ref(false)
const loadedCount = ref(0)
const totalCount = ref(0)

const progressPercent = computed(() => {
  if (dataFiles.value.length === 0) return 0
  return Math.round((completedFiles.value.length / dataFiles.value.length) * 100)
})

const gpxFiles = computed(() =>
  showCompletedOnly.value ? completedFiles.value : dataFiles.value
)

const trackColor = computed(() =>
  showCompletedOnly.value ? '#2563eb' : '#dc2626'
)

async function fetchFileLists() {
  const dataRes = await fetch(`${baseURL}data/filelist.json`)
  dataFiles.value = (await dataRes.json()).map((f: string) => `${baseURL}data/${f}`)
  const completedRes = await fetch(`${baseURL}completed/filelist.json`)
  completedFiles.value = (await completedRes.json()).map((f: string) => `${baseURL}completed/${f}`)
}

function clearGpxLayers() {
  gpxLayers.forEach(layer => map?.removeLayer(layer))
  gpxLayers = []
  clearMarkers()
}

function clearMarkers() {
  markerLayers.forEach(marker => map?.removeLayer(marker))
  markerLayers = []
}

function toggleMarkerVisibility() {
  if (showMarkers.value) {
    // 마커가 없으면 현재 GPX 레이어에서 다시 생성
    if (markerLayers.length === 0) {
      gpxLayers.forEach(gpxLayer => {
        addMarkerForGpxLayer(gpxLayer)
      })
    } else {
      markerLayers.forEach(marker => marker.addTo(map!))
    }
  } else {
    markerLayers.forEach(marker => map?.removeLayer(marker))
  }
}

function addMarkerForGpxLayer(gpxLayer: any) {
  if (!map) return
  let startLatLng: L.LatLng | null = null
  gpxLayer.getLayers().forEach((layer: any) => {
    if (!startLatLng && layer.getLatLngs) {
      const latlngs = layer.getLatLngs()
      if (latlngs && latlngs.length > 0) {
        startLatLng = Array.isArray(latlngs[0]) ? latlngs[0][0] : latlngs[0]
      }
    }
  })
  if (startLatLng) {
    const title = gpxLayer.get_name() || ''
    const marker = L.marker(startLatLng, { icon: defaultIcon }).bindPopup(title)
    if (showMarkers.value) {
      marker.addTo(map!)
    }
    markerLayers.push(marker)
  }
}

function loadGpxFiles() {
  if (!map) return
  const bounds = new L.LatLngBounds()
  const files = gpxFiles.value
  const color = trackColor.value

  isLoading.value = true
  loadedCount.value = 0
  totalCount.value = files.length

  let completedLoads = 0

  files.forEach((gpxUrl) => {
    const gpxLayer = new (window as any).L.GPX(gpxUrl, {
      async: true,
      markers: {
        startIcon: false,
        endIcon: false,
        shadowUrl: false,
        wptIcon: false
      },
      polyline_options: {
        color,
        weight: 5,
        opacity: 0.9
      }
    }).on('loaded', function(e: any) {
      bounds.extend(e.target.getBounds())
      addMarkerForGpxLayer(e.target)

      completedLoads++
      loadedCount.value = completedLoads

      // 모든 파일 로드 완료 시 fitBounds
      if (completedLoads === files.length && bounds.isValid()) {
        map!.fitBounds(bounds, { padding: [20, 20] })
        isLoading.value = false
      }
    }).addTo(map)
    gpxLayers.push(gpxLayer)
  })

  // 파일이 0개인 경우
  if (files.length === 0) {
    isLoading.value = false
  }
}

function reloadGpxLayers() {
  clearGpxLayers()
  loadGpxFiles()
}

onMounted(async () => {
  map = L.map('map').setView([36.8, 127.8], 8)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map)
  await fetchFileLists()
  loadGpxFiles()
})

// showCompletedOnly 변경 시만 전체 재로드
watch(showCompletedOnly, reloadGpxLayers)

// showMarkers 변경 시 마커만 show/hide (GPX 재로드 없음)
watch(showMarkers, toggleMarkerVisibility)
</script>

<style scoped>
.app-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

#map {
  position: absolute;
  inset: 0;
  z-index: 0;
}

/* 오버레이 패널 */
.overlay-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;
  background: rgba(26, 26, 46, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 16px 20px;
  color: #e2e8f0;
  min-width: 220px;
  max-width: 300px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.title {
  margin: 0;
  font-size: 1.1em;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 2px 0 12px;
  font-size: 0.8em;
  color: #94a3b8;
  font-weight: 400;
}

/* 진행 현황 */
.progress-info {
  margin-bottom: 14px;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  border-radius: 3px;
  transition: width 0.6s ease;
}

.progress-text {
  font-size: 0.75em;
  color: #94a3b8;
}

/* 토글 컨트롤 */
.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toggle-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}

.toggle-text {
  font-size: 0.85em;
  color: #cbd5e1;
  user-select: none;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
  padding: 0;
}

.toggle-switch:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.toggle-switch.active {
  background: #22c55e;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(20px);
}

/* 로딩 표시기 */
.loading-indicator {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: rgba(26, 26, 46, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 24px;
  padding: 8px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #e2e8f0;
  font-size: 0.85em;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #22c55e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 모바일 반응형 */
@media (max-width: 480px) {
  .overlay-panel {
    top: 8px;
    left: 8px;
    right: 8px;
    max-width: none;
    padding: 12px 16px;
  }

  .title {
    font-size: 1em;
  }

  .loading-indicator {
    bottom: 16px;
    font-size: 0.8em;
  }
}
</style>
