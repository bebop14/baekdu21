# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

이우백두 21기 백두대간 종주 기록 — Nuxt 3 기반 정적 사이트로, 백두대간 구간별 GPX 파일을 Leaflet.js로 지도에 렌더링하고 완료/전체 구간을 토글하여 산행 진행 상황을 시각화합니다.

월 2회 산행을 진행하며, 구간 완료 시마다 GPX 파일을 `public/completed/`에 추가하고 커밋하는 방식으로 기록을 업데이트합니다.

## 주요 명령어

```bash
# 개발
npm run dev          # 핫 리로드 개발 서버 (localhost:3000)

# 빌드 & 배포
npm run generate     # GitHub Pages용 정적 사이트 생성 (filelist.json 자동 갱신 포함)
npm run preview      # 생성된 정적 사이트 미리보기

# 테스트
npm test             # 전체 테스트 실행
npm run test:unit    # 단위 테스트만 (test/unit/)
npm run test:nuxt    # Nuxt 컴포넌트 테스트만 (test/nuxt/)
npm run test:watch   # 감시 모드

# GPX 파일 목록 재생성 (prebuild/pregenerate 훅으로 자동 실행됨)
node scripts/generate-gpx-list.cjs
```

## 아키텍처

**정적 사이트** (SSR 비활성화), Nuxt 3 기반, `main` 브랜치 푸시 시 GitHub Actions로 GitHub Pages에 자동 배포.

### GPX 데이터 흐름

1. GPX 파일은 `public/` 하위 두 디렉토리에 위치:
   - `public/data/` — 백두대간 전체 구간 GPX (기준 데이터, 변경 거의 없음)
   - `public/completed/` — 산행 완료 구간 GPX (월 2회 산행 후 추가, 현재 23개)
2. `scripts/generate-gpx-list.cjs`가 두 디렉토리를 읽어 각각 `filelist.json`을 생성 — npm 훅(`prebuild`, `pregenerate`)으로 빌드 전 자동 실행.
3. `pages/index.vue`가 런타임에 두 `filelist.json`을 fetch하여 `leaflet-gpx`로 GPX 트랙을 동적 로드.

### 지도 컴포넌트 (`pages/index.vue`)

모든 로직이 하나의 컴포넌트에 집약된 단일 페이지 앱:
- Leaflet 지도 (OSM 타일, 한반도 중심 36.8°N, 127.8°E)
- 두 개의 반응형 토글로 로드할 GPX 파일 제어:
  - **진행중 백두대간 보기** (`showInProgress`) — true이면 `completed/`, false이면 `data/` 로드
  - **마커 표시** (`showMarkers`) — 구간 시작점 마커 및 이름 팝업 표시/숨김
- Vue `watch`로 토글 변경 시 기존 트랙을 모두 제거하고 재로드
- GitHub Pages 서브디렉토리 배포를 위해 `<base>` 태그 또는 `NUXT_APP_BASE_URL`에서 `baseURL`을 런타임에 계산

### 배포

GitHub Actions (`deploy.yml`)가 저장소 이름을 기반으로 `NUXT_APP_BASE_URL`을 동적으로 설정하여 `npm run generate`를 실행하고 GitHub Pages에 퍼블리시. `dist` 디렉토리는 `.output/public`의 심볼릭 링크.

### 새 구간 추가 방법

산행 완료 후 아래 순서로 진행:

1. 완료 구간 GPX를 `public/completed/`에 추가
2. 같은 GPX를 `public/data/`에도 추가 (없거나 파일명이 다를 경우)
3. `node scripts/generate-gpx-list.cjs` 실행 — `public/data/filelist.json`과 `public/completed/filelist.json` 두 개 동시 갱신
4. GPX 파일 2개 + `filelist.json` 2개를 함께 커밋하고 push (push 시 GitHub Actions가 자동 배포)
