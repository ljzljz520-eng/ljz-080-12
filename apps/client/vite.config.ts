import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  // 本地开发 / 预览时将 API 代理到 NestJS 后端
  '/api': {
    target: process.env.VITE_API_ORIGIN ?? 'http://localhost:3000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd'],
          'antd-mobile': ['antd-mobile'],
        },
      },
    },
  },
})
