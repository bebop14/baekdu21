# 이우백두 21기 백두대간 종주 기록

이 프로젝트는 **이우백두 21기**의 백두대간 종주 기록을 시각적으로 관리하고 공유하기 위한 웹 애플리케이션입니다. 각 구간별 GPX 파일을 지도에 표시하여, 진행 중인 구간과 완료된 구간을 쉽게 확인할 수 있습니다.

## 주요 기능

- **GPX 트랙 시각화**: 백두대간 각 구간의 GPX 파일을 지도(Leaflet) 위에 표시
- **진행/완료 구간 전환**: 진행 중인 구간과 완료된 구간을 토글로 전환하여 볼 수 있음
- **마커 표시**: 각 구간의 시작점에 마커 및 팝업(구간명) 표시
- **반응형 UI**: PC/모바일에서 모두 사용 가능

## 기술 스택

- **Nuxt 3** (Vue 3 기반)
- **TypeScript**
- **Leaflet.js** (지도 및 GPX 시각화)
- **leaflet-gpx** (GPX 파일 파싱)
- **OpenStreetMap** (지도 타일)
- **Vitest** (테스트)

## 폴더 구조

```
├── pages/index.vue              # 메인 지도 페이지
├── public/
│   ├── data/                    # 전체 구간 GPX 파일
│   │   ├── *.gpx
│   │   └── filelist.json        # 자동 생성됨
│   └── completed/               # 완료된 구간 GPX 파일
│       ├── *.gpx
│       └── filelist.json        # 자동 생성됨
├── scripts/
│   └── generate-gpx-list.cjs    # GPX 파일 목록 자동 생성 스크립트
└── .github/workflows/
    └── deploy.yml               # GitHub Pages 자동 배포
```

## 설치 및 실행 방법

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **개발 서버 실행**
   ```bash
   npm run dev
   ```
   - 기본 주소: http://localhost:3000

3. **정적 사이트 생성 (GitHub Pages용)**
   ```bash
   npm run generate
   ```
   - 생성된 파일: `.output/public/`

4. **GPX 파일 목록 자동 생성**
   - `npm run generate` 또는 `npm run build` 실행 시 자동으로 `scripts/generate-gpx-list.cjs`가 실행되어 각 폴더의 GPX 파일 목록을 갱신합니다.

## GitHub Pages 배포

이 프로젝트는 GitHub Pages에 자동 배포되도록 설정되어 있습니다.

### 배포 방법

1. **GitHub 리포지토리에 push**
   ```bash
   git add .
   git commit -m "Update"
   git push origin main
   ```

2. **GitHub Pages 설정** (최초 1회)
   - 리포지토리 Settings > Pages
   - Source: **GitHub Actions** 선택

3. `main` 브랜치에 push하면 자동으로 배포됩니다.

### GPX 파일 추가/수정

1. GPX 파일을 해당 폴더에 추가:
   - `public/data/` - 전체 구간
   - `public/completed/` - 완료된 구간

2. 변경사항을 commit하고 push하면 자동으로 배포됩니다.

## 사용법

- 메인 페이지에서 "전체 백두대간 보기" 체크박스를 통해 완료 구간/진행 구간을 전환할 수 있습니다.
- "마커 표시" 체크박스로 각 구간의 시작점 마커를 표시/숨김할 수 있습니다.

## 참고

- GPX 파일은 `public/data/`, `public/completed/` 폴더에 위치해야 하며, 파일명은 구간명을 알 수 있도록 작성하는 것이 좋습니다.
- 지도는 OpenStreetMap을 사용합니다.
