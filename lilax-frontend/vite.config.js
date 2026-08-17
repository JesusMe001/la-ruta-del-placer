import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cajera: resolve(__dirname, 'cajera.html'),
        menu: resolve(__dirname, 'menu.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
