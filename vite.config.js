import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react()
  ],

  build: {
    target: 'esnext',

    lib: {
      entry: resolve(__dirname, 'src/lib/index.js'),
      name: 'PsiuMeetClient',
      fileName: 'psiu-meet-client',
      formats: ['es']
    },

    rollupOptions: {
      // 🔥 O Escudo Definitivo: Impede o Vite de embutir o motor do React junto com o pacote
      external: ['react', 'react-dom', 'react/jsx-runtime'],

      output: {
        exports: 'named'
      }
    }
  }
})