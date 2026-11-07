import {defineConfig, type Plugin} from 'vite'
import react from '@vitejs/plugin-react'

// SkyScript loads the configurator from file://, where Chromium will not run
// ES modules. Emit one classic, deferred script instead.
function classicScripts(): Plugin {
  return {
    name: 'skyscript-classic-scripts',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin src=/g, '<script defer src=')
        .replace(/<script type="module" src=/g, '<script defer src=')
        .replace(/ crossorigin(?=[ >])/g, '')
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), classicScripts()],
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {format: 'iife'},
    },
  },
})
