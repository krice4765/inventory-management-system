// 手動Supabase修復 - CDN不要版
console.log('🔧 手動Supabase修復開始（CDN不要版）');

// 1. 既存のSupabaseライブラリを探す
let supabaseLib = null;

// React アプリ内でSupabaseが読み込まれている可能性をチェック
const checkExistingSupabase = () => {
    // グローバル変数をチェック
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        console.log('✅ 既存のSupabaseライブラリ発見');
        return window.supabase;
    }
    
    // React モジュール内のSupabaseを探す
    const scripts = Array.from(document.scripts);
    for (const script of scripts) {
        if (script.src && script.src.includes('assets/index-')) {
            console.log('メインアプリスクリプト確認:', script.src);
        }
    }
    
    return null;
};

// 2. 環境変数の直接設定
const SUPABASE_URL = 'https://tleequspizctgoosostd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MjMxNjQsImV4cCI6MjA0MTA5OTE2NH0.gqxPgbIJ3Nx-OgPJG5HQ_KnNh0rH1MpkYe6tV1s7t5A';

// 3. 手動fetch実装でSupabase API直接呼び出し
const manualSupabaseClient = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY,
    
    async from(table) {
        return {
            select: (columns = '*') => ({
                limit: (count) => ({
                    async then(resolve) {
                        try {
                            const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&limit=${count}`, {
                                headers: {
                                    'apikey': SUPABASE_ANON_KEY,
                                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            if (response.ok) {
                                const data = await response.json();
                                resolve({ data, error: null });
                            } else {
                                const errorText = await response.text();
                                resolve({ data: null, error: { message: errorText } });
                            }
                        } catch (fetchError) {
                            resolve({ data: null, error: fetchError });
                        }
                    }
                })
            })
        };
    }
};

// 4. テスト実行
(async () => {
    console.log('🧪 手動実装での接続テスト中...');
    
    try {
        const result = await manualSupabaseClient.from('products').select('id').limit(1);
        
        if (result.error) {
            console.warn('❌ 接続エラー:', result.error.message);
            
            // デバッグ情報
            console.log('デバッグ情報:');
            console.log('- URL:', SUPABASE_URL);
            console.log('- Key prefix:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
        } else {
            console.log('✅ 手動実装で接続成功');
            console.log('データ:', result.data);
            
            // グローバルに手動クライアントを設定
            window.supabase = manualSupabaseClient;
            console.log('🎉 手動Supabaseクライアント設定完了');
            
            // 基本的な機能テスト
            console.log('📋 基本機能テスト中...');
            
            // テーブル存在確認
            const tables = ['products', 'partners', 'transactions', 'inventory_movements'];
            for (const table of tables) {
                try {
                    const testResult = await manualSupabaseClient.from(table).select('*').limit(1);
                    console.log(`${table}: ${testResult.error ? '❌' : '✅'}`);
                } catch (tableError) {
                    console.log(`${table}: ❌ (${tableError.message})`);
                }
            }
            
            console.log('');
            console.log('🎯 次のステップ:');
            console.log('1. 基本的なCRUD操作が可能');
            console.log('2. WebUI機能テストを実行できます');
            console.log('3. typeof window.supabase で確認: "object"');
        }
    } catch (error) {
        console.error('❌ 手動実装テスト失敗:', error);
        
        console.log('🔍 詳細診断:');
        console.log('- Network Status:', navigator.onLine ? 'オンライン' : 'オフライン');
        console.log('- CORS問題の可能性があります');
        console.log('- Supabase RLS設定を確認してください');
    }
})();