import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本地开发时后端直连端口（docker compose 下前端经 nginx 代理，无需此配置）
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // PC 管理端
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // H5 用户端（家属 / 配送员）
        h5: fileURLToPath(new URL('./h5.html', import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      '/api': apiTarget,
    },
  },
})
