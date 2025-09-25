import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabaseクライアント設定
const supabaseUrl = 'https://tleequspizctgoosostd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY環境変数が設定されていません');
  console.log('Supabase Dashboard → Settings → API → service_role keyを取得して設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchemaUpdates() {
  console.log('🔄 Day 3スキーマ更新を開始します...');

  try {
    // SQLファイルを読み込み
    const sqlPath = path.join(process.cwd(), 'apply_day3_schema_updates.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // SQLを実行
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('❌ スキーマ更新でエラーが発生しました:', error);
      return false;
    }

    console.log('✅ Day 3スキーマ更新が正常に完了しました');
    console.log('📊 実行結果:', data);
    return true;

  } catch (error) {
    console.error('❌ 予期しないエラー:', error);
    return false;
  }
}

// 個別のスキーマ更新を順次実行
async function applySchemaStepByStep() {
  console.log('🔄 段階的スキーマ更新を開始します...');

  const updates = [
    {
      name: 'purchase_ordersテーブル拡張',
      sql: `
        DO $$
        BEGIN
          -- assigned_user_id列の追加
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'purchase_orders'
            AND column_name = 'assigned_user_id'
          ) THEN
            ALTER TABLE purchase_orders
            ADD COLUMN assigned_user_id UUID REFERENCES profiles(id);
            RAISE NOTICE '✅ assigned_user_id列を追加しました';
          END IF;

          -- shipping_cost列の追加
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'purchase_orders'
            AND column_name = 'shipping_cost'
          ) THEN
            ALTER TABLE purchase_orders
            ADD COLUMN shipping_cost INTEGER DEFAULT 0;
            RAISE NOTICE '✅ shipping_cost列を追加しました';
          END IF;

          -- shipping_tax_rate列の追加
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'purchase_orders'
            AND column_name = 'shipping_tax_rate'
          ) THEN
            ALTER TABLE purchase_orders
            ADD COLUMN shipping_tax_rate DECIMAL(5,4) DEFAULT 0.1000;
            RAISE NOTICE '✅ shipping_tax_rate列を追加しました';
          END IF;

          -- delivery_deadline列の追加
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'purchase_orders'
            AND column_name = 'delivery_deadline'
          ) THEN
            ALTER TABLE purchase_orders
            ADD COLUMN delivery_deadline DATE;
            RAISE NOTICE '✅ delivery_deadline列を追加しました';
          END IF;
        END $$;
      `
    },
    {
      name: 'productsテーブル税区分対応',
      sql: `
        DO $$
        BEGIN
          -- tax_category列の追加
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'products'
            AND column_name = 'tax_category'
          ) THEN
            ALTER TABLE products
            ADD COLUMN tax_category VARCHAR(20) DEFAULT 'standard_10'
            CHECK (tax_category IN ('standard_10', 'reduced_8', 'tax_free', 'tax_exempt'));
            RAISE NOTICE '✅ tax_category列を追加しました';
          END IF;

          -- weight_kg列の追加
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'products'
            AND column_name = 'weight_kg'
          ) THEN
            ALTER TABLE products
            ADD COLUMN weight_kg INTEGER;
            RAISE NOTICE '✅ weight_kg列を追加しました';
          END IF;
        END $$;
      `
    }
  ];

  for (const update of updates) {
    try {
      console.log(`🔄 ${update.name}を実行中...`);

      const { error } = await supabase.rpc('exec', {
        sql: update.sql
      });

      if (error) {
        console.error(`❌ ${update.name}でエラー:`, error);
        return false;
      }

      console.log(`✅ ${update.name}完了`);
    } catch (error) {
      console.error(`❌ ${update.name}で予期しないエラー:`, error);
      return false;
    }
  }

  console.log('🎉 段階的スキーマ更新が完了しました');
  return true;
}

// メイン実行
async function main() {
  console.log('='.repeat(50));
  console.log('  Day 3 データベーススキーマ更新');
  console.log('='.repeat(50));

  // まず段階的更新を試行
  const success = await applySchemaStepByStep();

  if (success) {
    console.log('\n🎉 すべてのスキーマ更新が正常に完了しました！');
    console.log('フロントエンドのDay 3機能が正常に動作するようになります');
  } else {
    console.log('\n❌ スキーマ更新が失敗しました');
    console.log('手動でSupabase Dashboard SQL Editorから実行してください');
  }
}

main().catch(console.error);