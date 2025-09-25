import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Eye,
  Edit,
  Plus,
  Truck,
  BarChart3,
  FileText,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InventoryActionDropdownProps {
  productId: string;
  productName: string;
  currentStock: number;
  isDark: boolean;
  disabled?: boolean;
  className?: string;
}

export const InventoryActionDropdown: React.FC<InventoryActionDropdownProps> = ({
  productId,
  productName,
  currentStock,
  isDark,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 0922Youken.md準拠の操作メニュー項目
  const menuItems = [
    {
      icon: Edit,
      label: '在庫調整',
      onClick: () => {
        console.log(`在庫調整: ${productName} (現在庫: ${currentStock})`);
        setIsOpen(false);
      },
      description: '在庫数量の手動調整'
    },
    {
      icon: Plus,
      label: '発注作成',
      onClick: () => {
        console.log(`発注作成: ${productName} (${productId})`);
        setIsOpen(false);
      },
      description: 'この商品の発注書作成'
    },
    {
      icon: Truck,
      label: '出庫指示',
      onClick: () => {
        console.log(`出庫指示: ${productName}`);
        setIsOpen(false);
      },
      description: '出庫指示書の作成'
    },
    {
      icon: BarChart3,
      label: '履歴表示',
      onClick: () => {
        console.log(`履歴表示: ${productName}`);
        setIsOpen(false);
      },
      description: '在庫移動履歴の確認'
    },
    {
      icon: FileText,
      label: '移動履歴PDF',
      onClick: () => {
        console.log(`PDF出力: ${productName}`);
        setIsOpen(false);
      },
      description: 'PDF形式でエクスポート'
    },
    {
      icon: Settings,
      label: '商品設定',
      onClick: () => {
        console.log(`商品設定: ${productName}`);
        setIsOpen(false);
      },
      description: '商品マスター設定'
    }
  ];

  const handleMenuItemClick = (onClick: () => void) => {
    onClick();
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* 詳細ボタン + ドロップダウントリガー（0922Youken.md準拠） */}
      <div className="flex items-center space-x-2">
        {/* メイン詳細ボタン */}
        <button
          onClick={() => {
            console.log(`詳細表示: ${productName} (${productId})`);
          }}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          詳細
        </button>

        {/* ドロップダウントリガー */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className={`p-1.5 rounded-md transition-colors ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : isDark
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
          }`}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full mt-2 w-64 rounded-lg shadow-xl border z-50 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="py-2">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleMenuItemClick(item.onClick)}
                    className={`w-full px-4 py-3 text-left flex items-start space-x-3 transition-all duration-150 hover:scale-[1.02] ${
                      isDark
                        ? 'hover:bg-gray-700 text-gray-200 hover:shadow-md'
                        : 'hover:bg-blue-50 text-gray-700 hover:shadow-md'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      isDark ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      <Icon className="h-4 w-4 flex-shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm">{item.label}</span>
                        {item.isNew && (
                          <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded-full font-medium animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-1 leading-relaxed ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};