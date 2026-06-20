import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` controls the public path the app is served from.
// Set to '/notes/' to deploy at https://alexroper.dev/notes/.
// For a domain root or other subpath, change this value.
export default defineConfig({
  plugins: [react()],
  base: '/notes/',
})
