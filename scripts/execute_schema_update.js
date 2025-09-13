// inventory_movementsテーブルにinstallment_no列を追加するスクリプト
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase設定
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tleequspizctgoosostd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEYが設定されていません');
  console.log('ℹ️  Supabaseダッシュボード > Settings > API > service_role key を使用してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addInstallmentNoColumn() {
  console.log('🔧 inventory_movementsテーブルにinstallment_no列を追加中...');

  try {
    // 1. 列を追加
    console.log('1️⃣ installment_no列を追加...');
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS installment_no INTEGER DEFAULT NULL;'
    });

    if (addColumnError) {
      console.error('❌ 列追加エラー:', addColumnError);
      return;
    }

    console.log('✅ installment_no列を追加しました');

    // 2. 既存データを更新
    console.log('2️⃣ 既存データのinstallment_no値を更新中...');
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE inventory_movements
        SET installment_no = CAST(
          regexp_replace(
            regexp_replace(memo, '.*第(\\d+)回.*', '\\1'),
            '[^\\d]', '', 'g'
          ) AS INTEGER
        )
        WHERE memo LIKE '%第%回%'
          AND memo ~ '第\\d+回'
          AND installment_no IS NULL;
      `
    });

    if (updateError) {
      console.error('❌ データ更新エラー:', updateError);
      return;
    }

    console.log('✅ 既存データを更新しました');

    // 3. 結果を確認
    console.log('3️⃣ 更新結果を確認中...');
    const { data: result, error: selectError } = await supabase
      .from('inventory_movements')
      .select('installment_no, memo')
      .not('installment_no', 'is', null)
      .limit(5);

    if (selectError) {
      console.error('❌ 確認エラー:', selectError);
      return;
    }

    console.log('✅ 更新されたサンプルデータ:');
    result?.forEach((row, index) => {
      console.log(`  ${index + 1}. installment_no: ${row.installment_no}, memo: ${row.memo.slice(0, 50)}...`);
    });

    // 4. 統計情報
    const { data: stats, error: statsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          COUNT(*) as total_records,
          COUNT(installment_no) as records_with_installment_no,
          COUNT(CASE WHEN memo LIKE '%分納入力%' THEN 1 END) as installment_memo_records
        FROM inventory_movements;
      `
    });

    if (!statsError && stats) {
      console.log('📊 統計情報:');
      console.log(`  総レコード数: ${stats[0]?.total_records || 0}`);
      console.log(`  installment_no設定済み: ${stats[0]?.records_with_installment_no || 0}`);
      console.log(`  分納入力メモ: ${stats[0]?.installment_memo_records || 0}`);
    }

    console.log('🎉 スキーマ更新が完了しました！');

  } catch (error) {
    console.error('❌ スキーマ更新失敗:', error);
  }
}

// 実行
addInstallmentNoColumn();