<template>
  <div>
    <h1>이우백두 21기 백두대간 종주 기록</h1>
    <div id="map"></div>
    <div class="controls">
      <label style="margin-right: 16px;">
        <input type="checkbox" v-model="showCompleted" />
        진행중 백두대간 보기
      </label>
      <label>
        <input type="checkbox" v-model="showMarkers" />
        마커 표시
      </label>
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

const showMarkers = ref(true)
const showCompleted = ref(false) // false: 진행중(data), true: 전체(completed)
let map: L.Map | null = null
let loadedGpxLayers: any[] = []

const dataFiles = ref<string[]>([])
const completedFiles = ref<string[]>([])

async function fetchFileLists() {
  const dataRes = await fetch(`${baseURL}data/filelist.json`)
  dataFiles.value = (await dataRes.json()).map((f: string) => `${baseURL}data/${f}`)
  const completedRes = await fetch(`${baseURL}completed/filelist.json`)
  completedFiles.value = (await completedRes.json()).map((f: string) => `${baseURL}completed/${f}`)
}

const gpxFiles = computed(() => showCompleted.value ? completedFiles.value : dataFiles.value)

function clearGpxLayers() {
  loadedGpxLayers.forEach(layer => map?.removeLayer(layer))
  loadedGpxLayers = []
}

function reloadGpxLayers() {
  clearGpxLayers()
  loadGpxFiles()
}

function loadGpxFiles() {
  if (!map) return
  const bounds = new L.LatLngBounds()
  gpxFiles.value.forEach((gpxUrl, idx) => {
    const gpxLayer = new (window as any).L.GPX(gpxUrl, {
      async: true,
      markers: {
        startIcon: showMarkers.value && showCompleted.value ? new L.Icon.Default() : false,
        endIcon: false,
        shadowUrl: showMarkers.value && showCompleted.value ? L.Icon.Default.prototype.options.shadowUrl : false,
        wptIcon: showMarkers.value && showCompleted.value ? new L.Icon.Default() : false
      },
      polyline_options: {
        color: 'red',
        weight: 5,
        opacity: 0.8
      }
    }).on('loaded', function(e: any) {
      bounds.extend(e.target.getBounds())
      // 시작점에 마커 및 팝업 표시
      const gpx = e.target
      if (gpx._layers) {
        const layers = Object.values(gpx._layers)
        for (const layer of layers) {
          if (layer._layers) {
            const subLayers = Object.values(layer._layers)
            for (const subLayer of subLayers) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const sl = subLayer as any
              if (sl._latlngs && sl._latlngs.length > 0) {
                const firstPoint = sl._latlngs[0]
                // GPX 이름 우선: metadata->name, trk->name, 그 외 파일명 폴백
                const gpxAny = gpx as any
                const nameFromApi = typeof gpxAny.get_name === 'function' ? gpxAny.get_name() : ''
                const nameFromInfo = gpxAny._info && gpxAny._info.name ? gpxAny._info.name : ''
                const nameFromRaw = gpxAny._gpx ? (
                  (gpxAny._gpx.metadata && gpxAny._gpx.metadata.name) ||
                  (gpxAny._gpx.trk && gpxAny._gpx.trk.name) ||
                  ''
                ) : ''
                const fallbackFromFilename = gpxUrl.split('/').pop()?.replace('.gpx', '') || ''
                const title = (nameFromApi || nameFromInfo || nameFromRaw || fallbackFromFilename) as string
                const startMarker = L.marker([firstPoint.lat, firstPoint.lng], {})
                  .bindPopup(title, { permanent: true, direction: 'top' })
                if (showMarkers.value) {
                  startMarker.addTo(map!)
                  loadedGpxLayers.push(startMarker)
                }
                break
              }
            }
          }
        }
      }
      if (idx === gpxFiles.value.length - 1 && bounds.isValid()) {
        map.fitBounds(bounds)
      }
    }).addTo(map)
    loadedGpxLayers.push(gpxLayer)
  })
}

onMounted(async () => {
  map = L.map('map').setView([36.8, 127.8], 8)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map)
  await fetchFileLists()
  loadGpxFiles()
})

watch([showMarkers, showCompleted], reloadGpxLayers)
</script>

<style scoped>
body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f4f4f4;
  text-align: center;
  overflow: hidden;
}
h1 {
  color: #333;
  margin: 10px 0;
  font-size: 1.8em;
  text-align: center;
}
#map {
  height: calc(100vh - 120px);
  width: 100vw;
  max-width: none;
  margin: 0 auto;
  border: none;
  border-radius: 0;
  box-shadow: none;
}
.controls {
  margin-top: 10px;
  padding-bottom: 10px;
  text-align: center;
}
.controls p {
  margin-top: 10px;
  font-size: 13px;
  color: #666;
  text-align: center;
}
.controls label {
  display: inline-block;
  text-align: center;
}
.controls button {
  padding: 10px 15px;
  margin: 5px;
  border: none;
  border-radius: 5px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;
}
.controls button:hover {
  background-color: #0056b3;
}
</style> 