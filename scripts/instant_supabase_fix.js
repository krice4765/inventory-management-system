// 即座Supabase修復（開発者コンソール用）
// 現在のNetlify URLで実行

// 1. 強制的にSupabaseクライアント作成
const SUPABASE_URL = 'https://tleequspizctgoosostd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MjMxNjQsImV4cCI6MjA0MTA5OTE2NH0.gqxPgbIJ3Nx-OgPJG5HQ_KnNh0rH1MpkYe6tV1s7t5A';

console.log('🔧 即座Supabase修復開始');

// Supabase CDN動的ロード
const loadSupabase = () => {
    return new Promise((resolve, reject) => {
        if (window.supabase) {
            resolve(window.supabase);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
        script.onload = () => {
            if (window.supabase && window.supabase.createClient) {
                window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('✅ Supabaseクライアント作成成功');
                resolve(window.supabase);
            } else {
                reject(new Error('Supabase CDNロード失敗'));
            }
        };
        script.onerror = () => reject(new Error('Script load failed'));
        document.head.appendChild(script);
    });
};

// 実行
loadSupabase()
    .then(async (supabase) => {
        console.log('🧪 接続テスト中...');
        
        const { data, error } = await supabase
            .from('products')
            .select('id')
            .limit(1);
        
        if (error) {
            console.warn('接続エラー:', error.message);
        } else {
            console.log('✅ Supabase接続成功');
            console.log('🎉 修復完了！再度システム診断を実行してください');
        }
    })
    .catch(error => {
        console.error('❌ 修復失敗:', error);
        console.log('💡 代替案: ページリフレッシュ後に再試行');
    });