// 認証状態でのSupabase接続テスト
console.log('🔐 認証状態での接続テスト');

const SUPABASE_URL = 'https://tleequspizctgoosostd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MjMxNjQsImV4cCI6MjA0MTA5OTE2NH0.gqxPgbIJ3Nx-OgPJG5HQ_KnNh0rH1MpkYe6tV1s7t5A';

// 1. 現在の認証状態確認
console.log('現在のURL:', window.location.href);
console.log('認証情報確認中...');

// 2. ローカルストレージから認証トークン確認
const authToken = localStorage.getItem('supabase.auth.token');
console.log('ローカル認証トークン:', authToken ? '存在' : '不存在');

// 3. 認証付きAPIテスト
const testWithAuth = async () => {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
    };
    
    // 認証トークンがある場合は追加
    if (authToken) {
        const parsedToken = JSON.parse(authToken);
        if (parsedToken.access_token) {
            headers['Authorization'] = `Bearer ${parsedToken.access_token}`;
            console.log('✅ ユーザー認証トークンを使用');
        }
    }
    
    console.log('🧪 認証付きAPIテスト実行中...');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&limit=5`, {
            headers: headers
        });
        
        console.log('Response Status:', response.status);
        console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ 認証付きAPI接続成功');
            console.log('取得データ件数:', data.length);
            console.log('サンプルデータ:', data.slice(0, 2));
            
            // 手動Supabaseクライアント作成
            window.supabase = {
                from: (table) => ({
                    select: (columns = '*') => ({
                        limit: (count) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&limit=${count}`, {
                            headers: headers
                        }).then(r => r.json()).then(data => ({ data, error: null })).catch(error => ({ data: null, error }))
                    }),
                    insert: (values) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
                        method: 'POST',
                        headers: { ...headers, 'Prefer': 'return=representation' },
                        body: JSON.stringify(values)
                    }).then(r => r.json()).then(data => ({ data, error: null })).catch(error => ({ data: null, error })),
                    update: (values) => ({
                        eq: (column, value) => fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
                            method: 'PATCH',
                            headers: { ...headers, 'Prefer': 'return=representation' },
                            body: JSON.stringify(values)
                        }).then(r => r.json()).then(data => ({ data, error: null })).catch(error => ({ data: null, error }))
                    }),
                    delete: () => ({
                        eq: (column, value) => fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
                            method: 'DELETE',
                            headers: headers
                        }).then(r => ({ data: null, error: null })).catch(error => ({ data: null, error }))
                    })
                }),
                auth: {
                    getUser: () => Promise.resolve({ data: { user: authToken ? { id: 'test-user' } : null }, error: null })
                }
            };
            
            console.log('🎉 手動Supabaseクライアント作成完了');
            console.log('window.supabase が利用可能になりました');
            
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ API接続失敗:', response.status, errorText);
            
            if (response.status === 401) {
                console.log('🔒 RLS (Row Level Security) が有効です');
                console.log('💡 解決方法:');
                console.log('1. Supabase Dashboard でRLSポリシーを設定');
                console.log('2. または rls_bypass_fix.sql を実行してRLSを一時無効化');
                console.log('3. 認証機能を実装してユーザーログイン後にアクセス');
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ 接続エラー:', error);
        return false;
    }
};

// 実行
testWithAuth().then(success => {
    if (success) {
        console.log('');
        console.log('🎯 次のステップ: WebUIテスト開始可能');
        console.log('- 商品登録テスト');
        console.log('- 取引先登録テスト');
        console.log('- 発注機能テスト');
    } else {
        console.log('');
        console.log('🔧 修復が必要: RLS設定の調整');
        console.log('rls_bypass_fix.sql を Supabase で実行してください');
    }
});