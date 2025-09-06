// ===============================================================
// 緊急Supabase修復スクリプト（本番環境用）
// Netlify上で window.supabase が未定義の場合の即座修復
// ===============================================================

console.log('🚨 緊急Supabase修復スクリプト実行開始');

// Phase 1: 環境変数確認
console.log('Phase 1: 環境変数確認');
const envCheck = {
    metaEnv: typeof import !== 'undefined' ? 'available' : 'unavailable',
    viteUrl: typeof VITE_SUPABASE_URL !== 'undefined' ? VITE_SUPABASE_URL : 'undefined',
    viteKey: typeof VITE_SUPABASE_ANON_KEY !== 'undefined' ? 'defined' : 'undefined'
};
console.log('Environment Variables:', envCheck);

// Phase 2: グローバル変数から環境変数取得
console.log('Phase 2: 埋め込まれた環境変数検索');
const scripts = Array.from(document.scripts);
let supabaseUrl = null;
let supabaseAnonKey = null;

// JSファイルから環境変数を抽出
for (const script of scripts) {
    if (script.src && script.src.includes('assets/index-')) {
        console.log('メインJSファイル:', script.src);
        // 埋め込まれた環境変数を手動設定
        supabaseUrl = 'https://tleequspizctgoosostd.supabase.co';
        supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MjMxNjQsImV4cCI6MjA0MTA5OTE2NH0.gqxPgbIJ3Nx-OgPJG5HQ_KnNh0rH1MpkYe6tV1s7t5A';
        break;
    }
}

console.log('抽出された認証情報:', {
    url: supabaseUrl ? '✅ 取得済み' : '❌ 未取得',
    key: supabaseAnonKey ? '✅ 取得済み' : '❌ 未取得'
});

// Phase 3: 手動Supabaseクライアント作成
console.log('Phase 3: 手動Supabaseクライアント初期化');

if (supabaseUrl && supabaseAnonKey) {
    try {
        // Supabase CDN から動的ロード
        if (typeof window.supabase === 'undefined') {
            console.log('Supabase CDNから動的ロード中...');
            
            const supabaseScript = document.createElement('script');
            supabaseScript.src = 'https://unpkg.com/@supabase/supabase-js@2';
            supabaseScript.onload = () => {
                console.log('Supabase CDN ロード完了');
                
                // クライアント作成
                window.supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
                console.log('✅ 手動Supabaseクライアント作成成功');
                
                // 接続テスト
                testSupabaseConnection();
            };
            document.head.appendChild(supabaseScript);
        }
    } catch (error) {
        console.error('❌ 手動初期化エラー:', error);
    }
} else {
    console.error('❌ 環境変数が見つかりません');
}

// Phase 4: 接続テスト関数
async function testSupabaseConnection() {
    console.log('Phase 4: 接続テスト実行');
    
    try {
        const { data, error } = await window.supabase
            .from('products')
            .select('id')
            .limit(1);
        
        if (error) {
            console.warn('接続テストエラー:', error.message);
        } else {
            console.log('✅ Supabase接続テスト成功');
            console.log('🎉 システム修復完了！ページをリフレッシュして再テストしてください');
        }
    } catch (testError) {
        console.error('❌ 接続テスト失敗:', testError);
    }
}

// Phase 5: 代替手動初期化（即座実行用）
console.log('Phase 5: 代替即座修復');
if (typeof window.createClient !== 'undefined') {
    try {
        window.supabase = window.createClient(supabaseUrl, supabaseAnonKey);
        console.log('✅ 代替方式でSupabaseクライアント作成成功');
        testSupabaseConnection();
    } catch (altError) {
        console.warn('代替方式も失敗:', altError);
    }
}

console.log('🔧 修復スクリプト実行完了');
console.log('');
console.log('📋 次のステップ:');
console.log('1. ページリフレッシュ（F5）');
console.log('2. システム診断スクリプトを再実行');
console.log('3. window.supabase の存在確認: typeof window.supabase');