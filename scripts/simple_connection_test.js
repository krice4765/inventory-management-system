// 最簡単な接続テスト
console.log('🔍 Supabase接続状況診断');

const SUPABASE_URL = 'https://tleequspizctgoosostd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MjMxNjQsImV4cCI6MjA0MTA5OTE2NH0.gqxPgbIJ3Nx-OgPJG5HQ_KnNh0rH1MpkYe6tV1s7t5A';

// 基本的なfetch APIテスト
fetch(`${SUPABASE_URL}/rest/v1/products?select=id&limit=1`, {
    headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
    }
})
.then(response => {
    console.log('Response Status:', response.status);
    console.log('Response OK:', response.ok);
    
    if (response.ok) {
        return response.json();
    } else {
        throw new Error(`HTTP ${response.status}`);
    }
})
.then(data => {
    console.log('✅ Supabase API接続成功');
    console.log('Data:', data);
    console.log('');
    console.log('🎉 データベース接続は正常です');
    console.log('💡 問題はSupabaseクライアントライブラリの初期化のみです');
    console.log('');
    console.log('🔧 修復方法:');
    console.log('1. ページリフレッシュ（F5）');
    console.log('2. または manual_supabase_fix.js を実行');
})
.catch(error => {
    console.error('❌ 接続失敗:', error);
    console.log('');
    console.log('🔍 考えられる原因:');
    console.log('- Supabase RLS (Row Level Security) 設定');
    console.log('- ネットワーク接続問題');
    console.log('- APIキーの有効期限');
    console.log('- CORS設定問題');
});