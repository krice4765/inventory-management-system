import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Product {
  id: string;
  product_name: string;
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
  cumulative_stock_at_time?: number; // その時点での累積在庫数量
  transaction_details?: {
    order_no?: string;
    purchase_order_id?: string;
    delivery_sequence?: number;
    delivery_type?: 'full' | 'partial';
    delivery_amount?: number;
    order_total_amount?: number;
    transaction_type?: string;
  };
}

// 統合在庫レコードインターフェース（将来のアーキテクチャ進化を考慮）
export interface UnifiedInventoryRecord extends InventoryMovement {
  record_type: 'inventory_movement' | 'amount_only_transaction';
  unified_timestamp: number;

  // 在庫移動固有フィールド
  physical_quantity?: number;
  stock_after?: number;

  // 分納記録固有フィールド
  accounting_amount?: number;
  installment_no?: number;
  transaction_no?: string;

  // データ整合性管理
  data_integrity_status?: 'consistent' | 'minor_discrepancy' | 'major_conflict';
  source_system: 'inventory' | 'accounting';
  correlation_id?: string;
}

export interface MovementFilters {
  searchTerm?: string;
  movementType?: 'all' | 'in' | 'out';
  deliveryFilter?: 'all' | 'partial_delivery' | 'manual';
  sortBy?: 'created_at' | 'product_name';
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;

  // 統合表示用の追加フィルタ
  recordType?: 'all' | 'inventory_movement' | 'amount_only_transaction';
  installmentNo?: string; // フォームからは文字列として渡される
  orderNo?: string;
}

const PAGE_SIZE = 20;

