import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;


if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が未設定です: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を確認してください');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔧 開発環境でのみ、コンソールテスト用にグローバル公開
if (import.meta.env.DEV) {
  // @ts-ignore
  window.supabase = supabase;
  
  // API統合テスト関数もグローバル公開（オプション）
  import('../utils/api-test').then(module => {
    // @ts-ignore
    window.runApiTests = () => module.InstallmentApiTester.quickTest();
  }).catch(() => {
    // api-test.ts が存在しない場合は無視
  });
}

