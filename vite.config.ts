/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// mermaid 独有依赖（dompurify / marked 与应用共用，不能进这个 chunk，否则会破坏懒加载）
const MERMAID_ONLY_DEPS = [
  '@mermaid-js',
  '@braintree',
  '@iconify',
  '@upsetjs',
  'chevrotain',
  'cytoscape',
  'cose-base',
  'dagre-d3-es',
  'dagre',
  'dayjs',
  'delaunator',
  'd3',
  'elkjs',
  'es-toolkit',
  'internmap',
  'katex',
  'khroma',
  'langium',
  'layout-base',
  'mdast-util',
  'points-on-curve',
  'points-on-path',
  'robust-predicates',
  'roughjs',
  'stylis',
  'ts-dedent',
  'uuid',
  'web-worker',
];

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
        // mermaid 是按需加载的重型 chunk（>2MiB 超出 workbox 预缓存上限），
        // 不预缓存：离线时图表降级为源码展示，其余功能不受影响。
        globIgnores: ['**/mermaid-*.js'],
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
        // 三方依赖分包：CodeMirror 单独拆，mermaid 单独拆（按需加载，不进主链路），
        // 其余 vendor 一组，应用代码保持独立
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const path = id.replace(/\\/g, '/');
          if (path.includes('@codemirror') || path.includes('@lezer')) return 'codemirror';
          if (path.includes('/node_modules/mermaid')) return 'mermaid';
          if (MERMAID_ONLY_DEPS.some((dep) => path.includes(`/node_modules/${dep}`))) return 'mermaid';
          return 'vendor';
        },
      },
    },
  },
});
