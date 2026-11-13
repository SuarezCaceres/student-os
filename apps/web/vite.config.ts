import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Los .env* viven en la raiz del monorepo (mismo lugar que antes del traslado a apps/web).
  envDir: '../..',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
