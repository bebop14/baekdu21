import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Index from './index.vue'

// fetch mocking을 위한 전역 설정
global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([]) })) as any

describe('Index.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('컴포넌트가 정상적으로 마운트된다', async () => {
    const wrapper = mount(Index)
    expect(wrapper.text()).toContain('이우백두 21기 백두대간 종주 기록')
    expect(wrapper.find('#map').exists()).toBe(true)
  })

  it('체크박스 토글 시 showCompleted, showMarkers 반영', async () => {
    const wrapper = mount(Index)
    const [completed, markers] = wrapper.findAll('input[type="checkbox"]')
    expect(completed.exists()).toBe(true)
    expect(markers.exists()).toBe(true)
    await completed.setValue(true)
    await markers.setValue(false)
    // 내부 ref 값이 바뀌는지 확인
    // (실제 로직은 ref로 되어 있으므로, UI 반영만 확인)
    expect((completed.element as HTMLInputElement).checked).toBe(true)
    expect((markers.element as HTMLInputElement).checked).toBe(false)
  })

  it('fetchFileLists 함수가 정상적으로 파일 목록을 불러온다', async () => {
    // fetch를 mock하여 특정 값을 반환
    (global.fetch as any) = vi.fn((url: string) => {
      if (url.includes('data')) {
        return Promise.resolve({ json: () => Promise.resolve(['a.gpx', 'b.gpx']) })
      }
      if (url.includes('completed')) {
        return Promise.resolve({ json: () => Promise.resolve(['c.gpx']) })
      }
      return Promise.resolve({ json: () => Promise.resolve([]) })
    })
    const wrapper = mount(Index)
    // fetchFileLists는 onMounted에서 자동 호출됨
    // gpxFiles computed가 정상 동작하는지 확인
    await wrapper.vm.$nextTick()
    // 진행중 모드
    expect(wrapper.vm.dataFiles.length).toBeGreaterThan(0)
    // 전체 모드로 변경
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.completedFiles.length).toBeGreaterThan(0)
  })

  // 지도 및 GPX 관련 함수는 DOM/Leaflet 환경이 필요하므로, 별도 E2E 또는 통합 테스트 권장
}) 