// 重複在庫移動レコードのクリーンアップスクリプト
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicateMovements() {
  try {
    console.log('🔍 重複在庫移動レコードを検索中...');

    // 今日作成された在庫移動レコードを取得
    const today = new Date().toISOString().split('T')[0];

    const { data: movements, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('movement_type', 'in')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return;
    }

    console.log(`📊 今日の入庫レコード: ${movements?.length || 0}件`);

    if (!movements || movements.length === 0) {
      console.log('✅ 重複レコードはありません');
      return;
    }

    // transaction_id + product_id の組み合わせでグループ化して重複検出
    const groupedMovements = {};
    movements.forEach(movement => {
      const key = `${movement.transaction_id}-${movement.product_id}`;
      if (!groupedMovements[key]) {
        groupedMovements[key] = [];
      }
      groupedMovements[key].push(movement);
    });

    const duplicateGroups = Object.entries(groupedMovements)
      .filter(([_, movs]) => movs.length > 1);

    if (duplicateGroups.length === 0) {
      console.log('✅ 重複レコードはありません');
      return;
    }

    console.log(`🚨 重複グループ発見: ${duplicateGroups.length}グループ`);

    // 各グループの最初のレコード以外を削除
    for (const [key, movs] of duplicateGroups) {
      console.log(`🔍 重複グループ ${key}: ${movs.length}件`);

      // 最初のレコード以外を削除対象とする
      const toDelete = movs.slice(1);
      const deleteIds = toDelete.map(m => m.id);

      if (deleteIds.length > 0) {
        console.log(`🗑️ 削除対象: ${deleteIds.length}件`);

        const { error: deleteError } = await supabase
          .from('inventory_movements')
          .delete()
          .in('id', deleteIds);

        if (deleteError) {
          console.error('❌ 削除エラー:', deleteError);
        } else {
          console.log('✅ 重複レコード削除完了');
        }
      }
    }

    console.log('🎯 クリーンアップ完了');

  } catch (error) {
    console.error('❌ 予期しないエラー:', error);
  }
}

// スクリプト実行
cleanupDuplicateMovements();