import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'offline-playroom',
      generateBundle(_options, bundle) {
        const source = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8');
        const version = createHash('sha256').update(Object.keys(bundle).sort().join(',') + source).digest('hex').slice(0, 12);
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: source.replace('__BUILD_VERSION__', version) });
      },
    },
  ],
});
