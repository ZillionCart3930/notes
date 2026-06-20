import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // <-- This forces assets to load relative to /notes/ instead of the domain root
  plugins: [react()],
})