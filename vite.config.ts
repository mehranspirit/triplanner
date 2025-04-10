import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Ensure we're using production mode for React
      jsxRuntime: 'automatic',
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
        ]
      }
    })
  ],
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    // Enable minification for production
    minify: 'terser',
    // Enable code splitting for better performance
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            'react-leaflet',
            'react-beautiful-dnd',
            'react-joyride'
          ],
          'utils': [
            'axios',
            'date-fns',
            'uuid'
          ]
        }
      }
    },
    // Disable source maps in production
    sourcemap: false,
    // Enable production optimizations
    target: 'esnext',
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    // Add chunk size warning
    chunkSizeWarningLimit: 1000
  },
  // Production-specific esbuild options
  esbuild: {
    keepNames: true,
    legalComments: 'none',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true
  },
  // Ensure we're using production mode
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode)
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-leaflet',
      'react-beautiful-dnd',
      'react-joyride'
    ],
    exclude: []
  }
})) 