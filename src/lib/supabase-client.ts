/**
 * 富士精工システム用Supabaseクライアント（基本設定）
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が設定されていません。Cloudflare Pagesの設定を確認してください。');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🚨 緊急修正：ブラウザコンソール診断用
if (typeof window !== 'undefined') {
  (window as any).__supabase = supabase;
  console.log('🔧 Supabaseクライアントを window.__supabase で利用可能にしました');
}
