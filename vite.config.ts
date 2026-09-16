import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react()],
  // The app needs to know its own version to compare against the latest release.
  // Injected at build time from package.json, which is already the single source
  // of truth for versionName and the release tag.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});
