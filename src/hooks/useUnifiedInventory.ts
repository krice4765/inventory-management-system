// 統合在庫履歴表示のための新しいフック（Phase 1）
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { MovementFilters, UnifiedInventoryRecord } from './useOptimizedInventory';

// 金額のみ分納レコード取得関数（Phase 1の新機能）
async function getAmountOnlyTransactions(filters: MovementFilters = {}) {
  console.log('🔄 金額のみ分納レコード取得開始:', { filters });

  try {
    // 分納レコードのみ取得（在庫変動なしの金額のみ分納を想定）
    let amountOnlyQuery = supabase
      .from('transactions')
      .select(`
        id,
        parent_order_id,
        total_amount,
        delivery_sequence,
        created_at,
        transaction_no,
        memo,
        transaction_type
      `)
      .eq('transaction_type', 'purchase') // 実際の分納レコードタイプ
      .eq('status', 'confirmed') // 確定済みのみ
      .not('parent_order_id', 'is', null); // parent_order_idが存在するもの

    // 日付フィルタ適用
    if (filters.startDate) {
      const startDate = new Date(`${filters.startDate}T00:00:00`);
      const startDateTime = startDate.toISOString();
      amountOnlyQuery = amountOnlyQuery.gte('created_at', startDateTime);
    }

    if (filters.endDate) {
      const endDate = new Date(`${filters.endDate}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1);
      const endDateTime = endDate.toISOString();
      amountOnlyQuery = amountOnlyQuery.lt('created_at', endDateTime);
    }

    // ソート適用
    amountOnlyQuery = amountOnlyQuery.order('created_at', { ascending: filters.sortOrder === 'asc' });

    const { data: amountOnlyData, error: amountOnlyError } = await amountOnlyQuery;

    if (amountOnlyError) {
      console.error('❌ 金額のみ分納取得エラー:', amountOnlyError);
      throw amountOnlyError;
    }

    console.log('📊 取得した分納データ:', {
      count: amountOnlyData?.length || 0,
      sampleData: amountOnlyData?.slice(0, 2) || []
    });

    if (!amountOnlyData || amountOnlyData.length === 0) {
      console.log('✅ 金額のみ分納レコードなし');
      return [];
    }

    // 関連する発注書情報を取得
    const orderIds = Array.from(new Set(amountOnlyData.map(t => t.parent_order_id).filter(Boolean)));
    let orderData = [];

    if (orderIds.length > 0) {
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          order_no,
          total_amount,
          partner_id,
          status
        `)
        .in('id', orderIds);

      if (ordersError) {
        console.error('❌ 関連発注書取得エラー:', ordersError);
      } else {
        orderData = ordersData || [];
      }
    }

    // 関連する製品情報を取得（purchase_order_itemsから）
    const productMap = new Map();
    if (orderIds.length > 0) {
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('purchase_order_items')
        .select(`
          purchase_order_id,
          product_id,
          quantity,
          unit_price,
          products (
            id,
            product_name,
            product_code
          )
        `)
        .in('purchase_order_id', orderIds);

      if (!orderItemsError && orderItemsData) {
        orderItemsData.forEach(item => {
          if (!productMap.has(item.purchase_order_id)) {
            productMap.set(item.purchase_order_id, []);
          }
          productMap.get(item.purchase_order_id).push({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            product: item.products
          });
        });
      }
    }

    // データを統合（複数商品がある場合は主要商品を選択）
    const orderMap = new Map(orderData.map(o => [o.id, o]));

    const processedRecords = amountOnlyData.map(transaction => {
      const orderInfo = orderMap.get(transaction.parent_order_id);
      const orderItems = productMap.get(transaction.parent_order_id) || [];

      // 主要商品を選択（数量または金額が最大のもの）
      const primaryProduct = orderItems.length > 0
        ? orderItems.reduce((max, item) =>
            (item.quantity * item.unit_price) > (max.quantity * max.unit_price) ? item : max
          )
        : null;

      return {
        id: transaction.id,
        record_type: 'amount_only_transaction' as const,
        product_id: primaryProduct?.product_id || null,
        unified_timestamp: new Date(transaction.created_at).getTime(),
        created_at: transaction.created_at,
        total_amount: transaction.total_amount || 0,
        memo: transaction.memo || `分納入力 ${transaction.delivery_sequence}回目`,

        // 分納固有情報
        accounting_amount: transaction.total_amount,
        installment_no: transaction.delivery_sequence || null,
        transaction_no: transaction.transaction_no,

        // 在庫移動関連は0またはundefined
        movement_type: undefined,
        quantity: 0,
        physical_quantity: 0,
        unit_price: primaryProduct?.unit_price || 0,

        // 商品情報
        products: primaryProduct ? {
          id: primaryProduct.product.id,
          product_name: primaryProduct.product.product_name,
          product_code: primaryProduct.product.product_code,
          current_stock: 0 // 在庫変動なしなので0
        } : null,

        // 発注情報
        transaction_details: {
          order_no: orderInfo?.order_no,
          delivery_type: 'amount_only',
          delivery_amount: transaction.total_amount,
          order_total_amount: orderInfo?.total_amount,
          transaction_type: transaction.transaction_type,
        },

        // メタデータ
        source_system: 'accounting' as const,
        data_integrity_status: 'consistent' as const,
        correlation_id: transaction.parent_order_id,
        transaction_id: transaction.id,
      };
    }).filter(record => {
      // 商品情報があるもの、または金額のみ分納で有効なデータ
      return record.products !== null ||
             (record.record_type === 'amount_only_transaction' && record.total_amount > 0);
    });

    console.log(`✅ 金額のみ分納レコード取得完了: ${processedRecords.length}件`);
    return processedRecords;

  } catch (error) {
    console.error('❌ 金額のみ分納レコード取得失敗:', error);
    // エラーが発生してもアプリケーションを停止させない
    console.warn('⚠️ 金額のみ分納データを取得できませんでしたが、処理を続行します');
    return [];
  }
}

