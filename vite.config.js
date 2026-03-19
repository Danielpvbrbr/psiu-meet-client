import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/index.js'), // Onde a sua biblioteca começa
      name: 'PsiuMeetClient',
      fileName: 'psiu-meet-client',
    },
    rollupOptions: {
      // Garante que essas bibliotecas não serão embutidas, deixando seu pacote leve
      external: ['react', 'react-dom', 'socket.io-client'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'socket.io-client': 'io'
        },
      },
    },
  },
})