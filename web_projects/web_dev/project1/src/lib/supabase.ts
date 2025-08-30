import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// デバッグ用（一時的に有効化可能）
// console.log('VITE_SUPABASE_URL:', supabaseUrl);
// console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '設定済み' : '未設定');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が未設定です: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を確認してください');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);