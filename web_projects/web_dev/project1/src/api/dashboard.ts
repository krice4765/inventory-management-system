import { supabase } from '../lib/supabase';

export type DashboardStats = {
  totalProducts: number;
  lowStockCount: number;
  totalStockValue: number;
  totalPotentialRevenue: number;
};

export type RecentUpdate = {
  id: number;
  name: string;
  product_code: string;
  updated_at: string;
  stock_quantity: number;
  safety_stock_quantity: number;
};

/**
 * ダッシュボード統計を取得
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase
    .from('products')
    .select('stock_quantity, safety_stock_quantity, purchase_price, sell_price');

  if (error) {
    throw new Error(`Dashboard統計の取得に失敗: ${error.message}`);
  }

  const products = data ?? [];

  let lowStockCount = 0;
  let totalStockValue = 0;
  let totalPotentialRevenue = 0;

  for (const product of products) {
    const qty = product.stock_quantity ?? 0;
    const safety = product.safety_stock_quantity ?? 0;
    const purchase = Number(product.purchase_price ?? 0);
    const sell = Number(product.sell_price ?? 0);

    if (qty <= safety) {
      lowStockCount += 1;
    }
    totalStockValue += qty * purchase;
    totalPotentialRevenue += qty * sell;
  }

  return {
    totalProducts: products.length,
    lowStockCount,
    totalStockValue,
    totalPotentialRevenue,
  };
}

/**
 * 最近更新された商品を取得
 */
export async function fetchRecentUpdates(limit = 10): Promise<RecentUpdate[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, product_code, updated_at, stock_quantity, safety_stock_quantity')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`最近更新の取得に失敗: ${error.message}`);
  }

  return data ?? [];
}