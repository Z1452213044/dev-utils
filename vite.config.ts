/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '开发者工具箱',
        short_name: '工具箱',
        description:
          '本地优先的开发者工具：文本对比、JSON 格式化。所有内容仅在浏览器本地处理，不会上传到服务器。',
        theme_color: '#f7f7f8',
        background_color: '#f7f7f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
  },
  build: {
    // CodeMirror 语言包全量预打包（PWA 离线可用优先），codemirror chunk 预期 >500kB
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // 三方依赖分包：CodeMirror 体积最大单独拆，其余 vendor 一组，应用代码保持独立
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@codemirror') || id.includes('@lezer')) return 'codemirror';
          return 'vendor';
        },
      },
    },
  },
});
