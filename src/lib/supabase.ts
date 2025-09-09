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

  // 🛡️ 汎用検索クエリサニタイゼーション関数
  private static sanitizeSearchTerm(term: string, maxLength: number = 100): string {
    if (!term?.trim()) return '';
    
    return term.trim()
      .replace(/[,%"'\\]/g, '') // SQLで特別な意味を持つ文字を除去
      .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\-_.]/g, '') // 英数字、日本語、基本記号のみ許可
      .substring(0, maxLength); // 長さ制限
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
      
      const term = SupabaseHelper.sanitizeSearchTerm(searchTerm);
      if (!term) {
        return this.list();
      }
      
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
        is_active: true
        // created_at はデータベースに委譲
      };
      
      const result = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async update(id: string, updates: Partial<Record<string, unknown>>) {
      // updated_at はトリガーで自動更新されるため送信不要
      const updateData = { ...updates };
      
      const result = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async delete(id: string) {
      // 論理削除 (updated_at はトリガーで自動更新)
      const result = await supabase
        .from('products')
        .update({ is_active: false })
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
      
      const term = SupabaseHelper.sanitizeSearchTerm(searchTerm);
      if (!term) {
        return this.list();
      }
      
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
        is_active: true
        // created_at はデータベースに委譲
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
      // 🚨 UUID検証強化
      if (!orderId || orderId === 'undefined' || orderId === 'null' || 
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        console.error('Invalid UUID provided:', orderId);
        return SupabaseHelper.handleResult({ 
          data: null, 
          error: { message: 'Invalid order ID provided', code: 'INVALID_UUID' } as any
        });
      }

      try {
        // 🚨 明示的制約名でPostgREST関係性エラー解決
        const result = await supabase
          .from('purchase_orders')
          .select(`
            id,
            order_no,
            created_at,
            updated_at,
            status,
            total_amount,
            notes,
            partner_id,
            partners!purchase_orders_partner_id_fkey (
              id,
              name,
              quality_grade,
              payment_terms,
              specialties
            ),
            purchase_order_items!purchase_order_items_purchase_order_id_fkey (
              id,
              quantity,
              unit_price,
              total_amount,
              created_at,
              product_id,
              products!purchase_order_items_product_id_fkey (
                id,
                product_name,
                product_code,
                drawing_no,
                standard_price,
                material,
                specifications
              )
            )
          `)
          .eq('id', orderId)
          .single();

        return SupabaseHelper.handleResult(result);
        
      } catch (error) {
        console.error('Order detail fetch error:', error);
        return SupabaseHelper.handleResult({ 
          data: null, 
          error: error as any
        });
      }
    },

    async create(order: Omit<Record<string, unknown>, 'id' | 'created_at' | 'updated_at'>) {
      const orderData = {
        ...order,
        status: order.status || 'pending'
        // created_at/updated_at はデータベースに委譲
      };
      
      const result = await supabase
        .from('purchase_orders')
        .insert(orderData)
        .select(`
          *,
          partners!purchase_orders_partner_id_fkey (
            id, name, quality_grade, payment_terms
          )
        `)
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async update(id: string, updates: Partial<Record<string, unknown>>) {
      // UUID検証
      if (!id || id === 'undefined' || id === 'null') {
        return SupabaseHelper.handleResult({ 
          data: null, 
          error: { message: 'Invalid order ID for update', code: 'INVALID_UUID' } as any
        });
      }

      // updated_at はトリガーで自動更新されるため送信不要
      
      const result = await supabase
        .from('purchase_orders')
        .update({ ...updates })
        .eq('id', id)
        .select(`
          *,
          partners!purchase_orders_partner_id_fkey (
            id, name, quality_grade, payment_terms
          )
        `)
        .single();
      return SupabaseHelper.handleResult(result);
    }
  };

  static orderItems = {
    async getByOrderId(orderId: string) {
      if (!orderId || orderId === 'undefined' || orderId === 'null' || 
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        console.error('Invalid UUID provided for orderItems:', orderId);
        return SupabaseHelper.handleResult({ 
          data: [], 
          error: { message: 'Invalid order ID provided', code: 'INVALID_UUID' } as any
        });
      }

      try {
        const result = await supabase
          .from('purchase_order_items')
          .select(`
            id,
            quantity,
            unit_price,
            total_amount,
            created_at,
            updated_at,
            purchase_order_id,
            product_id,
            products!purchase_order_items_product_id_fkey (
              id,
              product_name,
              product_code,
              drawing_no,
              standard_price,
              material,
              specifications,
              current_stock,
              category
            )
          `)
          .eq('purchase_order_id', orderId)
          .order('created_at');
        return SupabaseHelper.handleResult(result);
      } catch (error) {
        console.error('OrderItems fetch error:', error);
        return SupabaseHelper.handleResult({ 
          data: [], 
          error: error as any
        });
      }
    },

    async create(orderItem: Omit<Record<string, unknown>, 'id' | 'created_at' | 'updated_at'>) {
      const orderItemData = {
        ...orderItem
        // created_at/updated_at はデータベースに委譲
      };
      
      const result = await supabase
        .from('purchase_order_items')
        .insert(orderItemData)
        .select(`
          *,
          products!purchase_order_items_product_id_fkey (
            id,
            product_name,
            product_code,
            standard_price
          )
        `)
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async update(itemId: string, updates: Partial<Record<string, unknown>>) {
      if (!itemId || itemId === 'undefined' || itemId === 'null') {
        return SupabaseHelper.handleResult({ 
          data: null, 
          error: { message: 'Invalid item ID for update', code: 'INVALID_UUID' } as any
        });
      }

      // updated_at はトリガーで自動更新されるため送信不要
      
      const result = await supabase
        .from('purchase_order_items')
        .update({ ...updates })
        .eq('id', itemId)
        .select(`
          *,
          products!purchase_order_items_product_id_fkey (
            id,
            product_name,
            product_code,
            standard_price
          )
        `)
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async delete(itemId: string) {
      if (!itemId || itemId === 'undefined' || itemId === 'null') {
        return SupabaseHelper.handleResult({ 
          data: null, 
          error: { message: 'Invalid item ID for deletion', code: 'INVALID_UUID' } as any
        });
      }

      const result = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('id', itemId)
        .select()
        .single();
      return SupabaseHelper.handleResult(result);
    },

    async bulkCreate(orderItems: Array<Omit<Record<string, unknown>, 'id' | 'created_at' | 'updated_at'>>) {
      const itemsData = orderItems.map(item => ({
        ...item
        // created_at/updated_at はデータベースに委譲
      }));
      
      const result = await supabase
        .from('purchase_order_items')
        .insert(itemsData)
        .select(`
          *,
          products!purchase_order_items_product_id_fkey (
            id,
            product_name,
            product_code,
            standard_price
          )
        `);
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
        ...movement
        // created_at はデータベースに委譲
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
      return SupabaseHelper.handleResult({ data: user, error });
    },

    async signIn(email: string, password: string) {
      const result = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return SupabaseHelper.handleResult({ data: result.data.user, error: result.error });
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      return SupabaseHelper.handleResult({ data: true, error });
    }
  };

  // 統合ビューを使用した効率的データ取得
  static stableViews = {
    // 🛡️ 日付変換ユーティリティ
    toISO(dateValue: any): string | undefined {
      if (!dateValue) return undefined;
      
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? undefined : date.toISOString();
      }
      
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? undefined : dateValue.toISOString();
      }
      
      // Day.js対応
      if (typeof dateValue?.toDate === 'function') {
        const date = dateValue.toDate();
        return isNaN(date.getTime()) ? undefined : date.toISOString();
      }
      
      return undefined;
    },

    // 🚨 強化版発注一覧取得API（未確定フィルター完全対応）
    async getPurchaseOrdersStable(params?: {
      q?: string;
      status?: 'all' | 'draft' | 'confirmed' | 'completed';
      from?: any;
      to?: any;
      limit?: number;
    }) {
      const limit = params?.limit ?? 100;
      let query = supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // 🚨 強化されたステータスフィルター（未確定対応）
      if (params?.status && params.status !== 'all') {
        if (params.status === 'draft') {
          // 未確定 = confirmed以外のすべて
          query = query.neq('status', 'confirmed');
        } else {
          query = query.eq('status', params.status);
        }
      }

      // 🛡️ 強化された日付フィルター
      const fromISO = this.toISO(params?.from);
      const toISO = this.toISO(params?.to);
      if (fromISO) query = query.gte('created_at', fromISO);
      if (toISO) query = query.lte('created_at', toISO);

      // 🔍 強化された検索機能
      if (params?.q?.trim()) {
        const searchTerm = SupabaseHelper.sanitizeSearchTerm(params.q);
        
        if (searchTerm.length > 0) {
          // 発注番号、備考での検索（基本テーブルから検索）
          // 注: 結合テーブルの検索は別途実装が必要
          query = query.or(`order_no.ilike.%${searchTerm}%,memo.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }
      }

      const { data, error } = await query;
      
      if (error) {
        return SupabaseHelper.handleResult({ data, error });
      }
      
      // 仕入先名を個別取得してデータを変換
      const transformedData = [];
      
      if (data && data.length > 0) {
        // 全ての仕入先IDを収集
        const partnerIds = [...new Set(data.map(order => order.partner_id).filter(Boolean))];
        
        // 仕入先情報を一括取得
        const { data: partnersData } = await supabase
          .from('partners')
          .select('id, name')
          .in('id', partnerIds);
        
        // 仕入先情報をマップに変換
        const partnersMap = new Map((partnersData || []).map(p => [p.id, p.name]));
        
        // データを変換
        for (const order of data) {
          transformedData.push({
            ...order,
            partner_name: partnersMap.get(order.partner_id) || '仕入先未設定',
            manager_name: '担当者未設定', // 担当者情報は別途取得が必要な場合に実装
          });
        }
      }
      
      return SupabaseHelper.handleResult({ data: transformedData, error: null });
    },

    // 発注詳細取得（統合ビュー使用でN/A表示完全回避）
    async getPurchaseOrderDetails(orderId: string) {
      // UUID検証
      if (!orderId || orderId === 'undefined' || orderId === 'null' || 
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        console.error('Invalid UUID provided for stable view:', orderId);
        return SupabaseHelper.handleResult({ 
          data: null, 
          error: { message: 'Invalid order ID provided', code: 'INVALID_UUID' } as any
        });
      }

      const { data, error } = await supabase
        .from('purchase_order_details_v1')
        .select('*')
        .eq('id', orderId)
        .single();
      
      return SupabaseHelper.handleResult({ data, error });
    },

    // 🚨 発注統計取得（N/A表示なし統計データ）
    async getPurchaseOrderStats(params?: { from?: string; to?: string }) {
      let query = supabase
        .from('purchase_orders_stable_v1')
        .select('status, total_amount, partner_name, created_at');

      if (params?.from) {
        query = query.gte('created_at', params.from);
      }
      if (params?.to) {
        query = query.lte('created_at', params.to);
      }

      const { data, error } = await query;
      
      if (error) {
        return SupabaseHelper.handleResult({ data: null, error });
      }

      // 統計処理（フロントエンドで N/A が発生しないデータ）
      const stats = {
        total: data?.length || 0,
        byStatus: {},
        byPartner: {},
        totalAmount: data?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0
      };

      data?.forEach((order: any) => {
        // status統計
        stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
        // partner統計（既にCOALESCE済みなので「仕入先未設定」として表示）
        stats.byPartner[order.partner_name] = (stats.byPartner[order.partner_name] || 0) + 1;
      });

      return SupabaseHelper.handleResult({ data: stats, error: null });
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

// WebUIコンソール用グローバル変数設定（本番環境完全対応版）
if (typeof window !== 'undefined') {
  const setupGlobals = () => {
    (window as any).supabase = supabase;
    (window as any).__supabase = supabase; // エイリアス
    (window as any).__db = db;
    console.log('✅ window.supabase グローバル変数設定完了');
    console.log('✅ window.__db ヘルパークラス設定完了');
    console.log('🎯 WebUIコンソールでのデータ操作が可能になりました');
  };

  // 即座実行
  setupGlobals();

  // DOM読み込み完了後の再設定（確実性向上）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobals, { once: true });
  }

  // 本番環境対策の遅延実行（バンドル読み込み順対策）
  setTimeout(setupGlobals, 100);
  setTimeout(setupGlobals, 1000);

  // 統合接続テスト（遅延実行）
  setTimeout(async () => {
    try {
      const { count, error } = await supabase
        .from('purchase_orders')
        .select('count', { count: 'exact', head: true });

      if (error) {
        console.error('❌ Supabase接続テストエラー:', error.message);
      } else {
        console.log('✅ Supabase接続テスト成功');
        console.log(`📊 発注データ件数: ${count || 0}件`);
        console.log('🚀 システム準備完了');
        
        // 自動診断実行
        db.runDiagnostics().then(result => {
          if (result.success) {
            console.log('🎯 システム診断完了！');
            console.log('📋 window.__db.runDiagnostics() で詳細確認可能');
          }
        }).catch(e => console.warn('⚠️ 診断例外:', e));
      }
    } catch (testError) {
      console.error('❌ 接続テスト実行エラー:', testError);
    }
  }, 1500);
}