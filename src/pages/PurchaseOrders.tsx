// src/pages/PurchaseOrders.tsx - 動的カラム対応・編集機能追加版
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTransactionsByPartner } from '../hooks/useTransactionsByPartner';
import { PurchaseTransactionForm } from '../components/transactions/PurchaseTransactionForm';
import { PurchaseOrderForm } from '../components/transactions/PurchaseOrderForm';
import { getStatusDisplay, createDefaultFilters } from '../utils/format';
import type { TransactionFilters } from '../utils/format';
import { ModernStatsBar } from '../components/ModernStatsBar';
import { ModernAdvancedFilters } from '../components/ModernAdvancedFilters';
import { useDarkMode } from '../hooks/useDarkMode';
import { AddInstallmentModal } from '../components/AddInstallmentModal';
import { useAddInstallmentModal } from '../stores/addInstallmentModal.store';
import SearchableSelect from '../components/SearchableSelect';
import { motion } from 'framer-motion';
import { ModernCard } from '../components/ui/ModernCard';
import { ShoppingCart, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';

// 動的カラム表示のヘルパー関数
const getDisplayValue = (transaction: Record<string, unknown>, possibleKeys: string[], formatter?: (value: unknown) => string) => {
  for (const key of possibleKeys) {
    const value = transaction[key];
    if (value !== null && value !== undefined && value !== '') {
      return formatter ? formatter(value) : value;
    }
  }
  return '-';
};

// 🎯 display_name優先の商品表示関数
const getProductDisplayName = (transaction: Record<string, unknown>): string => {
  // 最優先: display_name（ビューからの集約結果）
  if (transaction.display_name && transaction.display_name !== 'N/A') {
    return String(transaction.display_name);
  }
  
  // 後方互換: item_summary
  if (transaction.item_summary && transaction.item_summary !== 'N/A') {
    return String(transaction.item_summary);
  }
  
  // 後方互換: product_name
  if (transaction.product_name && transaction.product_name !== 'N/A') {
    return String(transaction.product_name);
  }
  
  return 'N/A';
};

// 明細バッジ表示判定関数
const shouldShowItemBadge = (transaction: Record<string, unknown>): boolean => {
  return Number(transaction.item_count || 0) > 1;
};

const getItemBadgeText = (transaction: Record<string, unknown>): string => {
  return `📦 ${transaction.item_count}件の明細`;
};

// 🆕 分納回次バッジ表示関数（拡張版）
const getInstallmentBadge = (transaction: Record<string, unknown>): { text: string; className: string } | null => {
  const no = Number(transaction.installment_no || 0);
  if (no <= 1) return null;
  
  const colorMap: Record<number, string> = {
    2: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',      // 第2回: 琥珀色
    3: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400',         // 第3回: 青色
    4: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400',     // 第4回: 緑色
    5: 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400', // 第5回: 紫色
    6: 'bg-pink-100 dark:bg-pink-900/20 text-pink-800 dark:text-pink-400',         // 第6回: ピンク色
  };
  
  const className = colorMap[no] || 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400'; // 7回以降: グレー
  
  return {
    text: `第${no}回分納`,
    className
  };
};

const formatCurrency = (value: unknown) => {
  const num = Number(value);
  return isNaN(num) ? '-' : `¥${num.toLocaleString()}`;
};

const formatDate = (dateString: unknown) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return (
      <div>
        <div>{date.toLocaleDateString('ja-JP')}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {date.toLocaleTimeString('ja-JP')}
        </div>
      </div>
    );
  } catch {
    return '-';
  }
};

