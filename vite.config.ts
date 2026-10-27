/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The whole app (scripts, styles, Excel library) is inlined into one
// index.html, so the build can be hosted anywhere or simply opened from disk.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  test: {
    environment: 'node',
  },
});
