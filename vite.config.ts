import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React関連ライブラリを別チャンクに分離
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // UI関連ライブラリを別チャンクに分離
          'ui-vendor': [
            'lucide-react',
            'framer-motion',
            'react-hook-form',
            '@hookform/resolvers',
            'yup'
          ],
          
          // データ・状態管理を別チャンクに分離
          'data-vendor': [
            '@tanstack/react-query',
            '@supabase/supabase-js',
            'zustand'
          ],
          
          // PDF処理ライブラリを分離（重い処理）
          'pdf-vendor': [
            'jspdf',
            'jspdf-font',
            'pdf-lib'
          ],
          
          // 画像・ファイル処理ライブラリを分離
          'media-vendor': [
            'html2canvas',
            'file-saver'
          ],
          
          // その他のユーティリティ
          'utils-vendor': [
            'date-fns',
            'react-hot-toast',
            'react-dropzone',
            'react-window',
            'react-window-infinite-loader',
            'recharts'
          ]
        }
      }
    },
    // チャンクサイズ警告の閾値を調整
    chunkSizeWarningLimit: 1000,
    // 最適化設定
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // プロダクション時にconsole.logを除去
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      }
    }
  }
});