// 統合在庫履歴取得関数（Phase 1の核心機能）
export function useUnifiedInventoryMovements(filters: MovementFilters = {}) {
  // 安定したqueryKeyの作成
  const stableQueryKey = [
    'unified-inventory-movements',
    filters.searchTerm || '',
    filters.movementType || 'all',
    filters.deliveryFilter || 'all',
    filters.recordType || 'all',
    filters.sortBy || 'created_at',
    filters.sortOrder || 'desc',
    filters.startDate || '',
    filters.endDate || '',
    filters.installmentNo || '',
    filters.orderNo || ''
  ];

  return useQuery({
    queryKey: stableQueryKey,
    enabled: true,
    queryFn: async () => {
      console.log('🔄 統合在庫履歴データ取得開始:', { filters });

      try {
        // Step 1: 既存のinventory_movementsを取得
        let inventoryQuery = supabase
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
            transaction_id,
            installment_no
          `);

        // 日付フィルタを適用
        if (filters.startDate) {
          const startDate = new Date(`${filters.startDate}T00:00:00`);
          inventoryQuery = inventoryQuery.gte('created_at', startDate.toISOString());
        }

        if (filters.endDate) {
          const endDate = new Date(`${filters.endDate}T00:00:00`);
          endDate.setDate(endDate.getDate() + 1);
          inventoryQuery = inventoryQuery.lt('created_at', endDate.toISOString());
        }

        const inventoryResponse = await inventoryQuery;

        if (inventoryResponse.error) {
          console.error('❌ 在庫移動データ取得エラー:', inventoryResponse.error);
          throw inventoryResponse.error;
        }

        // Step 2: 金額のみ分納レコードを取得（エラーが発生しても続行）
        let amountOnlyTransactions = [];
        try {
          amountOnlyTransactions = await getAmountOnlyTransactions(filters);
        } catch (error) {
          console.warn('⚠️ 金額のみ分納データの取得をスキップしました:', error);
        }

        // Step 3: inventory_movementsを統合形式に変換
        const inventoryMovements = inventoryResponse.data || [];

        // 製品情報を一括取得
        const allProductIds = Array.from(new Set([
          ...inventoryMovements.map(m => m.product_id),
          ...amountOnlyTransactions.map(t => t.product_id).filter(Boolean)
        ]));

        let productsData = [];
        if (allProductIds.length > 0) {
          const { data: fetchedProducts, error: productsError } = await supabase
            .from('products')
            .select('id, product_name, product_code, current_stock')
            .in('id', allProductIds);

          if (productsError) {
            console.warn('⚠️ 商品情報取得エラー:', productsError);
          } else {
            productsData = fetchedProducts || [];
          }
        }

        const productsMap = new Map(productsData?.map(p => [p.id, p]) || []);

        // inventory_movementsを統合形式に変換
        const convertedInventoryMovements = inventoryMovements.map(movement => ({
          ...movement,
          record_type: 'inventory_movement' as const,
          unified_timestamp: new Date(movement.created_at).getTime(),
          physical_quantity: movement.quantity,
          source_system: 'inventory' as const,
          data_integrity_status: 'consistent' as const,
          products: productsMap.get(movement.product_id) || null,
        }));

        // Step 4: 両方のデータを統合
        const unifiedRecords = [
          ...convertedInventoryMovements,
          ...amountOnlyTransactions
        ].filter(record => {
          // 在庫移動は必ず商品情報が必要、金額のみ分納は商品情報がなくても許可
          return record.products !== null ||
                 (record.record_type === 'amount_only_transaction' && record.total_amount > 0);
        });

        // Step 5: フィルタ適用
        let filteredRecords = unifiedRecords;

        // レコード種別フィルタ
        if (filters.recordType && filters.recordType !== 'all') {
          filteredRecords = filteredRecords.filter(record =>
            record.record_type === filters.recordType
          );
        }

        // 移動種別フィルタ（在庫移動のみ対象）
        if (filters.movementType && filters.movementType !== 'all') {
          filteredRecords = filteredRecords.filter(record =>
            record.record_type === 'amount_only_transaction' ||
            record.movement_type === filters.movementType
          );
        }

        // 検索フィルタ
        if (filters.searchTerm && filters.searchTerm.trim()) {
          const searchLower = filters.searchTerm.toLowerCase();
          filteredRecords = filteredRecords.filter(record => {
            const nameMatch = record.products?.product_name?.toLowerCase().includes(searchLower);
            const codeMatch = record.products?.product_code?.toLowerCase().includes(searchLower);
            const memoMatch = record.memo?.toLowerCase().includes(searchLower);
            const orderNoMatch = record.transaction_details?.order_no?.toLowerCase().includes(searchLower);

            // メモ内のPO番号検索
            const poIdInMemoMatch = record.memo && /PO\d{9,}/.test(record.memo) &&
                                   record.memo.match(/PO\d{9,}/)?.[0]?.toLowerCase().includes(searchLower);

            // 分納入力の場合の特別な検索処理
            const isInstallmentMatch = record.record_type === 'amount_only_transaction' &&
                                      searchLower.includes('分納');
            const installmentKeywordMatch = record.record_type === 'amount_only_transaction' &&
                                           (searchLower === '分納入力' || searchLower === '分納');

            return nameMatch || codeMatch || memoMatch || orderNoMatch || poIdInMemoMatch ||
                   isInstallmentMatch || installmentKeywordMatch;
          });
        }

        // 分納回数フィルタ
        if (filters.installmentNo && filters.installmentNo.trim()) {
          const installmentNum = parseInt(filters.installmentNo, 10);
          console.log('🔍 分納回数フィルタ:', {
            入力値: filters.installmentNo,
            数値変換後: installmentNum,
            isNaN: isNaN(installmentNum)
          });

          if (!isNaN(installmentNum)) {
            const beforeCount = filteredRecords.length;
            filteredRecords = filteredRecords.filter(record => {
              const matches = record.installment_no === installmentNum ||
                             record.delivery_sequence === installmentNum;

              // デバッグ用ログ
              if (record.record_type === 'amount_only_transaction' || record.memo?.includes('分納入力')) {
                console.log(`分納レコード確認:`, {
                  memo: record.memo?.slice(0, 50),
                  installment_no: record.installment_no,
                  delivery_sequence: record.delivery_sequence,
                  検索回数: installmentNum,
                  マッチ: matches
                });
              }

              return matches;
            });

            console.log(`分納回数フィルタ結果: ${beforeCount} → ${filteredRecords.length}件`);
          }
        }

        // 発注番号フィルタ
        if (filters.orderNo && filters.orderNo.trim()) {
          const orderNoLower = filters.orderNo.toLowerCase();
          filteredRecords = filteredRecords.filter(record => {
            // transaction_detailsから検索
            const orderNoMatch = record.transaction_details?.order_no?.toLowerCase().includes(orderNoLower);

            // memoから発注番号を検索（PO番号形式）
            const memoOrderMatch = record.memo?.toLowerCase().includes(orderNoLower);

            return orderNoMatch || memoOrderMatch;
          });
        }

        // Step 6: ソート適用
        filteredRecords.sort((a, b) => {
          if (filters.sortBy === 'product_name') {
            const nameA = a.products?.product_name || '';
            const nameB = b.products?.product_name || '';
            return filters.sortOrder === 'asc'
              ? nameA.localeCompare(nameB)
              : nameB.localeCompare(nameA);
          } else {
            // created_at でソート（デフォルト）
            return filters.sortOrder === 'asc'
              ? a.unified_timestamp - b.unified_timestamp
              : b.unified_timestamp - a.unified_timestamp;
          }
        });

        console.log(`✅ 統合在庫履歴取得完了:`, {
          total: filteredRecords.length,
          inventory_movements: filteredRecords.filter(r => r.record_type === 'inventory_movement').length,
          amount_only_transactions: filteredRecords.filter(r => r.record_type === 'amount_only_transaction').length
        });

        return { data: filteredRecords as UnifiedInventoryRecord[] };

      } catch (error) {
        console.error('❌ 統合在庫履歴データ取得失敗:', error);
        throw error;
      }
    },
    staleTime: 30000, // 30秒キャッシュ（短縮）
    refetchOnWindowFocus: true, // フォーカス時に再取得
  });
}

// データ整合性検証関数
export function validateDataIntegrity(records: UnifiedInventoryRecord[]): {
  consistent: UnifiedInventoryRecord[];
  inconsistencies: UnifiedInventoryRecord[];
} {
  const consistent: UnifiedInventoryRecord[] = [];
  const inconsistencies: UnifiedInventoryRecord[] = [];

  records.forEach(record => {
    let isConsistent = true;
    const issues: string[] = [];

    // 在庫移動レコードの検証
    if (record.record_type === 'inventory_movement') {
      if (!record.quantity || record.quantity === 0) {
        issues.push('数量が0または未設定');
        isConsistent = false;
      }
      if (!record.movement_type) {
        issues.push('移動種別が未設定');
        isConsistent = false;
      }
    }

    // 金額のみ分納レコードの検証
    if (record.record_type === 'amount_only_transaction') {
      if (!record.accounting_amount || record.accounting_amount === 0) {
        issues.push('金額が0または未設定');
        isConsistent = false;
      }
      if (!record.installment_no) {
        issues.push('分納回数が未設定');
        isConsistent = false;
      }
    }

    // 共通検証
    if (!record.products || !record.products.product_name) {
      issues.push('商品情報が不完全');
      isConsistent = false;
    }

    const validatedRecord = {
      ...record,
      data_integrity_status: isConsistent ? 'consistent' : 'major_conflict'
    } as UnifiedInventoryRecord;

    if (isConsistent) {
      consistent.push(validatedRecord);
    } else {
      inconsistencies.push(validatedRecord);
      console.warn('⚠️ データ整合性問題:', {
        record_id: record.id,
        record_type: record.record_type,
        issues
      });
    }
  });

  return { consistent, inconsistencies };
}