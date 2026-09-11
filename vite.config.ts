import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the same build works on the web, from file://, and inside a Capacitor Android WebView.
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
