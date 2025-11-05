import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    // Force Supabase dependencies to be pre-bundled correctly
    include: [
      '@supabase/supabase-js',
      '@supabase/postgrest-js',
      '@supabase/storage-js',
      '@supabase/realtime-js',
      '@supabase/functions-js',
    ],
  },
  resolve: {
    alias: {
      // Ensure proper module resolution for Supabase
      '@supabase/supabase-js': '@supabase/supabase-js',
    },
  },
});
