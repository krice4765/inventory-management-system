/**
 * 在庫計算の共通ユーティリティ
 * inventory_movementsテーブルから現在庫を動的に計算
 */

import { supabase } from '../lib/supabase';

export interface InventoryMovement {
  product_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  created_at: string;
}

export interface ProductWithDynamicStock {
  id: string;
  product_name: string;
  product_code: string;
  category: string;
  standard_price: number;
  selling_price: number;
  current_stock: number; // 動的に計算される現在庫
  min_stock_level: number;
  tax_category: string;
  tax_category_updated_at?: string;
  created_at: string;
}

/**
 * 単一商品の現在庫を計算
 */
export async function calculateProductStock(productId: string): Promise<number> {
  try {
    const { data: movements, error } = await supabase
      .from('inventory_movements')
      .select('movement_type, quantity')
      .eq('product_id', productId);

    if (error) {
      console.warn(`在庫計算エラー (商品ID: ${productId}):`, error);
      return 0;
    }

    if (!movements || movements.length === 0) {
      return 0;
    }

    const totalIn = movements
      .filter(m => m.movement_type === 'in')
      .reduce((sum, m) => sum + (m.quantity || 0), 0);

    const totalOut = movements
      .filter(m => m.movement_type === 'out')
      .reduce((sum, m) => sum + (m.quantity || 0), 0);

    return Math.max(0, totalIn - totalOut);
  } catch (error) {
    console.error(`在庫計算処理エラー (商品ID: ${productId}):`, error);
    return 0;
  }
}

/**
 * 全商品の現在庫を動的に計算して取得
 */
export async function fetchProductsWithDynamicStock(): Promise<ProductWithDynamicStock[]> {
  try {
    // 商品基本情報を取得
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('商品データ取得エラー:', productsError);
      throw productsError;
    }

    if (!products || products.length === 0) {
      return [];
    }

    // 全ての在庫移動データを一括取得（パフォーマンス最適化）
    const { data: movements, error: movementsError } = await supabase
      .from('inventory_movements')
      .select('product_id, movement_type, quantity')
      .order('created_at', { ascending: false });

    if (movementsError) {
      console.warn('在庫移動データ取得エラー:', movementsError);
    }

    // 商品ごとの現在庫を計算
    const movementsMap = new Map<string, InventoryMovement[]>();

    // 移動履歴を商品IDでグループ化
    movements?.forEach(movement => {
      const productId = movement.product_id;
      if (!movementsMap.has(productId)) {
        movementsMap.set(productId, []);
      }
      movementsMap.get(productId)!.push(movement as InventoryMovement);
    });

    // 各商品の現在庫を計算
    return products.map(product => {
      const productMovements = movementsMap.get(product.id) || [];

      // 移動履歴から在庫計算（'in'は加算、'out'は減算）
      const current_stock = Math.max(0, productMovements.reduce((sum, m) => {
        const quantity = m.quantity || 0;
        return m.movement_type === 'in' ? sum + quantity : sum - quantity;
      }, 0));

      return {
        ...product,
        current_stock // inventory_movementsから計算された値で上書き
      } as ProductWithDynamicStock;
    });

  } catch (error) {
    console.error('商品・在庫データ取得エラー:', error);
    throw error;
  }
}

/**
 * 在庫移動履歴の概要を取得
 */
export async function getInventoryMovementSummary(productId: string) {
  try {
    const { data: movements, error } = await supabase
      .from('inventory_movements')
      .select('movement_type, quantity, created_at, memo')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(10); // 最新10件

    if (error) {
      console.error('在庫移動履歴取得エラー:', error);
      return [];
    }

    return movements || [];
  } catch (error) {
    console.error('在庫移動履歴取得処理エラー:', error);
    return [];
  }
}