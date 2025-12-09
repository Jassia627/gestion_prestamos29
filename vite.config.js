import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: ['es2019', 'safari13'],
  },
  esbuild: {
    target: 'es2019',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2019',
    },
  },
})
