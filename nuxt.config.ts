// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false, // SSG로 빌드
  app: {
    // GitHub Pages용 baseURL 설정
    // 로컬: '/' (기본값), GitHub Actions에서 환경 변수로 '/repo-name/' 설정
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
  },
  nitro: {
    preset: 'static',
  },
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/scripts',
    '@nuxt/test-utils',
  ]
})