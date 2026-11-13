import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // PDF 뷰어를 지연 로드하더라도 개발 서버 시작 시 의존성을 미리 최적화한다.
  optimizeDeps: {
    include: ['react-pdf', 'pdfjs-dist'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