// 全件在庫移動履歴の取得（ページネーション用）
export function useAllMovements(filters: MovementFilters = {}) {
  // queryKeyを安定化するために、filtersオブジェクトの個別プロパティを使用
  const stableQueryKey = [
    'all-inventory-movements',
    filters.searchTerm || '',
    filters.movementType || 'all',
    filters.deliveryFilter || 'all',
    filters.sortBy || 'created_at',
    filters.sortOrder || 'desc',
    filters.startDate || '',
    filters.endDate || ''
  ];

  return useQuery({
    queryKey: stableQueryKey,
    enabled: true,
    queryFn: async () => {
      console.log('🔄 全在庫移動データ取得開始:', { filters });

      try {
        // Step 1: inventory_movementsデータを全件取得
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
          `);

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
          // その日の開始時刻（00:00:00）
          const startDate = new Date(`${filters.startDate}T00:00:00`);
          const startDateTime = startDate.toISOString();
          console.log('📅 開始日フィルター:', {
            input: filters.startDate,
            localDate: startDate.toString(),
            isoString: startDateTime
          });
          movementQuery = movementQuery.gte('created_at', startDateTime);
        }

        if (filters.endDate) {
          // その日の終了時刻（翌日の00:00:00未満）
          const endDate = new Date(`${filters.endDate}T00:00:00`);
          endDate.setDate(endDate.getDate() + 1); // 翌日の00:00:00
          const endDateTime = endDate.toISOString();
          console.log('📅 終了日フィルター:', {
            input: filters.endDate,
            nextDay: endDate.toString(),
            isoString: endDateTime
          });
          movementQuery = movementQuery.lt('created_at', endDateTime); // ltに変更（未満）
        }

        // ソート処理
        movementQuery = movementQuery.order('created_at', { ascending: filters.sortOrder === 'asc' });

        const { data: movementsData, error: movementsError } = await movementQuery;

        if (movementsError) {
          console.error('❌ 在庫移動取得エラー:', movementsError);
          throw movementsError;
        }

        if (!movementsData || movementsData.length === 0) {
          return { data: [] };
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
            const { data: transData, error: transError } = await supabase
              .from('transactions')
              .select(`
                id,
                parent_order_id,
                total_amount,
                transaction_type,
                delivery_sequence,
                created_at
              `)
              .in('id', transactionIds);

            // 発注書情報を別途取得
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
            } else {
              // 取引データと発注書データを結合
              const orderMap = new Map(orderData.map(o => [o.id, { order_no: o.order_no, total_amount: o.total_amount }]));
              transactionsData = (transData || []).map(trans => {
                const orderInfo = orderMap.get(trans.parent_order_id);

                // 全納/分納の判定ロジック
                let delivery_type = 'partial';
                if (orderInfo && orderInfo.total_amount && trans.total_amount) {
                  const amountDifference = Math.abs(orderInfo.total_amount - trans.total_amount);
                  if (amountDifference <= 1) {
                    delivery_type = 'full';
                  }
                }

                return {
                  ...trans,
                  order_no: orderInfo?.order_no,
                  purchase_order_id: orderInfo?.order_no, // 発注書IDとして使用
                  order_total_amount: orderInfo?.total_amount,
                  delivery_type: delivery_type
                };
              });
            }
          } catch (err) {
            console.error('❌ 取引記録テーブルアクセスエラー:', err);
          }
        }

        // Step 4: データを結合
        const productsMap = new Map(productsData?.map(p => [p.id, p]) || []);
        const transactionsMap = new Map(transactionsData?.map(t => [t.id, t]) || []);

        const movements = movementsData.map(movement => {
          const product = productsMap.get(movement.product_id);
          const transaction = movement.transaction_id ? transactionsMap.get(movement.transaction_id) : null;

          return {
            ...movement,
            products: product ? {
              id: product.id,
              name: product.product_name,
              product_name: product.product_name,
              product_code: product.product_code,
              current_stock: product.current_stock,
            } : null,
            transaction_details: transaction ? {
              order_no: transaction.order_no,
              purchase_order_id: transaction.purchase_order_id,
              delivery_sequence: transaction.delivery_sequence,
              delivery_type: transaction.delivery_type,
              delivery_amount: transaction.total_amount,
              order_total_amount: transaction.order_total_amount,
              transaction_type: transaction.transaction_type,
            } : null
          };
        }).filter(m => m.products !== null);

        // 時系列順に並び替え（古い順）してから累積在庫を計算
        const sortedMovements = movements.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // 各製品の累積在庫を計算
        const movementsWithCumulativeStock = sortedMovements.map((movement, index) => {
          // この移動より前の同じ製品の移動履歴を取得（この移動を含む）
          const previousMovements = sortedMovements.filter(m =>
            m.product_id === movement.product_id &&
            new Date(m.created_at).getTime() <= new Date(movement.created_at).getTime()
          );

          // 累積在庫を計算（この移動を含む）
          const cumulativeStock = previousMovements.reduce((total, m) => {
            if (m.movement_type === 'in') {
              return total + (m.quantity || 0);
            } else {
              return total - (m.quantity || 0);
            }
          }, 0);


          return {
            ...movement,
            cumulative_stock_at_time: cumulativeStock
          };
        });

        // 元の順序（新しい順）に戻す
        const finalMovements = movementsWithCumulativeStock.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // 検索フィルタを適用
        const filteredMovements = filters.searchTerm && filters.searchTerm.trim()
          ? finalMovements.filter(m => {
              const searchLower = filters.searchTerm!.toLowerCase();
              const nameMatch = m.products?.name?.toLowerCase().includes(searchLower);
              const productNameMatch = m.products?.product_name?.toLowerCase().includes(searchLower);
              const codeMatch = m.products?.product_code?.toLowerCase().includes(searchLower);
              const memoMatch = m.memo?.toLowerCase().includes(searchLower);

              return nameMatch || productNameMatch || codeMatch || memoMatch;
            })
          : finalMovements;

        // 製品名でソートが必要な場合
        if (filters.sortBy === 'product_name') {
          filteredMovements.sort((a, b) => {
            const nameA = a.products?.name || a.products?.product_name || '';
            const nameB = b.products?.name || b.products?.product_name || '';
            return filters.sortOrder === 'asc'
              ? nameA.localeCompare(nameB)
              : nameB.localeCompare(nameA);
          });
        }

        console.log(`✅ 全在庫移動取得完了: ${filteredMovements.length}件`);

        // デバッグ: 実際のデータの日付を確認
        if (filteredMovements.length > 0) {
          const sampleDates = filteredMovements.slice(0, 5).map(m => ({
            id: m.id,
            created_at: m.created_at,
            date_only: new Date(m.created_at).toLocaleDateString('ja-JP'),
            product_name: m.products?.product_name
          }));
          console.log('📊 取得データサンプル（日付確認）:', sampleDates);
        }

        // デバッグ: フィルター適用状況を確認
        if (filters.startDate || filters.endDate) {
          console.log('🔍 日付フィルター適用状況:', {
            startDate: filters.startDate,
            endDate: filters.endDate,
            originalCount: movementsData.length,
            finalCount: filteredMovements.length
          });
        }

        return { data: filteredMovements as InventoryMovement[] };

      } catch (error) {
        console.error('❌ 全在庫移動データ取得失敗:', error);
        throw error;
      }
    },
    staleTime: 300000, // 5分キャッシュ
    refetchOnWindowFocus: false,
  });
}

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
      
      return data as Product[];
    },
    staleTime: 300000, // 5分間キャッシュ
    refetchOnWindowFocus: false,
  });
}

// 在庫移動履歴の無限スクロール対応
export function useInfiniteMovements(filters: MovementFilters = {}) {
  // queryKeyを安定化するために、filtersオブジェクトの個別プロパティを使用
  const stableQueryKey = [
    'inventory-movements',
    filters.searchTerm || '',
    filters.movementType || 'all',
    filters.deliveryFilter || 'all',
    filters.sortBy || 'created_at',
    filters.sortOrder || 'desc',
    filters.startDate || '',
    filters.endDate || ''
  ];

  return useInfiniteQuery({
    queryKey: stableQueryKey,
    enabled: true, // 常にクエリを実行（空検索でも全件表示）
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
              name: product.product_name, // 正しいフィールド名を確認
              product_name: product.product_name, // バックアップ用
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
        const filteredMovements = filters.searchTerm && filters.searchTerm.trim()
          ? movements.filter((m, idx) => {
              const searchLower = filters.searchTerm!.toLowerCase();
              const nameMatch = m.products?.name?.toLowerCase().includes(searchLower);
              const productNameMatch = m.products?.product_name?.toLowerCase().includes(searchLower);
              const codeMatch = m.products?.product_code?.toLowerCase().includes(searchLower);
              const memoMatch = m.memo?.toLowerCase().includes(searchLower);
              
              const isMatch = nameMatch || productNameMatch || codeMatch || memoMatch;
              
              // 詳細マッチング情報を出力（最初の5件のみ）
              if (idx < 5) {
                console.log(`🔍 フィルタ処理中[${idx}]:`, {
                  product_name: m.products?.product_name,
                  name: m.products?.name,
                  searchTerm: filters.searchTerm,
                  nameMatch,
                  productNameMatch,
                  codeMatch,
                  memoMatch,
                  finalMatch: isMatch
                });
              }
              
              return isMatch;
            })
          : movements;
        
        console.log('🔍 検索フィルタ適用結果:', {
          searchTerm: filters.searchTerm,
          元の件数: movements.length,
          フィルタ後: filteredMovements.length,
          検索対象: movements.slice(0, 3).map(m => ({ 
            name: m.products?.name, 
            product_name: m.products?.product_name, 
            code: m.products?.product_code,
            memo: m.memo
          })),
          実際のマッチング確認: filters.searchTerm ? movements.slice(0, 5).map((m, idx) => {
            const searchLower = filters.searchTerm!.toLowerCase();
            const result = {
              index: idx,
              product_name: m.products?.product_name,
              name: m.products?.name,
              code: m.products?.product_code,
              memo: m.memo,
              includes_name: m.products?.name ? m.products.name.toLowerCase().includes(searchLower) : false,
              includes_product_name: m.products?.product_name ? m.products.product_name.toLowerCase().includes(searchLower) : false,
              includes_code: m.products?.product_code ? m.products.product_code.toLowerCase().includes(searchLower) : false,
              includes_memo: m.memo ? m.memo.toLowerCase().includes(searchLower) : false
            };
            console.log(`🔍 マッチング詳細[${idx}]:`, result);
            return result;
          }) : '検索なし'
        });

        // 製品名でソートが必要な場合
        if (filters.sortBy === 'product_name') {
          filteredMovements.sort((a, b) => {
            const nameA = a.products?.name || a.products?.product_name || '';
            const nameB = b.products?.name || b.products?.product_name || '';
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
    staleTime: 300000, // 5分キャッシュ（リロード問題防止）
    refetchOnWindowFocus: false,
    initialPageParam: 0,
    refetchOnMount: false, // マウント時のリフェッチを無効化
  });
}

// 在庫統計データ
export function useInventoryStats(filters: MovementFilters = {}) {
  // queryKeyを安定化するために、filtersオブジェクトの個別プロパティを使用
  const stableStatsQueryKey = [
    'inventory-stats',
    filters.searchTerm || '',
    filters.movementType || 'all',
    filters.deliveryFilter || 'all',
    filters.startDate || '',
    filters.endDate || ''
  ];

  return useQuery({
    queryKey: stableStatsQueryKey,
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

        // 件数と数量両方の統計
        const stats = data?.reduce((acc, item) => {
          if (item.movement_type === 'in') {
            acc.totalInCount += 1;
            acc.totalInQuantity += item.quantity || 0;
          } else {
            acc.totalOutCount += 1;
            acc.totalOutQuantity += item.quantity || 0;
          }
          return acc;
        }, {
          totalInCount: 0,
          totalInQuantity: 0,
          totalOutCount: 0,
          totalOutQuantity: 0,
        }) || {
          totalInCount: 0,
          totalInQuantity: 0,
          totalOutCount: 0,
          totalOutQuantity: 0,
        };

        return {
          // 件数統計
          totalMovements: (stats.totalInCount + stats.totalOutCount),
          totalIn: stats.totalInCount,
          totalOut: stats.totalOutCount,
          // 数量統計
          totalInQuantity: stats.totalInQuantity,
          totalOutQuantity: stats.totalOutQuantity,
          netQuantity: stats.totalInQuantity - stats.totalOutQuantity,
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