export default function PurchaseOrders() {
  const queryClient = useQueryClient();
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all-partners');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState('');
  const [filters, setFilters] = useState<TransactionFilters>(createDefaultFilters());
  const { open: openAddInstallmentModal } = useAddInstallmentModal();

  // モーダル管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Record<string, unknown> | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  // デバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchKeyword(searchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // 仕入先データの取得（「すべての仕入先」オプションを追加）
const { data: partners, isLoading: partnersLoading, error: partnersError } = useQuery({
  queryKey: ['partners'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('partners')
      .select('id, name')
      .order('name');
    
    if (error) throw new Error(error.message);
    
    // 🔥 「すべての仕入先」オプションを先頭に追加
    return [
      { id: 'all-partners', name: '🌟 すべての仕入先' },
      ...(data || [])
    ];
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
});

  // フィルター正規化（min>max等の補正）
  const normalizedFilters = useMemo(() => {
    const f = { ...filters };
    if (typeof f.minAmount === 'number' && typeof f.maxAmount === 'number' && f.minAmount > f.maxAmount) {
      [f.minAmount, f.maxAmount] = [f.maxAmount, f.minAmount];
    }
    if (f.startDate && f.endDate && f.startDate > f.endDate) {
      [f.startDate, f.endDate] = [f.endDate, f.startDate];
    }
    return f;
  }, [filters]);

  // 取引データの取得
  const { 
    data: transactions = [], 
    isLoading: transactionsLoading, 
    error: transactionsError
  } = useTransactionsByPartner(selectedPartnerId, debouncedSearchKeyword, normalizedFilters);

  const handleEditClick = (transaction: Record<string, unknown>) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
    queryClient.invalidateQueries({ queryKey: ['transactions', selectedPartnerId, debouncedSearchKeyword, normalizedFilters] });
  };

  const handleNewOrderSuccess = () => {
    setIsNewOrderModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['transactionsByPartner'] });
  };

  const handleResetFilters = () => {
    setFilters(createDefaultFilters());
    setSearchKeyword('');
    setSelectedPartnerId('all-partners');
  };

  // 統合エラーハンドリング
  const hasError = partnersError || transactionsError;
  
  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
        <div className="p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-6 backdrop-blur-md"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">データ取得エラー</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{partnersError?.message || transactionsError?.message}</p>
                </div>
                <div className="mt-4 flex space-x-3">
                  <motion.button
                    onClick={() => window.location.reload()}
                    className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    ページを再読み込み
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 space-y-8"
      >
        {/* ヘッダー */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 15 }}
              className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg"
            >
              <ShoppingCart className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                仕入管理システム
              </h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium">発注・仕入伝票の一元管理</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-4 h-4" />
              新規発注作成
            </motion.button>
            <motion.button
              onClick={toggleDarkMode}
              className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
            >
              {isDark ? '☀️' : '🌙'}
            </motion.button>
          </div>
        </motion.div>

        {/* フィルタセクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ModernCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <Search className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">検索・フィルター</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {/* 仕入先フィルター */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  仕入先でフィルター
                </label>
                <SearchableSelect
                  options={partners?.map(partner => ({
                    value: partner.id,
                    label: partner.name,
                    description: partner.id === 'all-partners' ? 'すべての仕入先を表示' : `仕入先ID: ${partner.id}`
                  })) || []}
                  value={selectedPartnerId}
                  onChange={setSelectedPartnerId}
                  placeholder={partnersLoading ? "ロード中..." : "仕入先を選択"}
                  darkMode={isDark}
                  className="w-full"
                />
              </div>
              
              {/* 検索フィールドの改善 */}
              <div>
                <label htmlFor="search" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  キーワード検索
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    placeholder="商品名、会社名、メモ、取引番号で検索..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 pl-11 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md font-medium"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
                {searchKeyword && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 font-medium"
                  >
                    「{searchKeyword}」で検索中...
                    <button
                      onClick={() => setSearchKeyword('')}
                      className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-semibold"
                    >
                      クリア
                    </button>
                  </motion.p>
                )}
              </div>
            </div>
          </ModernCard>
        </motion.div>

        {/* 新規高度フィルター */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ModernAdvancedFilters
            filters={filters}
            onFiltersChange={setFilters}
            onReset={handleResetFilters}
          />
        </motion.div>

        {/* 検索結果情報の表示 */}
        {searchKeyword && transactions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <ModernCard className="p-4">
              <div className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                🔍 「<strong className="text-blue-900 dark:text-blue-100">{searchKeyword}</strong>」の検索結果: <strong className="text-blue-900 dark:text-blue-100">{transactions.length}件</strong>
                {selectedPartnerId !== 'all-partners' && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    （{partners?.find(p => p.id === selectedPartnerId)?.name || '選択中の仕入先'}内）
                  </span>
                )}
              </div>
            </ModernCard>
          </motion.div>
        )}

        {/* 統計バー */}
        {!transactionsLoading && transactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ModernStatsBar items={transactions} />
          </motion.div>
        )}

        {/* データ表示セクション */}
        {transactionsLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center p-16"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4"
            />
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-medium text-gray-700 dark:text-gray-300"
            >
              取引データを読み込み中...
            </motion.span>
          </motion.div>
        ) : transactions.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ModernCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">会社名</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">商品/内容</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">担当者</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">数量</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">金額</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">ステータス</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">作成日</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">操作</th>
                    </tr>
</thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {transactions.map((transaction, index) => (
                      <motion.tr 
                        key={transaction.transaction_id} 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 transition-all duration-300"
                      >
      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
        {transaction.partner_name || 'N/A'}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
  <div className="max-w-xs">
    {/* 🎯 明細対応メイン商品名 */}
    <div className="font-medium">
      <Link 
        to={`/purchase-orders/${transaction.transaction_id}`}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
      >
        {getProductDisplayName(transaction)}
      </Link>
    </div>
    
    {/* 🎯 バッジセクション（明細件数 + 分納回次） */}
    <div className="flex flex-wrap gap-2 mt-1">
      {shouldShowItemBadge(transaction) && (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full">
          {getItemBadgeText(transaction)}
        </span>
      )}
      {getInstallmentBadge(transaction) && (
        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getInstallmentBadge(transaction)!.className}`}>
          {getInstallmentBadge(transaction)!.text}
        </span>
      )}
    </div>
    
    {/* 追加情報の表示（詳細が異なる場合のみ） */}
    {transaction.order_memo && 
     transaction.order_memo !== transaction.product_name && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={transaction.order_memo}>
        発注: {transaction.order_memo}
      </div>
    )}
    
    {transaction.transaction_memo && 
     transaction.transaction_memo !== transaction.product_name && 
     transaction.transaction_memo !== transaction.order_memo && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={transaction.transaction_memo}>
        メモ: {transaction.transaction_memo}
      </div>
    )}
  </div>
</td>
      {/* 担当者列を追加 */}
      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
        <div>
          <div className="font-medium">
            {transaction.order_manager_name || '—'}
          </div>
          {transaction.order_manager_department && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {transaction.order_manager_department}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
        {getDisplayValue(transaction, ['quantity'])}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
        {getDisplayValue(transaction, ['total_amount'], formatCurrency)}
      </td>
      <td className="px-6 py-4">
  {(() => {
    const statusMeta = getStatusDisplay(transaction.status);
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusMeta.className}`}>
        {statusMeta.label}
      </span>
    );
  })()}
</td>
      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        {getDisplayValue(transaction, ['created_at'], formatDate)}
      </td>
      <td className="px-6 py-4">
        <div className="flex space-x-2">
          <button 
            onClick={() => handleEditClick(transaction)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-xs"
            disabled={false}
            title="編集・確定"
          >
            編集・確定
          </button>
          {transaction.parent_order_id && (
            <button 
              onClick={() => openAddInstallmentModal(String(transaction.parent_order_id))}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium transition-colors text-xs"
              title="分納追加"
            >
              分納追加
            </button>
          )}
        </div>
      </td>
    </motion.tr>
                  ))}
                </tbody>
                </table>
              </div>
            </ModernCard>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ModernCard className="text-center py-16">
              <div className="flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="p-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full mb-6"
                >
                  <ShoppingCart className="w-16 h-16 text-gray-400 dark:text-gray-500" />
                </motion.div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">取引データがありません</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">新規発注を作成して取引を開始しましょう</p>
                <motion.button
                  onClick={() => setIsNewOrderModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-4 h-4" />
                  新規発注作成
                </motion.button>
              </div>
            </ModernCard>
          </motion.div>
        )}

        {/* モーダル */}
        {isModalOpen && selectedTransaction && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700"
            >
              <PurchaseTransactionForm
                parentOrderId={String(selectedTransaction.parent_order_id)}
                transactionId={String(selectedTransaction.transaction_id)}
                initialData={{
                  total_amount: Number(selectedTransaction.total_amount) || 0,
                  memo: String(selectedTransaction.memo || selectedTransaction.order_memo || ''),
                  transaction_date: String(selectedTransaction.transaction_date || '').split('T')[0],
                  status: String(selectedTransaction.status || 'draft'),
                  order_no: String(selectedTransaction.transaction_no || '')
                }}
                onSuccess={handleFormSuccess}
                onCancel={() => setIsModalOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}

        {/* 🆕 新規発注作成モーダル */}
        {isNewOrderModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setIsNewOrderModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    新規発注作成
                  </h2>
                </div>
                <motion.button
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>
              
              <PurchaseOrderForm
                onSuccess={handleNewOrderSuccess}
                onCancel={() => setIsNewOrderModalOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
        
        {/* 🆕 分納追加モーダル */}
        <AddInstallmentModal />
      </motion.div>
    </div>
  );
}
