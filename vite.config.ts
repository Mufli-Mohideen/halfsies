import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Production ships Preact through its React-compatible layer: same component code,
 * about a third of the JavaScript. Development keeps React for fast refresh.
 * To ship React instead, delete the `alias` block.
 */
const preactAliases = [
  { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
  { find: /^react-dom$/, replacement: 'preact/compat' },
  { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
  { find: /^react$/, replacement: 'preact/compat' },
];

/** `vite preview` serves the same security headers as production (single source: vercel.json). */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const all = config.headers.find((h) => h.source === '/(.*)');
  return Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: command === 'build' ? { alias: preactAliases } : {},
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  preview: {
    headers: productionHeaders(),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
