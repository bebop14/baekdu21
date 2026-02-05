<template>
  <div>
    <h1>이우백두 21기 백두대간 종주 기록</h1>
    <div id="map"></div>
    <div class="controls">
      <label style="margin-right: 16px;">
        <input type="checkbox" v-model="showInProgress" />
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

// Leaflet 기본 마커 아이콘 경로 수정 (baseURL 적용)
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
const showInProgress = ref(true) // true: 진행중(data), false: 전체(completed)
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

const gpxFiles = computed(() => showInProgress.value ? completedFiles.value : dataFiles.value)

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
        startIcon: false,
        endIcon: false,
        shadowUrl: false,
        wptIcon: false
      },
      polyline_options: {
        color: 'red',
        weight: 5,
        opacity: 0.8
      }
    }).on('loaded', function(e: any) {
      bounds.extend(e.target.getBounds())
      // 시작점에 마커 및 팝업 표시
      if (showMarkers.value) {
        const gpx = e.target
        // 트랙의 첫 번째 포인트 찾기
        let startLatLng: L.LatLng | null = null
        gpx.getLayers().forEach((layer: any) => {
          if (!startLatLng && layer.getLatLngs) {
            const latlngs = layer.getLatLngs()
            if (latlngs && latlngs.length > 0) {
              startLatLng = Array.isArray(latlngs[0]) ? latlngs[0][0] : latlngs[0]
            }
          }
        })
        if (startLatLng) {
          const title = gpx.get_name() || gpxUrl.split('/').pop()?.replace('.gpx', '') || ''
          const startMarker = L.marker(startLatLng, { icon: defaultIcon })
            .bindPopup(title)
          startMarker.addTo(map!)
          loadedGpxLayers.push(startMarker)
        }
      }
      if (idx === gpxFiles.value.length - 1 && bounds.isValid()) {
        map!.fitBounds(bounds)
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

watch([showMarkers, showInProgress], reloadGpxLayers)
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