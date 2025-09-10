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
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">データ取得エラー</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{partnersError?.message || transactionsError?.message}</p>
              </div>
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded text-sm font-medium transition-colors"
                >
                  ページを再読み込み
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">仕入管理システム</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <span className="mr-2">➕</span>
              新規発注作成
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm hover:shadow-md"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

      {/* フィルタセクション */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="flex gap-4 items-center">
          {/* 仕入先フィルター */}
          <div>
            <label htmlFor="partner-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              仕入先でフィルター
            </label>
            <select
              id="partner-select"
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              disabled={partnersLoading}
            >
              {partnersLoading ? (
                <option>ロード中...</option>
              ) : (
                partners?.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))
              )}
            </select>
          </div>
          
          {/* 検索フィールドの改善 */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              検索
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                placeholder="商品名、会社名、メモ、取引番号で検索..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 pl-10 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            {searchKeyword && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                「{searchKeyword}」で検索中...
                <button
                  onClick={() => setSearchKeyword('')}
                  className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                >
                  クリア
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 新規高度フィルター */}
      <ModernAdvancedFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* 検索結果情報の表示 */}
      {searchKeyword && transactions && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            🔍 「<strong>{searchKeyword}</strong>」の検索結果: <strong>{transactions.length}件</strong>
            {selectedPartnerId !== 'all-partners' && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                （{partners?.find(p => p.id === selectedPartnerId)?.name || '選択中の仕入先'}内）
              </span>
            )}
          </div>
        </div>
      )}

      {/* 統計バー */}
      {!transactionsLoading && transactions.length > 0 && (
        <ModernStatsBar items={transactions} />
      )}

      {/* データ表示セクション */}
      {transactionsLoading ? (
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">取引データを読み込み中...</span>
        </div>
      ) : transactions.length > 0 ? (
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
  <tr>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">会社名</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">商品/内容</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">担当者</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">数量</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">金額</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ステータス</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">作成日</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
  </tr>
</thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
  {transactions.map((transaction) => (
    <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
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
    </tr>
  ))}
</tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">取引データがありません</h3>
        </div>
      )}

      {/* モーダル */}
      {isModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
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
          </div>
        </div>
      )}

      {/* 🆕 新規発注作成モーダル */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50" 
            onClick={() => setIsNewOrderModalOpen(false)} 
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">新規発注作成</h2>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl font-semibold"
              >
                ✕
              </button>
            </div>
            
            <PurchaseOrderForm
              onSuccess={handleNewOrderSuccess}
              onCancel={() => setIsNewOrderModalOpen(false)}
            />
          </div>
        </div>
      )}
      
      {/* 🆕 分納追加モーダル */}
      <AddInstallmentModal />
      </div>
    </div>
  );
}
