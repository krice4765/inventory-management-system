import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// デバッグ用（一時的に有効化可能）
console.log('[Supabase] VITE_SUPABASE_URL:', supabaseUrl);
console.log('[Supabase] VITE_SUPABASE_ANON_KEY (first 50 chars):', supabaseAnonKey?.substring(0, 50));

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が未設定です: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を確認してください');
}

// Supabaseクライアント作成時に適切なオプションを指定
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (...args) => fetch(...args),
  },
});