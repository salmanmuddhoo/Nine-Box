/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The whole app (scripts, styles, Excel library) is inlined into one
// index.html, so the build can be hosted anywhere or simply opened from disk.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    rolldownOptions: {
      // jsPDF loads these only for its HTML and SVG import features, which this app does not use.
      external: ['html2canvas', 'dompurify', 'canvg'],
    },
  },
  test: {
    environment: 'node',
  },
});
