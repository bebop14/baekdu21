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
      <div class="panel-header">
        <h1 class="title">이우백두 21기</h1>
        <button
          class="collapse-btn"
          @click="isPanelExpanded = !isPanelExpanded"
          :aria-label="isPanelExpanded ? '패널 접기' : '패널 펼치기'"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline v-if="isPanelExpanded" points="18,15 12,9 6,15" />
            <polyline v-else points="6,9 12,15 18,9" />
          </svg>
        </button>
      </div>

      <!-- 진행 현황 (항상 표시) -->
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

      <!-- 접기/펼치기 영역 -->
      <div class="collapsible" v-show="isPanelExpanded">
        <p class="subtitle">백두대간 종주 기록</p>

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
    </div>

    <!-- 타임라인 슬라이더 (완료 구간 보기 모드에서만 표시) -->
    <div v-if="showCompletedOnly && timelineEntries.length > 0" class="timeline-panel">
      <div class="timeline-header">
        <button
          class="play-btn"
          :class="{ playing: isPlaying }"
          @click="togglePlay"
          :aria-label="isPlaying ? '정지' : '재생'"
        >
          <svg v-if="!isPlaying" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <rect x="5" y="3" width="4" height="18" />
            <rect x="15" y="3" width="4" height="18" />
          </svg>
        </button>
        <span class="timeline-label">
          {{ currentStepLabel }}
        </span>
      </div>
      <input
        type="range"
        class="timeline-slider"
        :min="0"
        :max="timelineEntries.length"
        v-model.number="timelineStep"
        :aria-label="'산행 진행 타임라인'"
        @input="onSliderInput"
      />
      <div class="timeline-ticks">
        <span>시작</span>
        <span>{{ timelineEntries.length }}차 완료</span>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
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
const isPanelExpanded = ref(false)
let map: L.Map | null = null
let gpxLayers: any[] = []
let markerLayers: L.Marker[] = []

const dataFiles = ref<string[]>([])
const completedFiles = ref<string[]>([])


// 타임라인 관련
interface TimelineEntry {
  file: string
  name: string
  order: number
}
const timelineEntries = ref<TimelineEntry[]>([])
const timelineStep = ref(0)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

const progressPercent = computed(() => {
  if (dataFiles.value.length === 0) return 0
  return Math.round((completedFiles.value.length / dataFiles.value.length) * 100)
})

// 타임라인 파일 URL 목록 (진행 순서)
const timelineFileUrls = computed(() =>
  timelineEntries.value.map(e => `${baseURL}completed/${e.file}`)
)

// 현재 타임라인 스텝에 해당하는 파일들
const timelineFiles = computed(() => {
  if (timelineStep.value >= timelineFileUrls.value.length) {
    return timelineFileUrls.value
  }
  return timelineFileUrls.value.slice(0, timelineStep.value)
})

const currentStepLabel = computed(() => {
  const total = timelineEntries.value.length
  const step = timelineStep.value
  if (step === 0) return '시작 전'
  if (step >= total) return `전체 ${total}개 구간`
  const entry = timelineEntries.value[step - 1]
  return `${entry.order}차 — ${entry.name.replace(/^\d+차\s*/, '')}`
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
  const timelineRes = await fetch(`${baseURL}completed/timeline.json`)
  timelineEntries.value = await timelineRes.json()
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

function loadGpxFilesFromList(files: string[], color: string, fitMap: boolean = true) {
  if (!map) return
  const bounds = new L.LatLngBounds()

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
      if (completedLoads === files.length && bounds.isValid() && fitMap) {
        map!.fitBounds(bounds, { padding: [20, 20] })
      }
    }).addTo(map)
    gpxLayers.push(gpxLayer)
  })

}

function loadGpxFiles() {
  loadGpxFilesFromList(gpxFiles.value, trackColor.value)
}

// 타임라인 슬라이더 조작 시
function onSliderInput() {
  stopPlay()
  clearGpxLayers()
  if (timelineStep.value === 0) return
  loadGpxFilesFromList(timelineFiles.value, '#2563eb')
}

// 재생/정지
function togglePlay() {
  if (isPlaying.value) {
    stopPlay()
  } else {
    startPlay()
  }
}

function startPlay() {
  if (timelineFileUrls.value.length === 0) return

  // 이미 끝까지 갔으면 처음부터
  if (timelineStep.value >= timelineFileUrls.value.length) {
    timelineStep.value = 0
    clearGpxLayers()
  }

  isPlaying.value = true
  playTimer = setInterval(() => {
    if (timelineStep.value >= timelineFileUrls.value.length) {
      stopPlay()
      return
    }
    timelineStep.value++
    // 새로 추가된 파일 하나만 로드
    const newFile = timelineFileUrls.value[timelineStep.value - 1]
    if (newFile) {
      loadGpxFilesFromList([newFile], '#2563eb', false)
    }
  }, 800)
}

function stopPlay() {
  isPlaying.value = false
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

onMounted(async () => {
  map = L.map('map').setView([36.8, 127.8], 8)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map)
  await fetchFileLists()
  // 초기: 타임라인을 최대로 설정 (전체 표시)
  timelineStep.value = timelineFileUrls.value.length
  loadGpxFiles()
})

// showCompletedOnly 변경 시 재로드 + 타임라인 리셋
watch(showCompletedOnly, (val) => {
  stopPlay()
  if (val) {
    timelineStep.value = timelineFileUrls.value.length
  }
  clearGpxLayers()
  loadGpxFiles()
})

// showMarkers 변경 시 마커만 show/hide
watch(showMarkers, toggleMarkerVisibility)

onUnmounted(() => {
  stopPlay()
})
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

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.title {
  margin: 0;
  font-size: 1.1em;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
}

.collapse-btn {
  display: none;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  line-height: 0;
  flex-shrink: 0;
  transition: color 0.15s ease, background 0.15s ease;
}

.collapse-btn:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.1);
}

.collapse-btn:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.collapsible {
  margin-top: 12px;
}

.subtitle {
  margin: 0 0 12px;
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

/* 타임라인 패널 */
.timeline-panel {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: rgba(26, 26, 46, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 12px 20px 10px;
  min-width: 320px;
  max-width: 500px;
  width: calc(100vw - 48px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.play-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.play-btn:hover {
  background: #1d4ed8;
}

.play-btn:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.play-btn.playing {
  background: #dc2626;
}

.play-btn.playing:hover {
  background: #b91c1c;
}

.timeline-label {
  font-size: 0.85em;
  color: #e2e8f0;
  font-weight: 500;
}

/* 슬라이더 커스텀 스타일 */
.timeline-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2563eb;
  border: 3px solid #fff;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.timeline-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2563eb;
  border: 3px solid #fff;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.timeline-slider:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.timeline-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 0.7em;
  color: #64748b;
  margin-top: 4px;
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

  .collapse-btn {
    display: flex;
  }

  .progress-info {
    margin-bottom: 0;
  }

  .timeline-panel {
    bottom: 12px;
    min-width: auto;
    width: calc(100vw - 24px);
    padding: 10px 14px 8px;
  }
}

/* 데스크탑에서는 항상 펼침 상태 유지 */
@media (min-width: 481px) {
  .collapsible {
    display: block !important;
  }
}
</style>
