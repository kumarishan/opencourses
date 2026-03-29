import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const nodeBuiltins = [
  'electron',
  'node-pty',
  'path',
  'fs',
  'os',
  'url',
  'crypto',
  'child_process',
  'net',
  'http',
  'https',
  'stream',
  'zlib',
  'util',
  'events',
  'buffer',
]

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      external: nodeBuiltins,
    },
    target: 'node18',
    minify: false,
    sourcemap: true,
  },
})
