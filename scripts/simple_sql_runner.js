#!/usr/bin/env node

// 簡単なSQL実行用スクリプト
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// 設定（プロジェクトの.envから取得するか、直接設定）
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 単純なSQLクエリ実行
const runQuery = async (query) => {
  try {
    console.log('🔄 クエリ実行中...');
    console.log('📝 Query:', query.substring(0, 100) + '...');

    // 基本的なSELECTクエリの実行
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact' })
      .limit(0);

    if (error) {
      console.error('❌ エラー:', error.message);
      return;
    }

    console.log('✅ 実行完了');
    console.log('📊 総発注書数:', data?.length || 0);

  } catch (error) {
    console.error('❌ 実行エラー:', error.message);
  }
};

// テストクエリ実行
const testQuery = 'SELECT COUNT(*) FROM purchase_orders WHERE total_amount > 10000000';
runQuery(testQuery);