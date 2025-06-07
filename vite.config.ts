import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5000000, // Increase to 5MB for better caching
        runtimeCaching: [
          // API Routes - Network First with comprehensive fallback
          {
            urlPattern: /^https?:\/\/.*\/api\/trips$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'trips-api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              },
              backgroundSync: {
                name: 'trips-background-sync',
                options: {
                  maxRetentionTime: 24 * 60 // 24 Hours
                }
              }
            }
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/trips\/[^\/]+$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'trip-details-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              },
              backgroundSync: {
                name: 'trip-details-sync',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          // Expense-related API routes
          {
            urlPattern: /^https?:\/\/.*\/api\/trips\/[^\/]+\/expenses/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'expenses-api-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: {
                statuses: [0, 200]
              },
              backgroundSync: {
                name: 'expenses-background-sync',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          // Settlement-related API routes
          {
            urlPattern: /^https?:\/\/.*\/api\/trips\/[^\/]+\/settlements/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'settlements-api-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: {
                statuses: [0, 200]
              },
              backgroundSync: {
                name: 'settlements-background-sync',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          // Notes API routes
          {
            urlPattern: /^https?:\/\/.*\/api\/trips\/[^\/]+\/notes/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'notes-api-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: {
                statuses: [0, 200]
              },
              backgroundSync: {
                name: 'notes-background-sync',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          // Checklist API routes
          {
            urlPattern: /^https?:\/\/.*\/api\/trips\/[^\/]+\/checklist/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'checklist-api-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: {
                statuses: [0, 200]
              },
              backgroundSync: {
                name: 'checklist-background-sync',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          // Generic API fallback
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              },
              backgroundSync: {
                name: 'api-background-sync',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          // Static assets - Cache First for better performance
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          // Fonts - Cache First
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
              }
            }
          },
          // CSS and JS - Stale While Revalidate for quick loading
          {
            urlPattern: /\.(?:css|js)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              }
            }
          }
        ]
      },
      manifest: {
        name: 'TripPlanner - Plan Your Perfect Trip',
        short_name: 'TripPlanner',
        description: 'Plan, organize, and manage your trips with comprehensive offline support',
        theme_color: '#3B82F6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['travel', 'productivity', 'lifestyle'],
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true
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
          'offline': [
            'idb',
            'workbox-window'
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
      'react-joyride',
      'idb'
    ],
    exclude: []
  }
})) 