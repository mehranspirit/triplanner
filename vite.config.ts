import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Disable minification to make debugging easier
    minify: false,
    // Disable code splitting to keep everything in one bundle
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    },
    // Keep source maps for better debugging
    sourcemap: true,
    // Disable some optimizations that might cause issues
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  // Add esbuild options to preserve more type information
  esbuild: {
    keepNames: true,
    legalComments: 'none'
  }
}) 