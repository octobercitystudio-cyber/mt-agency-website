import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('framer-motion')) return 'animation';
            if (id.includes('react-router-dom') || id.includes('@remix-run')) return 'router';
            if (id.includes('react-helmet-async')) return 'helmet';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
            return 'vendor';
          }
        }
      }
    }
  }
})
