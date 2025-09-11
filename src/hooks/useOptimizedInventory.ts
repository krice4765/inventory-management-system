import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Product {
  id: string;
  name: string;
  product_code: string;
  current_stock: number;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  unit_price: number;
  total_amount: number;
  memo: string;
  created_at: string;
  products: Product;
  transaction_id?: string;
  delivery_scheduled_date?: string;
  transaction_details?: {
    order_no?: string;
    delivery_type?: 'full' | 'partial';
    delivery_amount?: number;
    order_total_amount?: number;
    transaction_type?: string;
  };
}

export interface MovementFilters {
  searchTerm?: string;
  movementType?: 'all' | 'in' | 'out';
  deliveryFilter?: 'all' | 'partial_delivery' | 'manual';
  sortBy?: 'created_at' | 'product_name';
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

const PAGE_SIZE = 20;

// 製品リスト取得（軽量、長期キャッシュ）
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          product_name,
          product_code,
          current_stock
        `)
        .order('product_name');
      
      if (error) {
        console.error('❌ 製品データ取得エラー:', error);
        throw error;
      }
      
      // name プロパティを追加
      const productsWithName = data?.map(product => ({
        ...product,
        name: product.product_name
      })) || [];
      
      return productsWithName as Product[];
    },
    staleTime: 300000, // 5分間キャッシュ
    refetchOnWindowFocus: false,
  });
}

// 在庫移動履歴の無限スクロール対応
export function useInfiniteMovements(filters: MovementFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['inventory-movements', filters],
    queryFn: async ({ pageParam = 0 }) => {
      console.log('🔄 在庫移動データ取得開始:', { page: pageParam, filters });
      
      try {
        // Step 1: inventory_movementsデータを取得
        let movementQuery = supabase
          .from('inventory_movements')
          .select(`
            id,
            product_id,
            movement_type,
            quantity,
            unit_price,
            total_amount,
            memo,
            created_at,
            transaction_id
          `)
          .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

        // フィルタ適用（inventory_movementsテーブルのみ）
        if (filters.movementType && filters.movementType !== 'all') {
          movementQuery = movementQuery.eq('movement_type', filters.movementType);
        }
        
        if (filters.deliveryFilter === 'partial_delivery') {
          movementQuery = movementQuery.not('transaction_id', 'is', null);
        } else if (filters.deliveryFilter === 'manual') {
          movementQuery = movementQuery.is('transaction_id', null);
        }
        
        if (filters.startDate) {
          movementQuery = movementQuery.gte('created_at', filters.startDate);
        }
        
        if (filters.endDate) {
          movementQuery = movementQuery.lte('created_at', filters.endDate);
        }

        // ソート処理
        movementQuery = movementQuery.order('created_at', { ascending: filters.sortOrder === 'asc' });

        const { data: movementsData, error: movementsError } = await movementQuery;
        
        if (movementsError) {
          console.error('❌ 在庫移動取得エラー:', movementsError);
          throw movementsError;
        }

        if (!movementsData || movementsData.length === 0) {
          return {
            data: [],
            nextCursor: undefined,
            hasNextPage: false
          };
        }

        // Step 2: 関連する製品データを取得
        const productIds = Array.from(new Set(movementsData.map(m => m.product_id)));
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, product_name, product_code, current_stock')
          .in('id', productIds);
        
        if (productsError) {
          console.error('❌ 関連製品取得エラー:', productsError);
          throw productsError;
        }

        // Step 3: 関連する取引データを取得（transaction_idがある場合）
        const transactionIds = Array.from(new Set(
          movementsData
            .filter(m => m.transaction_id)
            .map(m => m.transaction_id)
        ));

        let transactionsData = [];
        if (transactionIds.length > 0) {
          try {
            // transactions テーブルから基本情報を取得（存在するカラムのみ）
            const { data: transData, error: transError } = await supabase
              .from('transactions')
              .select(`
                id,
                parent_order_id,
                total_amount,
                transaction_type,
                created_at
              `)
              .in('id', transactionIds);
            
            // 発注書情報を別途取得（総額も含める）
            let orderData = [];
            if (transData && transData.length > 0) {
              const orderIds = Array.from(new Set(transData.map(t => t.parent_order_id).filter(Boolean)));
              if (orderIds.length > 0) {
                const { data: ordersData } = await supabase
                  .from('purchase_orders')
                  .select('id, order_no, total_amount')
                  .in('id', orderIds);
                orderData = ordersData || [];
              }
            }
            
            if (transError) {
              console.error('❌ 取引記録取得エラー:', transError);
              // エラーがあっても処理を続行（取引記録は補助的な情報）
            } else {
              // 取引データと発注書データを結合
              const orderMap = new Map(orderData.map(o => [o.id, { order_no: o.order_no, total_amount: o.total_amount }]));
              transactionsData = (transData || []).map(trans => {
                const orderInfo = orderMap.get(trans.parent_order_id);
                
                // 全納/分納の判定ロジック
                let delivery_type = 'partial'; // デフォルトは分納
                if (orderInfo && orderInfo.total_amount && trans.total_amount) {
                  // 金額差が1円以内の場合は全納とみなす（浮動小数点誤差を考慮）
                  const amountDifference = Math.abs(orderInfo.total_amount - trans.total_amount);
                  if (amountDifference <= 1) {
                    delivery_type = 'full';
                  }
                }
                

                return {
                  ...trans,
                  order_no: orderInfo?.order_no,
                  order_total_amount: orderInfo?.total_amount,
                  delivery_type: delivery_type
                };
              });
              console.log('✅ 取引記録取得成功:', transactionsData.length, '件');
              console.log('✅ 発注書情報取得成功:', orderData.length, '件');
            }
          } catch (err) {
            console.error('❌ 取引記録テーブルアクセスエラー:', err);
            // テーブルが存在しない場合も想定して続行
          }
        }

        // Step 4: データを結合
        const productsMap = new Map(productsData?.map(p => [p.id, p]) || []);
        const transactionsMap = new Map(transactionsData?.map(t => [t.id, t]) || []);
        
        const movements = movementsData.map(movement => {
          const product = productsMap.get(movement.product_id);
          const transaction = movement.transaction_id ? transactionsMap.get(movement.transaction_id) : null;
          
          const result = {
            ...movement,
            products: product ? {
              id: product.id,
              name: product.product_name,
              product_code: product.product_code,
              current_stock: product.current_stock,
            } : null,
            transaction_details: transaction ? {
              order_no: transaction.order_no,
              delivery_type: transaction.delivery_type, // 全納/分納の判定結果を使用
              delivery_amount: transaction.total_amount,
              order_total_amount: transaction.order_total_amount,
              transaction_type: transaction.transaction_type,
            } : null
          };
          
          // デバッグ: データ構造を確認
          console.log('🔍 Movement data structure:', {
            movement_id: movement.id,
            transaction_id: movement.transaction_id,
            product_found: !!product,
            product_name: product?.product_name,
            transaction_found: !!transaction,
            transaction_details: result.transaction_details,
            result_products: result.products
          });
          
          return result;
        }).filter(m => m.products !== null); // 製品データがないものは除外

        // 検索フィルタをここで適用（製品名で検索）
        const filteredMovements = filters.searchTerm 
          ? movements.filter(m => 
              m.products?.name?.toLowerCase().includes(filters.searchTerm!.toLowerCase())
            )
          : movements;

        // 製品名でソートが必要な場合
        if (filters.sortBy === 'product_name') {
          filteredMovements.sort((a, b) => {
            const nameA = a.products?.name || '';
            const nameB = b.products?.name || '';
            return filters.sortOrder === 'asc' 
              ? nameA.localeCompare(nameB)
              : nameB.localeCompare(nameA);
          });
        }

        console.log(`✅ 在庫移動取得完了: ${filteredMovements.length}件`);
        console.log('📊 取引詳細サマリー:', {
          total_movements: filteredMovements.length,
          with_transaction_id: filteredMovements.filter(m => m.transaction_id).length,
          with_transaction_details: filteredMovements.filter(m => m.transaction_details).length,
          transaction_ids: Array.from(new Set(filteredMovements.filter(m => m.transaction_id).map(m => m.transaction_id))),
          transactions_retrieved: transactionsData.length
        });
        
        return {
          data: filteredMovements as InventoryMovement[],
          nextCursor: filteredMovements.length === PAGE_SIZE ? pageParam + 1 : undefined,
          hasNextPage: filteredMovements.length === PAGE_SIZE
        };

      } catch (error) {
        console.error('❌ 在庫移動データ取得失敗:', error);
        throw error;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60000, // 1分間キャッシュ
    refetchOnWindowFocus: false,
    initialPageParam: 0,
  });
}

// 在庫統計データ
export function useInventoryStats(filters: MovementFilters = {}) {
  return useQuery({
    queryKey: ['inventory-stats', filters],
    queryFn: async () => {
      try {
        let query = supabase.from('inventory_movements').select('movement_type, quantity');
        
        // フィルタ適用
        if (filters.movementType && filters.movementType !== 'all') {
          query = query.eq('movement_type', filters.movementType);
        }
        
        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        
        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('❌ 統計データ取得エラー:', error);
          throw error;
        }
        
        // 純粋な数量統計
        const stats = data?.reduce((acc, item) => {
          if (item.movement_type === 'in') {
            acc.totalIn += item.quantity || 0;
          } else {
            acc.totalOut += item.quantity || 0;
          }
          return acc;
        }, {
          totalIn: 0,
          totalOut: 0,
        }) || {
          totalIn: 0,
          totalOut: 0,
        };
        
        return {
          ...stats,
          netQuantity: stats.totalIn - stats.totalOut,
        };
        
      } catch (error) {
        console.error('❌ 統計データ取得失敗:', error);
        throw error;
      }
    },
    staleTime: 300000, // 5分間キャッシュ
    refetchOnWindowFocus: false,
  });
}