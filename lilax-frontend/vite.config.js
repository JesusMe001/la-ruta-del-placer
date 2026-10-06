import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // A dónde reenvía Vite las llamadas /api. Por defecto, el backend local;
  // se puede apuntar a otro (p. ej. un túnel) con VITE_PROXY_TARGET en .env.
  const apiTarget = env.VITE_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      allowedHosts: true,
      // La API se sirve por el mismo origen que el front (/api -> Nest en :3000),
      // así basta con un solo túnel apuntando a este puerto.
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          cajera: resolve(__dirname, 'cajera.html'),
          menu: resolve(__dirname, 'menu.html'),
          admin: resolve(__dirname, 'admin.html'),
          housekeeping: resolve(__dirname, 'housekeeping.html'),
        },
      },
    },
  };
});
