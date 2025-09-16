import { supabase } from '../lib/supabase'

/**
 * データベースバックアップ作成ツール
 * 分納データ修正前の安全確保
 */
export class DatabaseBackup {

  /**
   * 分納関連データの完全バックアップ作成
   */
  static async createInstallmentBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData: any = {
      backup_info: {
        created_at: new Date().toISOString(),
        purpose: '分納データ修正前バックアップ',
        version: '1.0',
        timestamp
      }
    };

    console.log('🛡️ 分納データバックアップ開始:', timestamp);

    try {
      // 1. 発注書データバックアップ
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select('*');

      if (poError) throw poError;
      backupData.purchase_orders = purchaseOrders;
      console.log('✅ 発注書データ:', purchaseOrders?.length, '件');

      // 2. 分納トランザクションデータバックアップ
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('transaction_type', 'purchase');

      if (txError) throw txError;
      backupData.transactions = transactions;
      console.log('✅ 分納データ:', transactions?.length, '件');

      // 3. 在庫移動履歴バックアップ
      const { data: movements, error: mvError } = await supabase
        .from('inventory_movements')
        .select('*')
        .not('transaction_id', 'is', null);

      if (mvError) throw mvError;
      backupData.inventory_movements = movements;
      console.log('✅ 在庫移動データ:', movements?.length, '件');

      // 4. 発注明細データバックアップ
      const { data: items, error: itemError } = await supabase
        .from('purchase_order_items')
        .select('*');

      if (itemError) throw itemError;
      backupData.purchase_order_items = items;
      console.log('✅ 発注明細データ:', items?.length, '件');

      // 5. バックアップファイル作成
      const backupJson = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // 6. ダウンロード実行
      const link = document.createElement('a');
      link.href = url;
      link.download = `installment_backup_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ バックアップ完了:', link.download);

      return {
        success: true,
        filename: link.download,
        data: {
          purchase_orders: purchaseOrders?.length || 0,
          transactions: transactions?.length || 0,
          inventory_movements: movements?.length || 0,
          purchase_order_items: items?.length || 0
        }
      };

    } catch (error) {
      console.error('❌ バックアップエラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー'
      };
    }
  }

  /**
   * 特定発注書の詳細バックアップ
   */
  static async createOrderBackup(orderNo: string) {
    console.log('🛡️ 発注書バックアップ開始:', orderNo);

    try {
      // 発注書ID取得
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('order_no', orderNo)
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('発注書が見つかりません');

      const orderId = order.id;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // 関連データ取得
      const [txResult, itemResult, mvResult] = await Promise.all([
        // 分納データ
        supabase
          .from('transactions')
          .select('*')
          .eq('parent_order_id', orderId)
          .eq('transaction_type', 'purchase'),

        // 発注明細
        supabase
          .from('purchase_order_items')
          .select('*')
          .eq('purchase_order_id', orderId),

        // 在庫移動（分納関連のみ）
        supabase
          .from('inventory_movements')
          .select('*')
          .in('transaction_id',
            (await supabase
              .from('transactions')
              .select('id')
              .eq('parent_order_id', orderId)
              .eq('transaction_type', 'purchase')
            ).data?.map(t => t.id) || []
          )
      ]);

      if (txResult.error) throw txResult.error;
      if (itemResult.error) throw itemResult.error;
      if (mvResult.error) throw mvResult.error;

      const backupData = {
        backup_info: {
          created_at: new Date().toISOString(),
          order_no: orderNo,
          order_id: orderId,
          purpose: `${orderNo}分納データ修正前バックアップ`,
          timestamp
        },
        purchase_order: order,
        transactions: txResult.data,
        purchase_order_items: itemResult.data,
        inventory_movements: mvResult.data
      };

      // バックアップファイル作成
      const backupJson = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${orderNo}_backup_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ 発注書バックアップ完了:', link.download);

      return {
        success: true,
        filename: link.download,
        data: backupData
      };

    } catch (error) {
      console.error('❌ 発注書バックアップエラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー'
      };
    }
  }
}

// ブラウザコンソールから使用可能にする
if (typeof window !== 'undefined') {
  (window as any).createBackup = {
    // 全分納データバックアップ: createBackup.all()
    all: () => DatabaseBackup.createInstallmentBackup(),

    // 特定発注書バックアップ: createBackup.order('PO250917015')
    order: (orderNo: string) => DatabaseBackup.createOrderBackup(orderNo)
  };
}