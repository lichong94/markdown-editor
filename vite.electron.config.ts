import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Electron 渲染层构建：base 用相对路径以支持 file:// 加载，
// 不启用妙搭托管输出插件（那是平台发布协议，桌面打包不需要）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist-electron/renderer',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
    minify: 'oxc',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules') && id.includes('katex')) return 'katex';
          if (id.includes('node_modules') && id.includes('mermaid')) return 'mermaid';
          if (id.includes('node_modules') && id.includes('highlight.js')) return 'highlight';
          if (
            id.includes('node_modules') &&
            /(react|marked|turndown|dompurify)/.test(id)
          ) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
});
