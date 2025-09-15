import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { performanceMonitor } from '../utils/performanceMonitor';

// Database型から商品関連の型を抽出
export type Product = Database['public']['Tables']['products']['Row'];
export type ProductInsert = Database['public']['Tables']['products']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products']['Update'];

// 仕入先情報を含む拡張商品型
export type ProductWithSupplier = Product & {
  suppliers?: {
    id: number;
    name: string;
  } | null;
};

/**
 * 全ての商品データを仕入先情報と共に取得（パフォーマンス最適化版 + 監視機能）
 */
export const getProducts = async (): Promise<ProductWithSupplier[]> => {
  const startTime = performance.now();

  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      product_code,
      product_name,
      description,
      purchase_price,
      sell_price,
      stock_quantity,
      safety_stock_quantity,
      main_supplier_id,
      image_url,
      created_at,
      updated_at,
      suppliers:main_supplier_id(id, name)
    `)
    .order('id', { ascending: false })
    .limit(1000);

  const executionTime = performance.now() - startTime;

  // パフォーマンス監視に記録（最適化済みとしてマーク）
  performanceMonitor.trackQuery('getProducts', executionTime, true);

  if (error) {
    console.error('商品データ取得エラー:', error);
    throw new Error(`商品データの取得に失敗しました: ${error.message}`);
  }

  return data || [];
};

/**
 * 新しい商品を登録
 */
export const createProduct = async (productData: ProductInsert): Promise<Product> => {
  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();

  if (error) {
    console.error('商品作成エラー:', error);
    if (error.code === '23505') {
      throw new Error('商品コードが重複しています。別のコードを使用してください。');
    }
    throw new Error(`商品の登録に失敗しました: ${error.message}`);
  }
  
  return data;
};

/**
 * 既存の商品情報を更新
 */
export const updateProduct = async (id: number, productData: ProductUpdate): Promise<Product> => {
  const { data, error } = await supabase
    .from('products')
    .update(productData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('商品更新エラー:', error);
    if (error.code === '23505') {
      throw new Error('商品コードが重複しています。別のコードを使用してください。');
    }
    throw new Error(`商品の更新に失敗しました: ${error.message}`);
  }
  
  return data;
};

/**
 * 指定した商品を削除
 */
export const deleteProduct = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('商品削除エラー:', error);
    throw new Error(`商品の削除に失敗しました: ${error.message}`);
  }
};

/**
 * 仕入先一覧を取得
 */
export const getSuppliers = async () => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('仕入先データ取得エラー:', error);
    throw new Error(`仕入先データの取得に失敗しました: ${error.message}`);
  }
  
  return data || [];
};