import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Lumen · Vite 配置
// 单入口 SPA，主/捕捉窗口通过 hash 路由切换
export default defineConfig({
  plugins: [react()],

  // 让 Electron 能正确加载 file:// 下的资源（相对路径）
  base: './',

  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'chrome120',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/marked')) {
            return 'vendor-markdown';
          }
        },
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'lucide-react', 'clsx', 'tailwind-merge', 'marked'],
  },
});
