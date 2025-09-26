import React, { memo, useMemo } from 'react';
// Temporarily disabled virtualization due to rendering issues
// import { List } from 'react-window';
// import InfiniteLoader from 'react-window-infinite-loader';
import { Plus, Minus, Package, Calendar, Eye } from 'lucide-react';
import { InventoryMovement } from '../hooks/useOptimizedInventory';

interface VirtualizedInventoryTableProps {
      movements: InventoryMovement[]; hasNextPage: boolean; isNextPageLoading: boolean; loadNextPage: () => Promise<void>; onMovementClick: (movement: InventoryMovement) => void; isDark: boolean; }

// Temporarily disabled for standard scrolling implementation
// const ITEM_HEIGHT = 120; // 各行の高さ

interface MovementRowProps {
      index: number; style: React.CSSProperties; data: { movements: InventoryMovement[]; onMovementClick: (movement: InventoryMovement) => void; isDark: boolean; };
}

// メモ化された行コンポーネント
const MovementRow = memo<MovementRowProps>(({ index, style, data }) => {
  // より厳格なデータ検証
  if (!data || typeof data !== 'object') {
    return <div style={style || {}} className="px-4 py-3">データエラー</div>;
  }

  // 安全な分割代入でreact-windowのObject.values()エラーを防ぐ
  const movements = data.movements || [];
  const onMovementClick = data.onMovementClick || (() => {});
  const isDark = data.isDark || false;
  
  const movement = movements[index];
  const safeStyle = style || {};
  const darkMode = Boolean(isDark);
  const safeOnMovementClick = onMovementClick;

  if (!movement) {
    // ローディング行
    return (
      <div style={safeStyle} className="px-4 py-3">
        <div className={`animate-pulse rounded-lg border p-4 ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200' }`}>
          <div className="flex items-center space-x-4">
            <div className="h-4 w-4 rounded bg-gray-300"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-gray-300"></div>
              <div className="h-3 w-1/2 rounded bg-gray-300"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // productsデータのnullチェック
  if (!movement.products) {
    return (
      <div style={safeStyle} className="px-4 py-3">
        <div className={`animate-pulse rounded-lg border p-4 ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200' }`}>
          <div className="flex items-center space-x-4">
            <div className="h-4 w-4 rounded bg-gray-300"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-gray-300"></div>
              <div className="h-3 w-1/2 rounded bg-gray-300"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // transaction情報から分納回数を取得（優先）、フォールバックでmemoから解析
      const getDeliverySequence = (movement: any) => { // 1. transactionから直接取得（最優先）
    if (movement.transactions?.installment_no) {
      return movement.transactions.installment_no;
    }
    if (movement.transactions?.delivery_sequence) {
      return movement.transactions.delivery_sequence;
    }

      // 2. フォールバック: memoから解析 const match = movement.memo.match(/第(\d+)回/);
    if (match) {
      return parseInt(match[1]);
    }

      transaction_id: movement.transaction_id,
      transactions: movement.transactions,
      memo: movement.memo });
    return null;
  };

  const deliverySequence = getDeliverySequence(movement);
  const isDeliveryRelated = !!movement.transaction_id;
      const stockChange = movement.movement_type === 'in' ? movement.quantity : -movement.quantity; // 在庫変化の詳細計算
  const currentStock = movement.products?.current_stock || 0;
  const previousStock = currentStock - stockChange;
  const afterStock = currentStock;

  return (
    <div style={safeStyle} className="px-4 py-2">
      <div
      className={`rounded-lg border p-4 transition-all duration-200 cursor-pointer hover: shadow-md ${ darkMode 
      ? 'bg-gray-800 border-gray-700 hover: border-gray-600 hover:bg-gray-750'  : 'bg-gray-800/80 border-gray-200 hover:border-gray-300 hover:bg-gray-700/60' }`}
        onClick={() => safeOnMovementClick(movement)}
      >
        <div className="flex items-center justify-between">
          {/* 左側: 移動情報 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              {/* 移動タイプアイコン */}
              <div className={`flex-shrink-0 p-2 rounded-full ${
                movement.movement_type === 'in' 
                  ? 'bg-green-100 text-green-600' 
      : 'bg-red-100 text-red-600' }`}>
                {movement.movement_type === 'in' ? (
                  <Plus className="h-4 w-4" />
      ) : ( <Minus className="h-4 w-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* 商品名 */}
                <div className="flex items-center space-x-2">
                  <span className={`font-medium truncate ${
      darkMode ? 'text-white' : 'text-gray-900' }`}>
                    {movement.products.name}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
      darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600' }`}>
                    {movement.products.product_code}
                  </span>
                </div>

                {/* 数量と在庫変化 */}
                <div className="flex items-center space-x-4 mt-1">
                  <div className="flex items-center space-x-1">
                    <span className={`text-sm ${
      darkMode ? 'text-gray-300' : 'text-gray-600' }`}>
                      移動数量:
                    </span>
                    <span className={`font-medium ${
                      movement.movement_type === 'in' 
                        ? 'text-green-600' 
      : 'text-red-600' }`}>
                      {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className={`text-sm ${
      darkMode ? 'text-gray-300' : 'text-gray-600' }`}>
                      在庫変化:
                    </span>
                    <span className={`text-sm font-medium ${
      darkMode ? 'text-gray-300' : 'text-gray-600' }`}>
                      {previousStock}個
                    </span>
                    <span className={`text-sm ${
      darkMode ? 'text-gray-400' : 'text-gray-500' }`}>
                      →
                    </span>
                    <span className={`text-sm font-medium ${
      stockChange > 0 ? 'text-green-600' : 'text-red-600' }`}>
                      {afterStock}個 ({stockChange > 0 ? '+' : ''}{stockChange})
                    </span>
                  </div>
                </div>

                {/* 分納情報・メモ */}
                <div className="flex items-center space-x-4 mt-1">
                  {isDeliveryRelated && deliverySequence && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      第{deliverySequence}回
                    </span>
                  )}
                  
                  {movement.delivery_scheduled_date && (
                    <div className="flex items-center space-x-1 text-xs text-blue-600">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(movement.delivery_scheduled_date).toLocaleDateString('ja-JP')}</span>
                    </div>
                  )}
                  
                  {!isDeliveryRelated && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      手動入力
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 右側: 日時と分納回数 */}
          <div className="flex-shrink-0 text-right">
            {deliverySequence && (
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-1">
                第{deliverySequence}回分納
              </div>
            )}
            <div className={`text-xs mt-1 ${
      darkMode ? 'text-gray-400' : 'text-gray-500' }`}>
              {new Date(movement.created_at).toLocaleDateString('ja-JP')}
            </div>
            <div className={`text-xs ${
      darkMode ? 'text-gray-400' : 'text-gray-500' }`}>
              {new Date(movement.created_at).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
      minute: '2-digit' })}
            </div>
          </div>

          {/* 詳細ボタン */}
          <div className="flex-shrink-0 ml-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovementClick(movement);
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              詳細
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

MovementRow.displayName = 'MovementRow';

export const VirtualizedInventoryTable: React.FC<VirtualizedInventoryTableProps> = ({
  movements,
  hasNextPage,
  isNextPageLoading,
  loadNextPage,
  onMovementClick,
  isDark
}) => {
  // より厳格なprops検証
  const safeMovements = useMemo(() => {
    if (!movements || !Array.isArray(movements)) {
      return [];
    }
    return movements.filter(movement => movement && typeof movement === 'object');
  }, [movements]);

  const safeHasNextPage = hasNextPage ?? false;
  const safeIsNextPageLoading = isNextPageLoading ?? false;
  const safeLoadNextPage = loadNextPage || (() => Promise.resolve());
  const safeOnMovementClick = onMovementClick || (() => {});
  const darkMode = isDark ?? false;

  // データが存在しない場合のガード句
  if (!safeMovements || safeMovements.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className={`text-center ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
          <div className="animate-pulse">データを読み込み中...</div>
        </div>
      </div>
    );
  }

  // react-windowの問題を完全に回避するため、
  // 一時的に標準的なスクロール可能リストで代替
  return (
    <div className={`h-96 overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-900/95'}`}>
      <div className="space-y-2 p-4">
        {safeMovements.map((movement, index) => {
          if (!movement || !movement.products) {
            return (
              <div key={`loading-${index}`} className="px-4 py-3">
                <div className={`animate-pulse rounded-lg border p-4 ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200' }`}>
                  <div className="flex items-center space-x-4">
                    <div className="h-4 w-4 rounded bg-gray-300"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 rounded bg-gray-300"></div>
                      <div className="h-3 w-1/2 rounded bg-gray-300"></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // memoに含まれる分納回数を解析
      const parseDeliverySequence = (memo: string) => { const match = memo.match(/第(\\d+)回/);
      return match ? parseInt(match[1]) : null; };

          const deliverySequence = parseDeliverySequence(movement.memo);
          const isDeliveryRelated = !!movement.transaction_id;
      const stockChange = movement.movement_type === 'in' ? movement.quantity : -movement.quantity; // 在庫変化の詳細計算
          const currentStock = movement.products.current_stock;
          const previousStock = currentStock - stockChange;
          const afterStock = currentStock;

          return (
            <div key={movement.id} className="px-4 py-2">
              <div
      className={`rounded-lg border p-4 transition-all duration-200 cursor-pointer hover: shadow-md ${ darkMode 
      ? 'bg-gray-800 border-gray-700 hover: border-gray-600 hover:bg-gray-750'  : 'bg-gray-800/80 border-gray-200 hover:border-gray-300 hover:bg-gray-700/60' }`}
                onClick={() => safeOnMovementClick(movement)}
              >
                <div className="flex items-center justify-between">
                  {/* 左側: 移動情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      {/* 移動タイプアイコン */}
                      <div className={`flex-shrink-0 p-2 rounded-full ${
                        movement.movement_type === 'in' 
                          ? 'bg-green-100 text-green-600' 
      : 'bg-red-100 text-red-600' }`}>
                        {movement.movement_type === 'in' ? (
                          <Plus className="h-4 w-4" />
      ) : ( <Minus className="h-4 w-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* 商品名 */}
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium truncate ${
      darkMode ? 'text-white' : 'text-gray-900' }`}>
                            {movement.products.name}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
      darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600' }`}>
                            {movement.products.product_code}
                          </span>
                        </div>

                        {/* 数量と在庫変化 */}
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center space-x-1">
                            <span className={`text-sm ${
      darkMode ? 'text-gray-300' : 'text-gray-600' }`}>
                              移動数量:
                            </span>
                            <span className={`font-medium ${
                              movement.movement_type === 'in' 
                                ? 'text-green-600' 
      : 'text-red-600' }`}>
                              {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <span className={`text-sm ${
      darkMode ? 'text-gray-300' : 'text-gray-600' }`}>
                              在庫変化:
                            </span>
                            <span className={`text-sm font-medium ${
      darkMode ? 'text-gray-300' : 'text-gray-600' }`}>
                              {previousStock}個
                            </span>
                            <span className={`text-sm ${
      darkMode ? 'text-gray-400' : 'text-gray-500' }`}>
                              →
                            </span>
                            <span className={`text-sm font-medium ${
      stockChange > 0 ? 'text-green-600' : 'text-red-600' }`}>
                              {afterStock}個 ({stockChange > 0 ? '+' : ''}{stockChange})
                            </span>
                          </div>
                        </div>

                        {/* 分納情報・メモ */}
                        <div className="flex items-center space-x-4 mt-1">
                          {isDeliveryRelated && deliverySequence && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              第{deliverySequence}回
                            </span>
                          )}
                          
                          {movement.delivery_scheduled_date && (
                            <div className="flex items-center space-x-1 text-xs text-blue-600">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(movement.delivery_scheduled_date).toLocaleDateString('ja-JP')}</span>
                            </div>
                          )}
                          
                          {!isDeliveryRelated && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              手動入力
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右側: 分納情報と日時 */}
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-sm font-medium ${
      darkMode ? 'text-gray-300' : 'text-gray-700' }`}>
                      {(() => {
                        // 条件確認用ログ
                        console.log('🔍 条件確認:', {
                          movement_id: movement.id,
                          has_transaction_id: !!movement.transaction_id,
                          has_transaction_details: !!movement.transaction_details,
                          transaction_id: movement.transaction_id,
                          transaction_details_keys: movement.transaction_details ? Object.keys(movement.transaction_details) : null
                        });

                        if (movement.transaction_id && movement.transaction_details) {
                          // すべての取引データをログ出力（条件確認用）
                          console.log('🔍 すべての取引データ:', {
                            movement_id: movement.id,
                            transaction_id: movement.transaction_id,
                            transaction_details: movement.transaction_details,
                            movement_installment_no: movement.installment_no
                          });

                          // 詳細な取引情報がある場合
                          // 分納判定: delivery_sequence、installment_no、またはdelivery_typeがpartialの場合
                          const hasDeliverySequence = movement.transaction_details.delivery_sequence && movement.transaction_details.delivery_sequence > 0;
                          const hasInstallmentNo = movement.installment_no && movement.installment_no > 0;
                          const isPartialByType = movement.transaction_details.delivery_type === 'partial';
                          const isPartialDelivery = hasDeliverySequence || hasInstallmentNo || isPartialByType;
                          const isFullDelivery = movement.transaction_details.delivery_type === 'full' && !isPartialDelivery;

                          const badgeColor = isFullDelivery
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800';
                          const deliveryLabel = isFullDelivery ? '全納連動' : '分納連動';

                          // 発注書番号を取得（order_noを優先、フォールバックでpurchase_order_id）
                          const orderNo = movement.transaction_details.order_no || movement.transaction_details.purchase_order_id;

                          // 分納判定の詳細をログ出力
                          if (isPartialDelivery) {
                            console.log('🔍 分納判定詳細:', {
                              movement_id: movement.id,
                              hasDeliverySequence,
                              hasInstallmentNo,
                              isPartialByType,
                              delivery_sequence: movement.transaction_details.delivery_sequence,
                              installment_no: movement.installment_no,
                              delivery_type: movement.transaction_details.delivery_type,
                              order_no: movement.transaction_details.order_no,
                              orderNo: orderNo
                            });
                          }

                          return (
                            <div className="space-y-1">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${badgeColor}`}>
                                <Package className="w-3 h-3 mr-1" />
                                {deliveryLabel}
                              </span>
                              {orderNo && (
                                <div className="text-xs text-gray-600">
                                  #{orderNo}
                                </div>
                              )}
                            </div>
                          );
                        } else if (movement.transaction_id) {
                          // 取引IDはあるが詳細情報がない場合
                          return (
                            <div className="space-y-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                                <Package className="w-3 h-3 mr-1" />
                                納品連動 (詳細取得中)
                              </span>
                              <div className="text-xs text-gray-500">
                                ID: {movement.transaction_id}
                              </div>
                            </div>
                          );
                        } else {
                          // 手動入力
                          return (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                              手動入力
                            </span>
                          );
                        }
                      })()}
                    </div>
                    <div className={`text-xs mt-1 ${
      darkMode ? 'text-gray-400' : 'text-gray-500' }`}>
                      {new Date(movement.created_at).toLocaleDateString('ja-JP')}
                    </div>
                    <div className={`text-xs ${
      darkMode ? 'text-gray-400' : 'text-gray-500' }`}>
                      {new Date(movement.created_at).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
      minute: '2-digit' })}
                    </div>
                  </div>

                  {/* 詳細ボタン */}
                  <div className="flex-shrink-0 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMovementClick(movement);
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      詳細
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* 追加データ読み込みエリア */}
        {safeHasNextPage && (
          <div className="px-4 py-6 text-center">
            <button
              onClick={safeLoadNextPage}
              disabled={safeIsNextPageLoading}
              className={`px-4 py-2 rounded-lg ${
                safeIsNextPageLoading 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
      : darkMode  ? 'bg-blue-600 text-white hover: bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600' }`}
            >
              {safeIsNextPageLoading ? 'データ読み込み中...' : 'さらに読み込む'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualizedInventoryTable;