import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Capacitor 移动端渲染层构建：base 用相对路径（app:// 容器加载），
// 不启用妙搭托管输出插件（那是平台发布协议，移动端打包不需要）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist-mobile',
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
