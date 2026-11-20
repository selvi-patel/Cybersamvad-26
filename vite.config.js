import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',   // relative asset paths so dist/ works from any static host or sub-folder
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
})
