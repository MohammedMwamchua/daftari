import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // xfwd passes each device's address on, so the opinions form's spam limit counts per device, not for everyone at once
  server: { port: 5173, proxy: { '/api': { target: 'http://127.0.0.1:8000', xfwd: true } } },
});
