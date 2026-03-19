import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/index.js'), // Onde a biblioteca começa
      name: 'PsiuFlashReact',
      fileName: 'psiu-flash-react',
    },
    rollupOptions: {
      // Garante que o React não vai ser empacotado junto, pesando a biblioteca
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
});