import React, { useEffect, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { useDeliveryModal } from '../stores/deliveryModal.store'
import { useOrderForDelivery } from '../hooks/useOrderForDelivery'
import { supabase } from '../lib/supabase'
import { useOrdersSync } from '../hooks/useOrdersSync'
import { processInventoryFromOrder } from '../utils/inventoryIntegration'
import { JapanesePDFGenerator } from '../utils/japanesePdfGenerator'
import type { DeliveryNotePDFData } from '../types/pdf'
import { DeliveryHistoryList } from './DeliveryHistoryList'

interface DeliveryFormData {
  amount: number
  deliveryType: 'amount_only' | 'amount_and_quantity'
  quantities?: { [productId: string]: number }
  memo?: string
  scheduled_delivery_date?: string
  delivery_reason?: string
}

interface OrderItem {
  product_id: string
  product_name: string
  product_code?: string
  quantity: number
  delivered_quantity?: number
  remaining_quantity?: number
  unit_price: number
  current_stock?: number
  stock_status?: 'sufficient' | 'insufficient' | 'out_of_stock'
  stock_shortage?: number
  has_stock_for_delivery?: boolean
  drawing_number?: string
}


// Yup schemaを削除し、React Hook Formのネイティブバリデーションを使用

export const DeliveryModal = () => {
  const { isOpen, selectedOrderId, deliveryType, close } = useDeliveryModal()
  const queryClient = useQueryClient()
  const { syncOrderData } = useOrdersSync()
  
  // 分納完了後の状態管理
  const [lastDeliveryResult, setLastDeliveryResult] = useState<{
    success: boolean;
    deliverySequence: number;
    deliveredAmount: number;
    transactionId: string;
  } | null>(null)
  
  const { data: orderData, isLoading, isError, error } = useOrderForDelivery(selectedOrderId)
  
  const form = useForm<DeliveryFormData>({
    defaultValues: { 
      amount: 0, 
      deliveryType: 'amount_only' as const,
      quantities: {},
      memo: '',
      scheduled_delivery_date: '',
      delivery_reason: ''
    },
    mode: 'onChange',
  })

  // 個数完了時の金額自動設定監視
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.startsWith('quantities.') && orderData?.items) {
        const quantities = value.quantities || {};
        const deliveryType = value.deliveryType;
        
        // 個数指定分納で、入力されたすべての商品が満了の場合
        if (deliveryType === 'amount_and_quantity') {
          // 入力された商品のみをチェック
          const inputItems = orderData.items.filter((item: OrderItem) => {
            const inputQuantity = quantities[item.product_id] || 0;
            return inputQuantity > 0;
          });

          // 入力されたすべての商品が満了の場合のみ自動設定
          const allInputItemsComplete = inputItems.length > 0 && inputItems.every((item: OrderItem) => {
            const inputQuantity = quantities[item.product_id] || 0;
            const remainingQuantity = item.remaining_quantity || item.quantity;
            return inputQuantity >= remainingQuantity;
          });

          // 入力されたすべての商品が満了の場合、金額を残額に自動設定
          if (allInputItemsComplete) {
            form.setValue('amount', orderData.remaining_amount);
            console.log('🎯 入力商品すべてが満了により金額を残額満了に自動設定:', orderData.remaining_amount);
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, orderData]);

  // 在庫不足チェック（全納登録用）
  const hasStockShortage = useMemo(() => {
    if (!orderData?.items || deliveryType !== 'full') {
      console.log('🔍 在庫不足チェック: スキップ', { hasItems: !!orderData?.items, deliveryType });
      return false;
    }
    
    const shortageItems = orderData.items.filter((item: OrderItem) => 
      item.stock_status === 'insufficient' || 
      item.stock_status === 'out_of_stock' ||
      ((item.current_stock || 0) < (item.remaining_quantity || item.quantity))
    );
    
    const hasShortage = shortageItems.length > 0;
    
    console.log('🔍 在庫不足チェック結果:', {
      deliveryType,
      totalItems: orderData.items.length,
      shortageItems: shortageItems.map(item => ({
        product_name: item.product_name,
        stock_status: item.stock_status,
        current_stock: item.current_stock,
        remaining_quantity: item.remaining_quantity,
        quantity: item.quantity,
        has_stock_for_delivery: item.has_stock_for_delivery,
        stock_shortage: item.stock_shortage
      })),
      hasShortage
    });
    
    return hasShortage;
  }, [orderData?.items, deliveryType]);

  // orderDataとdeliveryTypeが更新されたときにフォームを初期化
  useEffect(() => {
    if (orderData && deliveryType) {
      console.log('📋 分納モーダル データ確認:', {
        配送タイプ: deliveryType,
        発注額: orderData.ordered_amount,
        既納品: orderData.delivered_amount, 
        残額: orderData.remaining_amount,
        発注番号: orderData.order_no,
        在庫不足: hasStockShortage,
        商品明細: orderData.items.map(item => ({
          商品名: item.product_name,
          発注数量: item.quantity,
          分納済み: item.delivered_quantity || 0,
          残り数量: item.remaining_quantity || item.quantity,
          現在在庫: item.current_stock,
          在庫状況: item.stock_status
        }))
      });
      
      // 全納の場合は自動で金額を残額に設定
      if (deliveryType === 'full') {
        form.setValue('amount', orderData.remaining_amount);
        
        // 個数指定モードで全商品の残り数量を設定
        form.setValue('deliveryType', 'amount_and_quantity');
        const fullQuantities: { [productId: string]: number } = {};
        orderData.items.forEach((item: OrderItem) => {
          fullQuantities[item.product_id] = item.remaining_quantity || item.quantity;
        });
        form.setValue('quantities', fullQuantities);
      } else {
        // 分納の場合は金額のみモードでリセット
        form.setValue('amount', 0);
        form.setValue('deliveryType', 'amount_only');
        form.setValue('quantities', {});
      }
      
      // フォームエラーをクリアし、バリデーションを再実行
      form.clearErrors();
      form.trigger();
    }
  }, [orderData, deliveryType, form, hasStockShortage]);

  // 分納処理のMutation
  const deliveryMutation = useMutation({
    mutationFn: async (data: DeliveryFormData) => {
      if (!orderData) throw new Error('発注情報が取得できていません')
      
      // 🛡️ 納期予定日必須チェック
      if (!data.scheduled_delivery_date) {
        throw new Error(`${deliveryType === 'full' ? '全納' : '分納'}予定日を設定してください`)
      }
      
      // 🛡️ 在庫チェック（個数指定モードの場合）
      if (data.deliveryType === 'amount_and_quantity' && data.quantities) {
        const stockWarnings: string[] = []
        
        for (const [productId, requestedQuantity] of Object.entries(data.quantities)) {
          if (requestedQuantity > 0) {
            // 該当商品の現在在庫を取得
            const { data: productStock, error: stockError } = await supabase
              .from('products')
              .select('product_name, current_stock')
              .eq('id', productId)
              .single()
            
            if (stockError) {
              console.error('在庫チェックエラー:', stockError)
              continue
            }
            
            if (productStock && productStock.current_stock < requestedQuantity) {
              stockWarnings.push(
                `${productStock.product_name}: 在庫不足 (要求: ${requestedQuantity}, 在庫: ${productStock.current_stock})`
              )
            }
          }
        }
        
        // 在庫警告がある場合は確認を要求
        if (stockWarnings.length > 0) {
          const warningMessage = '⚠️ 在庫不足の商品があります:\n' + stockWarnings.join('\n') + '\n\n処理を続行しますか？'
          if (!window.confirm(warningMessage)) {
            throw new Error('在庫不足のため分納登録をキャンセルしました')
          }
        }
      }
      
      // 次の分納回数を計算（同じ発注書の分納件数 + 1）
      const { count: existingDeliveryCount, error: countError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('parent_order_id', orderData.purchase_order_id)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')

      if (countError) throw countError
      const nextSequence = (existingDeliveryCount ?? 0) + 1

      // 重複チェック: 同じタイミングでの分納登録を防止
      const now = new Date().toISOString();
      const { data: recentDeliveries } = await supabase
        .from('transactions')
        .select('id, total_amount, created_at')
        .eq('parent_order_id', orderData.purchase_order_id)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')
        .gte('created_at', new Date(Date.now() - 30000).toISOString()) // 30秒以内の登録をチェック
        .order('created_at', { ascending: false });

      // 同額・同時間の分納が存在する場合はスキップ
      const isDuplicate = recentDeliveries?.some(recent => 
        Math.abs(recent.total_amount - data.amount) < 1 &&
        new Date(recent.created_at).getTime() > Date.now() - 10000 // 10秒以内
      );

      if (isDuplicate) {
        console.warn('🚨 重複分納検出、処理をスキップ');
        throw new Error('同じ分納が既に登録されています');
      }

      // 分納記録を挿入
      const transactionId = crypto.randomUUID();
      console.log('💾 新規分納登録:', {
        transactionId,
        amount: data.amount,
        sequence: nextSequence,
        orderId: orderData.purchase_order_id
      });

      // 分納情報の詳細なメモを構築
      let detailedMemo = data.deliveryType === 'amount_and_quantity' 
        ? `分納入力 - ${orderData.order_no} (${nextSequence}回目) [個数指定]` 
        : `分納入力 - ${orderData.order_no} (${nextSequence}回目)`;
      
      if (data.delivery_reason) {
        const reasonLabels: { [key: string]: string } = {
          'partial_ready': '一部完成のため',
          'inventory_limit': '在庫制約のため',
          'customer_request': '顧客要望のため',
          'quality_check': '品質確認のため',
          'production_delay': '製造遅延のため',
          'shipping_arrangement': '出荷調整のため',
          'cash_flow': 'キャッシュフロー調整',
          'other': 'その他'
        };
        detailedMemo += ` | 理由: ${reasonLabels[data.delivery_reason] || data.delivery_reason}`;
      }
      
      if (data.memo) {
        detailedMemo += ` | ${data.memo}`;
      }

      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          id: transactionId,
          transaction_type: 'purchase',
          status: 'confirmed',
          partner_id: orderData.partner_id,
          total_amount: data.amount,
          parent_order_id: orderData.purchase_order_id,
          delivery_sequence: nextSequence,
          transaction_date: data.scheduled_delivery_date || new Date().toISOString().split('T')[0],
          memo: detailedMemo,
          created_at: now,
        })
      
      if (insertError) throw insertError
      
      // 🔄 分納完了時の在庫連動処理
      return { 
        deliveredAmount: data.amount, 
        memo: data.memo,
        deliveryType: data.deliveryType,
        quantities: data.quantities,
        transactionId: transactionId,
        deliverySequence: nextSequence
      };
    },
    onSuccess: async (result) => {
      const { deliveredAmount, memo, deliveryType, quantities, transactionId, deliverySequence } = result;
      try {
        // 🔄 在庫連動処理を実行
        if (orderData && selectedOrderId) {
          console.log('🔄 在庫連動処理開始:', {
            orderId: selectedOrderId,
            deliveredAmount,
            memo: memo || `分納入力 - ${orderData.order_no}`
          });

          const inventoryResult = await processInventoryFromOrder(
            selectedOrderId,
            deliveredAmount,
            memo || `分納入力 - ${orderData.order_no}`,
            deliveryType,
            quantities,
            transactionId,
            deliverySequence
          );

          if (!inventoryResult || !inventoryResult.success) {
            console.warn('⚠️ 在庫連動処理エラー:', inventoryResult?.error);
            // 発注明細が見つからない場合はエラーとして扱わない
            if (inventoryResult?.error && !inventoryResult.error.includes('発注明細が見つかりません')) {
              toast.error(`分納は登録されましたが、在庫更新に失敗しました: ${inventoryResult.error}`);
            }
          } else {
            console.log('✅ 在庫連動処理成功:', inventoryResult.message || 'OK');
          }
        }

        // キャッシュを強制的にクリアし、即座に最新データを取得
        console.log('🔄 分納完了後キャッシュ無効化開始');
        await queryClient.invalidateQueries(); // 全キャッシュクリア
        
        // 特定のキーを強制再フェッチ
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['orders'] }),
          queryClient.refetchQueries({ queryKey: ['orders-page'] }),
          queryClient.refetchQueries({ queryKey: ['order-stats'] }),
        ]);
        
        console.log('✅ 分納完了後キャッシュ無効化完了');
        
        // 分納完了情報を保存（PDF生成用）
        setLastDeliveryResult({
          success: true,
          deliverySequence: deliverySequence,
          deliveredAmount: deliveredAmount,
          transactionId: transactionId
        });

        // useOrdersSync が正常に動作する場合
        if (syncOrderData && typeof syncOrderData === 'function') {
          await syncOrderData('分納を登録し、在庫を更新しました');
        } else {
          toast.success(deliveryType === 'full' ? '全納を登録しました' : '分納を登録しました');
        }
        form.reset();
      } catch (error) {
        console.error('データ同期エラー:', error);
        // 登録は成功しているので、同期エラーでもUIは更新
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success(deliveryType === 'full' ? '全納を登録しました' : '分納を登録しました');
        form.reset();
      }
    },
    onError: (error: Error) => {
      toast.error(`登録に失敗しました: ${error?.message ?? '不明なエラー'}`)
    }
  })

  // 納品書PDF生成機能
  const generateDeliveryNotePDF = async () => {
    if (!orderData || !lastDeliveryResult) {
      toast.error('納品書生成に必要なデータがありません');
      return;
    }

    try {
      // 分納データから納品書データを構築
      const deliveryNoteData: DeliveryNotePDFData = {
        id: lastDeliveryResult.transactionId,
        delivery_no: `DEL-${orderData.order_no}-${lastDeliveryResult.deliverySequence}`,
        delivery_date: new Date().toISOString().split('T')[0],
        order_no: orderData.order_no,
        partner_name: orderData.partner_name,
        delivery_sequence: lastDeliveryResult.deliverySequence,
        total_amount: lastDeliveryResult.deliveredAmount,
        notes: form.getValues('memo') || '分納による納品',
        items: orderData.items.map((item: OrderItem) => ({
          product_name: item.product_name,
          product_code: item.product_code || '',
          drawing_number: item.drawing_number || '',
          delivered_quantity: item.quantity, // 簡略化: 実際には分納数量を計算
          unit_price: item.unit_price,
          total_amount: item.quantity * item.unit_price
        }))
      };

      console.log('🎨 納品書PDF生成開始:', deliveryNoteData);

      const result = await JapanesePDFGenerator.generateDeliveryNotePDF(deliveryNoteData);
      
      if (result.success && result.pdfBlob && result.filename) {
        JapanesePDFGenerator.downloadPDF(result.pdfBlob, result.filename);
        toast.success('納品書PDFを生成しました');
      } else {
        throw new Error(result.error || '納品書PDF生成に失敗');
      }
    } catch (error) {
      console.error('納品書PDF生成エラー:', error);
      toast.error(`納品書PDF生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  // クイック金額設定
  const setQuickAmount = (percentage: number) => {
    if (!orderData) return
    const amount = Math.floor(orderData.remaining_amount * percentage)
    form.setValue('amount', amount, { shouldValidate: true })
  }

  // モーダルを閉じる際の処理
  const handleClose = () => {
    setLastDeliveryResult(null);
    close();
  };

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-xl border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <span className="text-white text-lg">📦</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {deliveryType === 'full' ? '全納登録' : '分納登録'}
                </h3>
                <p className="text-sm text-gray-600">
                  {deliveryType === 'full' 
                    ? '残り全量の納品処理を行います' 
                    : '商品の分納処理を行います'
                  }
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="px-6 pb-6">
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">発注情報を読み込み中...</p>
            </div>
          )}
          
          {isError && (
            <div className="p-3 bg-red-50 text-red-700 rounded mb-4">
              発注情報の取得に失敗しました: {error?.message ?? '不明なエラー'}
            </div>
          )}
          
          {orderData && (
            <form onSubmit={form.handleSubmit((data) => deliveryMutation.mutate(data))}>
              {/* 発注情報表示 */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">
                  {orderData.order_no}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-700">仕入先:</span>
                    <p className="font-medium">{orderData.partner_name}</p>
                  </div>
                  <div>
                    <span className="text-blue-700">発注額:</span>
                    <p className="font-medium">¥{orderData.ordered_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-blue-700">既納品:</span>
                    <p className="font-medium">¥{orderData.delivered_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-blue-700 font-semibold">残額:</span>
                    <p className="font-bold text-lg">¥{orderData.remaining_amount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

            {/* 分納履歴表示 */}
            {orderData.delivered_amount > 0 && (
              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    📋 分納履歴
                    <span className="ml-2 text-sm text-gray-600">
                      （既納品: ¥{orderData.delivered_amount.toLocaleString()}）
                    </span>
                  </h4>
                  <DeliveryHistoryList orderId={selectedOrderId} />
                </div>
              </div>
            )}

            {/* クイック入力ボタン（分納時のみ表示） */}
            {deliveryType !== 'full' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  クイック入力
                </label>
                <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAmount(0.25)}
                  className="p-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  25%<br/>¥{Math.floor(orderData.remaining_amount * 0.25).toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(0.4)}
                  className="p-2 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                >
                  40%<br/>¥{Math.floor(orderData.remaining_amount * 0.4).toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(0.6)}
                  className="p-2 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                >
                  60%<br/>¥{Math.floor(orderData.remaining_amount * 0.6).toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(1.0)}
                  className="p-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                >
                  全額<br/>¥{orderData.remaining_amount.toLocaleString()}
                </button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                納品金額 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                disabled={(() => {
                  const deliveryType = form.watch('deliveryType');
                  if (deliveryType === 'amount_and_quantity' && orderData?.items) {
                    const quantities = form.watch('quantities') || {};
                    return orderData.items.every((item: OrderItem) => {
                      const inputQuantity = quantities[item.product_id] || 0;
                      const remainingQuantity = item.remaining_quantity || item.quantity;
                      return remainingQuantity === 0 || inputQuantity >= remainingQuantity;
                    });
                  }
                  return false;
                })()}
                {...form.register('amount', { 
                  valueAsNumber: true,
                  required: '納品金額は必須です',
                  min: { value: 1, message: '0より大きい値を入力してください' },
                  validate: (value) => {
                    if (!orderData) return true;
                    if (value > orderData.remaining_amount) {
                      return `残額¥${orderData.remaining_amount.toLocaleString()}を超えています`;
                    }

                    // 個数指定分納の場合の整合性チェック
                    const deliveryType = form.watch('deliveryType');
                    if (deliveryType === 'amount_and_quantity' && orderData.items) {
                      const quantities = form.watch('quantities') || {};
                      
                      // 個数指定モードでは少なくとも1つの商品に個数入力が必要
                      const hasAnyQuantityInput = Object.values(quantities).some(qty => (qty || 0) > 0);
                      if (!hasAnyQuantityInput) {
                        return '個数指定分納では、少なくとも1つの商品に個数を入力してください';
                      }
                      
                      // 入力された商品と、すべてが満了かチェック
                      const inputItems = orderData.items.filter((item: OrderItem) => {
                        const inputQuantity = quantities[item.product_id] || 0;
                        return inputQuantity > 0;
                      });
                      
                      // この分納で全商品の残り数量が0になる場合のみ金額満額を要求
                      const allRemainingQuantitiesWillBeZero = orderData.items.every((item: OrderItem) => {
                        const inputQuantity = quantities[item.product_id] || 0;
                        const remainingQuantity = item.remaining_quantity || item.quantity;
                        return remainingQuantity === 0 || inputQuantity >= remainingQuantity;
                      });

                      // 金額と個数の整合性チェック
                      const tolerance = 10; // 10円の許容誤差
                      const isAmountFull = Math.abs(value - orderData.remaining_amount) <= tolerance;

                      // ケース1: 全商品の残り数量が0になるのに金額が残額未満
                      if (allRemainingQuantitiesWillBeZero && !isAmountFull) {
                        return `全商品の残り数量が0になるため、金額は残額満了（¥${orderData.remaining_amount.toLocaleString()}）である必要があります`;
                      }
                      
                      // ケース2: 金額が満額なのに全商品の残り数量が0にならない（重要なバリデーション）
                      if (isAmountFull && !allRemainingQuantitiesWillBeZero) {
                        const incompleteItems = orderData.items.filter((item: OrderItem) => {
                          const inputQuantity = quantities[item.product_id] || 0;
                          const remainingQuantity = item.remaining_quantity || item.quantity;
                          return remainingQuantity > 0 && inputQuantity < remainingQuantity;
                        });

                        if (incompleteItems.length > 0) {
                          const incompleteNames = incompleteItems.map(item => item.product_name).join('、');
                          return `金額が残額満了の場合は、全商品の残り数量が0になる必要があります（未完了商品: ${incompleteNames}）`;
                        }
                      }
                    }

                    return true;
                  }
                })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  form.formState.errors.amount ? 'border-red-300' : 'border-gray-300'
                } ${(() => {
                  // 全納の場合は読み取り専用スタイル
                  if (deliveryType === 'full') {
                    return 'bg-green-50 text-green-800 border-green-300 font-semibold';
                  }
                  
                  // 個数指定モードでの自動設定時
                  const deliveryTypeValue = form.watch('deliveryType');
                  if (deliveryTypeValue === 'amount_and_quantity' && orderData?.items) {
                    const quantities = form.watch('quantities') || {};
                    const allWillBeZero = orderData.items.every((item: OrderItem) => {
                      const inputQuantity = quantities[item.product_id] || 0;
                      const remainingQuantity = item.remaining_quantity || item.quantity;
                      return remainingQuantity === 0 || inputQuantity >= remainingQuantity;
                    });
                    return allWillBeZero ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : '';
                  }
                  return '';
                })()}`}
                placeholder="0"
              />
              {form.formState.errors.amount && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.amount.message}
                </p>
              )}
              {(() => {
                // 全納の場合のメッセージ
                if (deliveryType === 'full') {
                  return (
                    <p className="mt-1 text-sm text-green-600 bg-green-50 p-2 rounded">
                      🎯 <strong>全納登録</strong>: 残り全量（¥{orderData.remaining_amount.toLocaleString()}）で自動設定されました
                    </p>
                  );
                }
                
                // 個数指定モードでの自動設定メッセージ
                const deliveryTypeValue = form.watch('deliveryType');
                if (deliveryTypeValue === 'amount_and_quantity' && orderData?.items) {
                  const quantities = form.watch('quantities') || {};
                  const allWillBeZero = orderData.items.every((item: OrderItem) => {
                    const inputQuantity = quantities[item.product_id] || 0;
                    const remainingQuantity = item.remaining_quantity || item.quantity;
                    return remainingQuantity === 0 || inputQuantity >= remainingQuantity;
                  });
                  if (allWillBeZero) {
                    return (
                      <p className="mt-1 text-sm text-green-600 bg-green-50 p-2 rounded">
                        ✅ 全商品の残り数量が0になるため、金額は残額満了（¥{orderData.remaining_amount.toLocaleString()}）に自動設定されました
                      </p>
                    );
                  }
                }
                return null;
              })()}

              {/* 金額満了時の整合性エラーの強調表示 */}
              {(() => {
                const enteredAmount = form.watch('amount') || 0;
                const remainingAmount = orderData?.remaining_amount || 0;
                const tolerance = 10;
                const isAmountFull = Math.abs(enteredAmount - remainingAmount) <= tolerance;

                if (enteredAmount > 0 && isAmountFull && orderData?.items) {
                  const quantities = form.watch('quantities') || {};
                  const allRemainingQuantitiesWillBeZero = orderData.items.every((item: OrderItem) => {
                    const inputQuantity = quantities[item.product_id] || 0;
                    const remainingQuantity = item.remaining_quantity || item.quantity;
                    return remainingQuantity === 0 || inputQuantity >= remainingQuantity;
                  });

                  if (!allRemainingQuantitiesWillBeZero) {
                    const incompleteItems = orderData.items.filter((item: OrderItem) => {
                      const inputQuantity = quantities[item.product_id] || 0;
                      const remainingQuantity = item.remaining_quantity || item.quantity;
                      return remainingQuantity > 0 && inputQuantity < remainingQuantity;
                    });

                    if (incompleteItems.length > 0) {
                      const incompleteNames = incompleteItems.map(item => item.product_name).join('、');
                      return (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <div className="text-red-500 mt-0.5">⚠️</div>
                            <div>
                              <p className="text-sm font-medium text-red-800">
                                金額満了時の整合性エラー
                              </p>
                              <p className="text-sm text-red-700 mt-1">
                                金額が残額満了の場合は、全商品の残り数量が0になる必要があります
                              </p>
                              <p className="text-xs text-red-600 mt-1">
                                未完了商品: {incompleteNames}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  }
                }
                return null;
              })()}
            </div>

            {/* 分納タイプ選択（全納の場合は非表示） */}
            {deliveryType !== 'full' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分納タイプ
                </label>
                <div className="space-y-2">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    {...form.register('deliveryType')}
                    value="amount_only"
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    金額のみで分納（在庫変動なし）
                  </span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    {...form.register('deliveryType')}
                    value="amount_and_quantity"
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    金額＋個数を指定して分納
                  </span>
                </label>
                </div>
              </div>
            )}

            {(deliveryType === 'full' || form.watch('deliveryType') === 'amount_and_quantity') && orderData.items && (
              <div className={`mb-4 border rounded-lg p-4 ${
                deliveryType === 'full' 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-blue-200 bg-blue-50'
              }`}>
                <h4 className={`font-medium mb-3 ${
                  deliveryType === 'full' ? 'text-green-900' : 'text-blue-900'
                }`}>
                  {deliveryType === 'full' ? '📋 発注内容確認' : '個数指定'}
                </h4>
                <div className="space-y-4">
                  {orderData.items.map((item: OrderItem) => (
                    <div key={item.product_id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-semibold text-gray-900 text-base">{item.product_name}</span>
                            {item.remaining_quantity === 0 && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                ✅ 完了
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            <span className="font-medium text-blue-700">{item.product_code}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* 数量情報を分かりやすく表示 */}
                      <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                        <div className="text-center p-3 bg-blue-100 border border-blue-200 rounded-lg">
                          <div className="text-blue-700 font-semibold mb-1">発注数量</div>
                          <div className="text-xl font-bold text-blue-900">{item.quantity}</div>
                        </div>
                        <div className="text-center p-3 bg-green-100 border border-green-200 rounded-lg">
                          <div className="text-green-700 font-semibold mb-1">分納済み</div>
                          <div className="text-xl font-bold text-green-900">{item.delivered_quantity || 0}</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-100 border border-yellow-200 rounded-lg">
                          <div className="text-yellow-700 font-semibold mb-1">残り数量</div>
                          <div className={`text-xl font-bold ${item.remaining_quantity === 0 ? 'text-green-900' : 'text-yellow-900'}`}>
                            {item.remaining_quantity || item.quantity}
                          </div>
                        </div>
                      </div>

                      {/* 在庫状況を独立したセクションに */}
                      {item.current_stock !== undefined && (
                        <div className="mb-3 p-3 border border-gray-300 bg-gray-100 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-800">在庫状況</span>
                            <div className="flex items-center space-x-2">
                              <span className={`px-3 py-1 text-sm rounded-lg font-semibold border ${
                                item.stock_status === 'sufficient' 
                                  ? 'bg-green-200 text-green-900 border-green-300' 
                                  : item.stock_status === 'insufficient'
                                  ? 'bg-yellow-200 text-yellow-900 border-yellow-300'
                                  : 'bg-red-200 text-red-900 border-red-300'
                              }`}>
                                📦 {item.current_stock}個
                              </span>
                              {item.stock_status === 'insufficient' && (
                                <span className="px-3 py-1 text-sm rounded-lg bg-red-200 text-red-900 border border-red-300 font-semibold">
                                  ⚠️ 不足{item.stock_shortage}個
                                </span>
                              )}
                              {item.stock_status === 'out_of_stock' && (
                                <span className="px-3 py-1 text-sm rounded-lg bg-red-200 text-red-900 border border-red-300 font-semibold">
                                  ❌ 在庫切れ
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {deliveryType === 'full' ? (
                        /* 全納時は確認表示のみ */
                        <div className="flex justify-end">
                          <span className="px-4 py-2 bg-green-200 text-green-900 border border-green-300 rounded-lg text-sm font-bold">
                            納品予定: {item.remaining_quantity || item.quantity}個
                          </span>
                        </div>
                      ) : (
                        /* 分納時は入力フィールド */
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">分納数量:</span>
                          <div className="w-32">
                            <input
                            type="number"
                            min="0"
                            max={Math.min(item.remaining_quantity || item.quantity, item.current_stock || 0)}
                            placeholder="0"
                            className={`w-full px-2 py-1 border rounded text-sm ${
                              item.stock_status === 'out_of_stock' 
                                ? 'border-red-300 bg-red-50 cursor-not-allowed' 
                                : item.stock_status === 'insufficient'
                                ? 'border-yellow-300 bg-yellow-50'
                                : 'border-gray-300'
                            }`}
                            disabled={item.stock_status === 'out_of_stock'}
                            title={item.stock_status === 'out_of_stock' ? '在庫切れのため入力不可' : ''}
                            {...form.register(`quantities.${item.product_id}`, { 
                              valueAsNumber: true,
                              min: { value: 0, message: '0以上の値を入力してください' },
                              validate: (value) => {
                                if (!value || value === 0) return true;
                                const maxQuantity = item.remaining_quantity || item.quantity;
                                const currentStock = item.current_stock || 0;
                                
                                if (value > maxQuantity) {
                                  return `残り数量${maxQuantity}を超えています`;
                                }
                                
                                // 在庫不足チェック
                                if (value > currentStock) {
                                  return `在庫不足: 現在在庫${currentStock}個（不足${value - currentStock}個）`;
                                }

                                // 個数入力の基本チェックのみ（上限と在庫のチェック）
                                // 金額との整合性チェックは amount フィールドで一元管理

                                return true;
                              }
                            })}
                            />
                            {/* バリデーションエラーメッセージ */}
                            {form.formState.errors.quantities?.[item.product_id] && (
                              <p className="mt-1 text-sm text-red-600">
                                {form.formState.errors.quantities[item.product_id]?.message}
                              </p>
                            )}
                          </div>
                          {/* リアルタイム在庫警告（分納時のみ） */}
                          {(() => {
                            const currentQuantity = form.watch(`quantities.${item.product_id}`) || 0;
                            const currentStock = item.current_stock || 0;
                            
                            if (currentQuantity > 0 && currentQuantity > currentStock) {
                              return (
                                <div className="mt-2 text-xs text-red-900 bg-red-200 px-3 py-2 rounded-lg border border-red-300 font-semibold">
                                  ⚠️ 在庫不足: 要求{currentQuantity} &gt; 在庫{currentStock}
                                </div>
                              );
                            } else if (currentQuantity > 0 && currentStock > 0) {
                              return (
                                <div className="mt-2 text-xs text-green-900 bg-green-200 px-3 py-2 rounded-lg border border-green-300 font-semibold">
                                  ✓ 入庫可能: {currentQuantity}個
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* 統合された注意事項・警告セクション */}
                <div className="mt-4 space-y-3">
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    💡 <strong>操作ガイド:</strong> 各商品の入庫数量を指定してください（0の場合は入庫されません）
                  </div>
                  
                  {deliveryType !== 'full' && (
                    <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                      📝 <strong>分納登録のポイント:</strong> 満了商品は自動的に除外されます。未満了商品のみでも分納登録が可能です
                    </div>
                  )}

                  {/* 在庫不足の統合警告 */}
                  {(() => {
                    const stockShortageItems = orderData.items?.filter((item: OrderItem) => 
                      item.stock_status === 'insufficient' || item.stock_status === 'out_of_stock'
                    ) || [];
                    
                    if (stockShortageItems.length === 0) return null;
                    
                    return (
                      <div className="text-xs text-red-600 bg-red-50 p-3 rounded border border-red-200">
                        <div className="font-bold mb-2">🚨 在庫不足警告 ({stockShortageItems.length}商品)</div>
                        <div className="text-xs">
                          以下の商品で在庫が不足しています。分納数量は現在在庫を超えて指定できません。
                        </div>
                        <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
                          {stockShortageItems.map((item: OrderItem) => (
                            <div key={item.product_id} className="text-xs bg-white p-1 rounded border-l-2 border-red-300">
                              <strong>{item.product_name}</strong>: 
                              {item.stock_status === 'out_of_stock' 
                                ? ' 在庫切れ' 
                                : ` 在庫${item.current_stock}個（不足${item.stock_shortage}個）`
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

            )}

            {/* 全納登録時の統合警告 */}
            {deliveryType === 'full' && hasStockShortage && orderData.items && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <div className="text-red-500 text-lg">🚫</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-red-800 mb-1">全納登録不可</div>
                    <div className="text-sm text-red-700 mb-2">
                      在庫不足のため全納登録ができません。在庫を確保後に再度実行してください。
                    </div>
                    <div className="text-xs text-red-600 bg-white p-2 rounded border border-red-200">
                      <strong>不足商品一覧:</strong>
                      {orderData.items
                        .filter((item: OrderItem) => 
                          item.stock_status === 'insufficient' || 
                          item.stock_status === 'out_of_stock' ||
                          ((item.current_stock || 0) < (item.remaining_quantity || item.quantity))
                        )
                        .map((item: OrderItem, index: number) => (
                          <span key={item.product_id}>
                            {index > 0 && '、'}
                            {item.product_name}（不足{item.stock_shortage}個）
                          </span>
                        ))
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 納期情報と分納予定日 */}
              <div className="mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                  📋 納期情報
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">発注書の納期:</span>
                    <p className="text-blue-700 font-semibold">
                      {orderData.delivery_deadline ? new Date(orderData.delivery_deadline).toLocaleDateString('ja-JP') : '設定なし'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">ステータス:</span>
                    <p className={`font-semibold ${
                      new Date(orderData.delivery_deadline || '') > new Date() 
                        ? 'text-green-700' 
                        : 'text-red-700'
                    }`}>
                      {new Date(orderData.delivery_deadline || '') > new Date() ? '✅ 期限内' : '⚠️ 期限超過'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 納期予定日 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 この{deliveryType === 'full' ? '全納' : '分納'}の予定日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    {...form.register('scheduled_delivery_date', { 
                      required: `${deliveryType === 'full' ? '全納' : '分納'}予定日を設定してください` 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().split('T')[0]} // 今日以降のみ選択可能
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    💡 発注書の納期と異なる日付を設定可能です
                  </p>
                  {form.watch('scheduled_delivery_date') && orderData.delivery_deadline && (
                    <div className="mt-2 text-xs">
                      {(() => {
                        const deliveryDate = new Date(form.watch('scheduled_delivery_date'));
                        const orderDeadline = new Date(orderData.delivery_deadline);
                        const isEarlier = deliveryDate < orderDeadline;
                        const isLater = deliveryDate > orderDeadline;
                        
                        if (isEarlier) {
                          return (
                            <div className="flex items-center space-x-1 text-green-600">
                              <span>✅</span>
                              <span>発注納期より早い予定です</span>
                            </div>
                          );
                        } else if (isLater) {
                          return (
                            <div className="flex items-center space-x-1 text-orange-600">
                              <span>⚠️</span>
                              <span>発注納期より遅い予定です</span>
                            </div>
                          );
                        } else {
                          return (
                            <div className="flex items-center space-x-1 text-blue-600">
                              <span>📅</span>
                              <span>発注納期と同じ日です</span>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>

              {/* 納品理由 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 {deliveryType === 'full' ? '全納理由' : '分納理由'}
                </label>
                <select
                  {...form.register('delivery_reason')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">理由を選択（任意）</option>
                  <option value="partial_ready">一部完成のため</option>
                  <option value="inventory_limit">在庫制約のため</option>
                  <option value="customer_request">顧客要望のため</option>
                  <option value="quality_check">品質確認のため</option>
                  <option value="production_delay">製造遅延のため</option>
                  <option value="shipping_arrangement">出荷調整のため</option>
                  <option value="cash_flow">キャッシュフロー調整</option>
                  <option value="other">その他</option>
                </select>
                </div>
              </div>
              </div>

              {/* 備考入力 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  備考
                </label>
                <textarea
                  rows={3}
                  {...form.register('memo', { 
                    maxLength: { value: 200, message: '備考は200文字以内で入力してください' } 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="備考を入力..."
                />
                {form.formState.errors.memo && (
                  <p className="mt-1 text-sm text-red-600">
                    {form.formState.errors.memo.message}
                  </p>
                )}
              </div>

              {/* 分納完了後のPDF生成ボタン */}
              {lastDeliveryResult && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-green-800">
                      <h4 className="font-medium">✅ {deliveryType === 'full' ? '全納登録完了' : '分納登録完了'}</h4>
                      <p className="text-sm">
                        第{lastDeliveryResult.deliverySequence}回目分納（¥{lastDeliveryResult.deliveredAmount.toLocaleString()}）
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generateDeliveryNotePDF}
                      className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    >
                      📄 納品書PDF
                    </button>
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {lastDeliveryResult ? '閉じる' : 'キャンセル'}
                </button>
                {!lastDeliveryResult && (
                  <div className="relative">
                    <button
                      type="submit"
                      disabled={deliveryMutation.isPending || !form.formState.isValid || (deliveryType === 'full' && hasStockShortage)}
                      className={`px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        deliveryType === 'full' && hasStockShortage
                          ? 'bg-red-400 text-white cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      title={(() => {
                        if (deliveryMutation.isPending) return '登録処理中...';
                        if (deliveryType === 'full' && hasStockShortage) return '在庫不足のため全納登録できません';
                        if (!form.formState.isValid) {
                          const errors = form.formState.errors;
                          if (errors.amount) return `金額エラー: ${errors.amount.message}`;
                          if (errors.scheduled_delivery_date) return '納期予定日を設定してください';
                          if (errors.memo) return `備考エラー: ${errors.memo.message}`;
                          // 個数入力のエラーチェック
                          const quantityErrors = Object.keys(errors).filter(key => key.startsWith('quantities.'));
                          if (quantityErrors.length > 0) return '商品の分納数量にエラーがあります';
                          return 'フォームに入力エラーがあります';
                        }
                        return '';
                      })()}
                    >
                      {deliveryMutation.isPending ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          登録中...
                        </span>
                      ) : (
                        deliveryType === 'full' ? '全納登録' : '分納登録'
                      )}
                    </button>
                  </div>
                )}

              </div>
            </form>
          )}
          
          {!isLoading && !isError && !orderData && (
            <div className="text-center py-8 text-gray-500">
              発注情報が見つかりません
            </div>
          )}
        </div>
      </div>
    </div>
  )
}