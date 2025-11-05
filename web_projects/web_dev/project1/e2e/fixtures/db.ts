import { test as base } from './auth';
import { createClient } from '@supabase/supabase-js';

/**
 * データベースFixture
 *
 * テストデータのセットアップとクリーンアップを自動化します。
 */

type DBFixtures = {
  db: {
    cleanup: () => Promise<void>;
    seedTestData: () => Promise<void>;
    createTestPartner: (data: Partial<any>) => Promise<any>;
    createTestProduct: (data: Partial<any>) => Promise<any>;
    createTestOrder: (data: Partial<any>) => Promise<any>;
  };
};

/**
 * Supabaseクライアントの初期化
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not found in environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * テストデータのクリーンアップ
 */
async function cleanupTestData() {
  const supabase = getSupabaseClient();

  // テストで作成したデータを削除
  // 注意: 本番環境では実行しないように環境変数でガード
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot cleanup data in production environment');
  }

  // トランザクション（発注、納品、支払い）を削除
  await supabase.from('transactions').delete().ilike('notes', '%test%');

  // 注文を削除
  await supabase.from('orders').delete().ilike('notes', '%test%');

  // 商品を削除
  await supabase.from('products').delete().ilike('name', '%test%');

  // 取引先を削除
  await supabase.from('partners').delete().ilike('name', '%test%');
}

/**
 * 基本的なテストデータをシード
 */
async function seedTestData() {
  const supabase = getSupabaseClient();

  // テスト用取引先を作成
  const { data: partner } = await supabase
    .from('partners')
    .insert({
      name: 'Test Partner',
      type: 'supplier',
    })
    .select()
    .single();

  // テスト用商品を作成
  const { data: product } = await supabase
    .from('products')
    .insert({
      name: 'Test Product',
      unit: '個',
      unit_price: 1000,
    })
    .select()
    .single();

  return { partner, product };
}

/**
 * 拡張されたテストFixture
 */
export const test = base.extend<DBFixtures>({
  db: async ({}, use) => {
    const dbHelpers = {
      /**
       * テストデータをクリーンアップ
       */
      cleanup: async () => {
        await cleanupTestData();
      },

      /**
       * 基本的なテストデータをシード
       */
      seedTestData: async () => {
        await seedTestData();
      },

      /**
       * テスト用取引先を作成
       */
      createTestPartner: async (data: Partial<any>) => {
        const supabase = getSupabaseClient();
        const { data: partner, error } = await supabase
          .from('partners')
          .insert({
            name: `Test Partner ${Date.now()}`,
            type: 'supplier',
            ...data,
          })
          .select()
          .single();

        if (error) throw error;
        return partner;
      },

      /**
       * テスト用商品を作成
       */
      createTestProduct: async (data: Partial<any>) => {
        const supabase = getSupabaseClient();
        const { data: product, error } = await supabase
          .from('products')
          .insert({
            name: `Test Product ${Date.now()}`,
            unit: '個',
            unit_price: 1000,
            ...data,
          })
          .select()
          .single();

        if (error) throw error;
        return product;
      },

      /**
       * テスト用注文を作成
       */
      createTestOrder: async (data: Partial<any>) => {
        const supabase = getSupabaseClient();
        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            notes: `Test Order ${Date.now()}`,
            ...data,
          })
          .select()
          .single();

        if (error) throw error;
        return order;
      },
    };

    // テスト前にクリーンアップ
    await dbHelpers.cleanup();

    // テストで使用
    await use(dbHelpers);

    // テスト後にクリーンアップ
    await dbHelpers.cleanup();
  },
});

export { expect } from '@playwright/test';
