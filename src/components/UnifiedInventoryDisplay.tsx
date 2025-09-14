// 統合在庫履歴表示コンポーネント（Phase 2 本格実装）
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, Calendar, DollarSign, Hash, Truck, Database, Layers } from 'lucide-react';
import { useUnifiedInventoryMovements } from '../hooks/useUnifiedInventory';
import { MovementFilters, UnifiedInventoryRecord } from '../hooks/useOptimizedInventory';
import { ModernCard } from './ui/ModernCard';
import { useDarkMode } from '../hooks/useDarkMode';
import { AdvancedUnifiedFilters } from './AdvancedUnifiedFilters';

interface UnifiedInventoryDisplayProps {
  initialFilters?: MovementFilters;
  showTitle?: boolean;
  showFilters?: boolean;
}

export const UnifiedInventoryDisplay: React.FC<UnifiedInventoryDisplayProps> = ({
  initialFilters = {},
  showTitle = true,
  showFilters = true
}) => {
  const { isDark } = useDarkMode();
  const [filters, setFilters] = useState<MovementFilters>({
    recordType: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
    ...initialFilters
  });

  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const {
    data: unifiedData,
    isLoading,
    error,
    refetch
  } = useUnifiedInventoryMovements(filters);

  // 統計情報の計算
  const statistics = useMemo(() => {
    if (!unifiedData?.data) return null;

    const records = unifiedData.data;
    const inventoryMovements = records.filter(r => r.record_type === 'inventory_movement');
    const amountOnlyTransactions = records.filter(r => r.record_type === 'amount_only_transaction');

    const totalAmount = records.reduce((sum, record) => sum + (record.total_amount || 0), 0);
    const totalQuantity = inventoryMovements.reduce((sum, record) => sum + (record.quantity || 0), 0);

    return {
      totalRecords: records.length,
      inventoryMovements: inventoryMovements.length,
      amountOnlyTransactions: amountOnlyTransactions.length,
      totalAmount,
      totalQuantity,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0
    };
  }, [unifiedData]);

  // ページネーション処理
  const paginatedData = useMemo(() => {
    if (!unifiedData?.data) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return unifiedData.data.slice(startIndex, endIndex);
  }, [unifiedData?.data, currentPage, itemsPerPage]);

  const totalPages = Math.ceil((unifiedData?.data?.length || 0) / itemsPerPage);

  // フィルター変更時にページをリセット
  const handleFiltersChange = (newFilters: MovementFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  if (error) {
    return (
      <ModernCard className="p-6">
        <div className="text-center py-8">
          <Database className={`h-12 w-12 mx-auto mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            データ取得エラー
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
            統合在庫データの読み込みに失敗しました
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            再試行
          </button>
        </div>
      </ModernCard>
    );
  }

  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="flex items-center space-x-3">
          <Layers className={`h-6 w-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            在庫・分納 総合分析
          </h2>
        </div>
      )}

      {/* 統計情報カード */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <ModernCard className="p-4">
            <div className="text-center">
              <Database className={`h-6 w-6 mx-auto mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {statistics.totalRecords}
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                総レコード数
              </p>
            </div>
          </ModernCard>

          <ModernCard className="p-4">
            <div className="text-center">
              <Package className={`h-6 w-6 mx-auto mb-2 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {statistics.inventoryMovements}
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                在庫移動
              </p>
            </div>
          </ModernCard>

          <ModernCard className="p-4">
            <div className="text-center">
              <DollarSign className={`h-6 w-6 mx-auto mb-2 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {statistics.amountOnlyTransactions}
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                金額分納
              </p>
            </div>
          </ModernCard>

          <ModernCard className="p-4">
            <div className="text-center">
              <Hash className={`h-6 w-6 mx-auto mb-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {statistics.totalQuantity.toLocaleString()}
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                総移動数量
              </p>
            </div>
          </ModernCard>

          <ModernCard className="p-4">
            <div className="text-center">
              <DollarSign className={`h-6 w-6 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ¥{statistics.totalAmount.toLocaleString()}
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                総金額
              </p>
            </div>
          </ModernCard>

          <ModernCard className="p-4">
            <div className="text-center">
              <Truck className={`h-6 w-6 mx-auto mb-2 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ¥{Math.round(statistics.averageAmount).toLocaleString()}
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                平均金額
              </p>
            </div>
          </ModernCard>
        </div>
      )}

      {/* 高度フィルタリングコントロール */}
      {showFilters && (
        <AdvancedUnifiedFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          isLoading={isLoading}
          totalRecords={unifiedData?.data?.length || 0}
        />
      )}

      {/* データ表示エリア */}
      <ModernCard className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              統合データを読み込み中...
            </span>
          </div>
        ) : unifiedData?.data && unifiedData.data.length > 0 ? (
          <div className="space-y-3">
            <div className="mb-4">
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                在庫移動・分納記録一覧 ({unifiedData.data.length}件)
              </h3>

              {/* ページネーション - 上部 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    ページ {currentPage} / {totalPages} ({((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, unifiedData.data.length)} 件表示)
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        currentPage === 1
                          ? isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-100 border'
                      }`}
                    >
                      前へ
                    </button>

                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            pageNumber === currentPage
                              ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 border border-blue-200'
                              : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-100 border'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        currentPage === totalPages
                          ? isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-100 border'
                      }`}
                    >
                      次へ
                    </button>
                  </div>
                </div>
              )}
            </div>

            {paginatedData.map((record, index) => (
              <UnifiedRecordCard
                key={`${record.record_type}-${record.id}`}
                record={record}
                index={index}
                isDark={isDark}
              />
            ))}

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 mt-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentPage === 1
                      ? isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border'
                  }`}
                >
                  前へ
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 7) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 4) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNumber = totalPages - 6 + i;
                  } else {
                    pageNumber = currentPage - 3 + i;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        pageNumber === currentPage
                          ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 border border-blue-200'
                          : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentPage === totalPages
                      ? isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border'
                  }`}
                >
                  次へ
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className={`h-12 w-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
            <p className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              表示するデータがありません
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              フィルター条件を変更してお試しください
            </p>
          </div>
        )}
      </ModernCard>
    </div>
  );
};

// 個別レコードカードコンポーネント
const UnifiedRecordCard: React.FC<{
  record: UnifiedInventoryRecord;
  index: number;
  isDark: boolean;
}> = ({ record, index, isDark }) => {
  const isInventoryMovement = record.record_type === 'inventory_movement';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-4 border rounded-lg ${
        isDark
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      } hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* レコード種別アイコン */}
          <div className={`p-2 rounded-full ${
            isInventoryMovement
              ? isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700'
              : isDark ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-700'
          }`}>
            {isInventoryMovement ? (
              <Package className="h-4 w-4" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
          </div>

          {/* 商品情報 */}
          <div>
            <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {record.products?.product_name || '商品情報なし'}
            </h4>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {record.products?.product_code || 'N/A'}
            </p>
          </div>
        </div>

        {/* レコード情報 */}
        <div className="text-right">
          <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ¥{(record.total_amount || 0).toLocaleString()}
          </div>
          {isInventoryMovement && (
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              数量: {(record.quantity || 0).toLocaleString()}
            </div>
          )}
          {!isInventoryMovement && record.installment_no && (
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {record.installment_no}回目分納
            </div>
          )}
        </div>
      </div>

      {/* 詳細情報 */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <div className={`flex items-center space-x-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <span className={`inline-flex items-center px-2 py-1 rounded-full ${
              isInventoryMovement
                ? isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700'
                : isDark ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-700'
            }`}>
              {isInventoryMovement ? '在庫移動' : '金額分納'}
            </span>

            {record.memo && (
              <span
                title={record.memo}
                className="flex-1 min-w-0"
              >
                {(() => {
                  // Extract PO ID from memo
                  const poMatch = record.memo.match(/PO\d{9,}/);
                  const isInstallment = record.memo.startsWith('分納入力') || record.record_type === 'amount_only_transaction';

                  if (isInstallment && poMatch) {
                    // installment_noフィールドまたはmemoから回数を抽出
                    let installmentNumber = null;

                    if (record.installment_no) {
                      installmentNumber = String(record.installment_no);
                    } else {
                      // フォールバック: memoから回数を抽出（第X回の形式）
                      const installmentMatch = record.memo.match(/第(\d+)回/);
                      installmentNumber = installmentMatch ? installmentMatch[1] : null;
                    }

                    if (installmentNumber) {
                      return `📝 分納入力(${installmentNumber}回目) - ${poMatch[0]}`;
                    } else {
                      return `📝 分納入力 - ${poMatch[0]}`;
                    }
                  } else {
                    return `📝 ${record.memo.slice(0, 35)}${record.memo.length > 35 ? '...' : ''}`;
                  }
                })()}
              </span>
            )}
          </div>

          <div className={`flex items-center space-x-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(record.created_at).toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};