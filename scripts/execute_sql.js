#!/usr/bin/env node

// SQLクエリ実行用スクリプト
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase設定を読み込み
const loadSupabaseConfig = () => {
  try {
    const envPath = join(__dirname, '../.env');
    const envContent = readFileSync(envPath, 'utf8');
    const config = {};

    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        config[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
      }
    });

    return config;
  } catch (error) {
    console.error('環境設定の読み込みに失敗:', error.message);
    return null;
  }
};

// SQLファイル実行
const executeSqlFile = async (filename) => {
  const config = loadSupabaseConfig();

  if (!config?.VITE_SUPABASE_URL || !config?.VITE_SUPABASE_ANON_KEY) {
    console.error('❌ Supabase設定が見つかりません');
    console.log('📋 必要な設定: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
    return;
  }

  const supabase = createClient(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_ANON_KEY);

  try {
    console.log(`🔄 SQLファイルを実行中: ${filename}`);

    const sqlPath = join(__dirname, filename);
    const sqlContent = readFileSync(sqlPath, 'utf8');

    // SQLを実行
    const { data, error } = await supabase.rpc('execute_sql', {
      query: sqlContent
    });

    if (error) {
      console.error('❌ SQL実行エラー:', error.message);
      return;
    }

    console.log('✅ SQL実行完了');
    console.log('📊 結果:', data);

  } catch (error) {
    console.error('❌ 実行エラー:', error.message);
  }
};

// コマンドライン引数からファイル名を取得
const filename = process.argv[2] || 'data_analysis_phase1.sql';
executeSqlFile(filename);