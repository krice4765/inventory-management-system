/**
 * 富士精工システム用Supabase統合クライアント
 * クライアント初期化 + データベースヘルパー統合版
 */
import { createClient } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';

// 環境変数の取得
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// デバッグ情報
console.log('🔧 Supabase初期化開始');
console.log('URL設定:', supabaseUrl ? '✅ 設定済み' : '❌ 未設定');
console.log('KEY設定:', supabaseAnonKey ? '✅ 設定済み' : '❌ 未設定');

// 環境変数の存在確認
if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL が設定されていません');
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY が設定されていません');
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

// Supabaseクライアント作成
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// ========================================================================
// データベース操作ヘルパークラス（統合版）
// ========================================================================

export interface DbResult<T> {
  data: T | null;
  error: PostgrestError | null;
  success: boolean;
}

export class SupabaseHelper {
  private static handleResult<T>(result: { data: T | null; error: PostgrestError | null }): DbResult<T> {
    return {
      data: result.data,
      error: result.error,
      success: !result.error && result.data !== null
    };
  }

  static products = {
    async list() {
      const result = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('product_name'); // ⚠️ 正しいカラム名
      return SupabaseHelper.handleResult(result);
    },

    async search(searchTerm: string) {
      if (!searchTerm?.trim()) {
        return this.list();
      }
      
      const term = searchTerm.trim();
      const result = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .or(`product_name.ilike.%${term}%,product_code.ilike.%${term}%,drawing_no.ilike.%${term}%`)
        .order('product_name');
      return SupabaseHelper.handleResult(result);
    },

    async getById(id: string) {
      const result = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async create(product: Omit<Record<string, unknown>, 'id' | 'created_at'>) {
      const productData = {
        ...product,
        created_at: new Date().toISOString(),
        is_active: true
      };
      
      const result = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async update(id: string, updates: Partial<Record<string, unknown>>) {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      const result = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async delete(id: string) {
      // 論理削除
      const result = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    }
  };

  static partners = {
    async list() {
      const result = await supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)
        .order('name'); // ⚠️ partnersテーブルは'name'が正しい
      return SupabaseHelper.handleResult(result);
    },

    async search(searchTerm: string) {
      if (!searchTerm?.trim()) {
        return this.list();
      }
      
      const term = searchTerm.trim();
      const result = await supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${term}%,partner_code.ilike.%${term}%,quality_grade.ilike.%${term}%`)
        .order('name');
      return SupabaseHelper.handleResult(result);
    },

    async getById(id: string) {
      const result = await supabase
        .from('partners')
        .select('*')
        .eq('id', id)
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async create(partner: Omit<Record<string, unknown>, 'id' | 'created_at'>) {
      const partnerData = {
        ...partner,
        created_at: new Date().toISOString(),
        is_active: true
      };
      
      const result = await supabase
        .from('partners')
        .insert(partnerData)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    }
  };

  static orders = {
    async list() {
      const result = await supabase
        .from('purchase_orders') // ⚠️ 正しいテーブル名
        .select(`
          *,
          partners!purchase_orders_partner_id_fkey (
            id,
            name,
            quality_grade,
            payment_terms
          )
        `)
        .order('created_at', { ascending: false });
      return SupabaseHelper.handleResult(result);
    },

    async getWithItems(orderId: string) {
      const result = await supabase
        .from('purchase_orders')
        .select(`
          *,
          partners!purchase_orders_partner_id_fkey (
            id,
            name,
            quality_grade,
            payment_terms
          ),
          purchase_order_items (
            *,
            products (
              product_name,
              product_code,
              drawing_no,
              standard_price
            )
          )
        `)
        .eq('id', orderId)
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async create(order: Omit<Record<string, unknown>, 'id' | 'created_at'>) {
      const orderData = {
        ...order,
        created_at: new Date().toISOString(), // 🚨 発行時刻問題解決
        status: order.status || 'pending'
      };
      
      const result = await supabase
        .from('purchase_orders')
        .insert(orderData)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async update(id: string, updates: Partial<Record<string, unknown>>) {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      const result = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    }
  };

  static inventory = {
    async getMovements() {
      const result = await supabase
        .from('inventory_movements')
        .select(`
          *,
          products (
            product_name,
            product_code,
            drawing_no
          )
        `)
        .order('created_at', { ascending: false });
      return SupabaseHelper.handleResult(result);
    },

    async addMovement(movement: Omit<Record<string, unknown>, 'id' | 'created_at'>) {
      const movementData = {
        ...movement,
        created_at: new Date().toISOString()
      };
      
      const result = await supabase
        .from('inventory_movements')
        .insert(movementData)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async getLowStock(threshold = 10) {
      const result = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .lt('current_stock', threshold)
        .order('current_stock');
      return SupabaseHelper.handleResult(result);
    }
  };

  static async executeTransaction<T>(operations: () => Promise<T>): Promise<DbResult<T>> {
    try {
      const data = await operations();
      return { data, error: null, success: true };
    } catch (error) {
      console.error('Transaction error:', error);
      return {
        data: null,
        error: error as PostgrestError,
        success: false
      };
    }
  }

  static auth = {
    async getCurrentUser() {
      const { data: { user }, error } = await supabase.auth.getUser();
      return this.handleResult({ data: user, error });
    },

    async signIn(email: string, password: string) {
      const result = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return this.handleResult({ data: result.data.user, error: result.error });
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      return this.handleResult({ data: true, error });
    }
  };

  // 🚨 統合診断機能
  static async runDiagnostics(): Promise<DbResult<any>> {
    try {
      console.log('🧪 富士精工システム統合診断開始...');
      
      const diagnostics = {
        connection: false,
        products: { count: 0, sample: null, error: null },
        partners: { count: 0, sample: null, error: null },
        orders: { count: 0, sample: null, error: null }
      };

      // 基本接続テスト
      const { data: connectionTest, error: connectionError } = await supabase
        .from('products')
        .select('count', { count: 'exact', head: true });
        
      if (connectionError) {
        console.error('❌ 基本接続エラー:', connectionError);
        return { data: diagnostics, error: connectionError, success: false };
      }
      
      diagnostics.connection = true;
      console.log('✅ 基本接続成功');

      // 商品データ診断
      try {
        const productsResult = await this.products.list();
        if (productsResult.success && productsResult.data) {
          diagnostics.products.count = productsResult.data.length;
          diagnostics.products.sample = productsResult.data[0] || null;
          console.log(`✅ 商品データ: ${productsResult.data.length}件`);
        } else {
          diagnostics.products.error = productsResult.error;
          console.error('❌ 商品データエラー:', productsResult.error);
        }
      } catch (error) {
        diagnostics.products.error = error;
        console.error('❌ 商品データ例外:', error);
      }

      // 仕入先データ診断
      try {
        const partnersResult = await this.partners.list();
        if (partnersResult.success && partnersResult.data) {
          diagnostics.partners.count = partnersResult.data.length;
          diagnostics.partners.sample = partnersResult.data[0] || null;
          console.log(`✅ 仕入先データ: ${partnersResult.data.length}件`);
        } else {
          diagnostics.partners.error = partnersResult.error;
          console.error('❌ 仕入先データエラー:', partnersResult.error);
        }
      } catch (error) {
        diagnostics.partners.error = error;
        console.error('❌ 仕入先データ例外:', error);
      }

      // 発注データ診断
      try {
        const ordersResult = await this.orders.list();
        if (ordersResult.success && ordersResult.data) {
          diagnostics.orders.count = ordersResult.data.length;
          diagnostics.orders.sample = ordersResult.data[0] || null;
          console.log(`✅ 発注データ: ${ordersResult.data.length}件`);
        } else {
          diagnostics.orders.error = ordersResult.error;
          console.error('❌ 発注データエラー:', ordersResult.error);
        }
      } catch (error) {
        diagnostics.orders.error = error;
        console.error('❌ 発注データ例外:', error);
      }

      console.log('🎉 統合診断完了');
      console.table(diagnostics);
      
      return { data: diagnostics, error: null, success: true };
      
    } catch (error) {
      console.error('❌ 診断実行エラー:', error);
      return { 
        data: null, 
        error: error as PostgrestError, 
        success: false 
      };
    }
  }
}

export const db = SupabaseHelper;

// WebUIコンソール用グローバル変数設定（重要）
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  (window as any).__db = db; // ヘルパークラスもグローバル化
  console.log('✅ window.supabase グローバル変数設定完了');
  console.log('✅ window.__db ヘルパークラス設定完了');
  console.log('🎯 WebUIコンソールでのデータ操作が可能になりました');
  
  // 統合接続テスト実行
  supabase
    .from('purchase_orders')
    .select('count', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.error('❌ Supabase接続テストエラー:', error.message);
      } else {
        console.log('✅ Supabase接続テスト成功');
        console.log(`📊 発注データ件数: ${count || 0}件`);
        
        // 統合診断の自動実行
        db.runDiagnostics().then(result => {
          if (result.success) {
            console.log('🎯 システム準備完了！');
            console.log('📋 ブラウザコンソールで window.__db.runDiagnostics() を実行して詳細確認可能');
          } else {
            console.warn('⚠️ 一部の診断でエラーが発生しました。詳細を確認してください。');
          }
        }).catch(e => console.warn('⚠️ 統合診断例外:', e));
      }
    })
    .catch(err => {
      console.error('❌ 接続テスト実行エラー:', err);
    });
}