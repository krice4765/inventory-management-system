import React, { useState } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../../hooks/useDarkMode';

interface TaxDisplayToggleProps {
  taxDisplayMode?: 'tax_included' | 'tax_excluded';
  onToggle?: (mode: 'tax_included' | 'tax_excluded') => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TaxDisplayToggle: React.FC<TaxDisplayToggleProps> = ({
  taxDisplayMode: propTaxDisplayMode,
  onToggle,
  className = '',
  size = 'md'
}) => {
  const { isDark } = useDarkMode();

  // 内部状態管理（propsが渡されない場合）
  const [internalMode, setInternalMode] = useState<'tax_included' | 'tax_excluded'>('tax_included');

  const taxDisplayMode = propTaxDisplayMode || internalMode;

  const handleToggle = (mode: 'tax_included' | 'tax_excluded') => {
    if (onToggle) {
      onToggle(mode);
    } else {
      setInternalMode(mode);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <span className={`text-sm font-medium ${
        isDark ? 'text-gray-300' : 'text-gray-600'
      }`}>
        表示:
      </span>

      <div className={`relative flex rounded-lg p-1 ${
        isDark ? 'bg-gray-700' : 'bg-gray-100'
      }`}>
        {/* 背景のアニメーション */}
        <motion.div
          className="absolute top-1 bottom-1 bg-blue-600 rounded-md"
          layout
          initial={false}
          animate={{
            left: taxDisplayMode === 'tax_included' ? '4px' : '50%',
            right: taxDisplayMode === 'tax_included' ? '50%' : '4px',
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30
          }}
        />

        {/* 税込ボタン */}
        <button
          onClick={() => handleToggle('tax_included')}
          className={`relative z-10 flex items-center space-x-1 rounded-md transition-colors ${
            sizeClasses[size]
          } ${
            taxDisplayMode === 'tax_included'
              ? 'text-white'
              : isDark
                ? 'text-gray-300 hover:text-white'
                : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className={iconSizes[size]} />
          <span>税込</span>
        </button>

        {/* 税抜ボタン */}
        <button
          onClick={() => handleToggle('tax_excluded')}
          className={`relative z-10 flex items-center space-x-1 rounded-md transition-colors ${
            sizeClasses[size]
          } ${
            taxDisplayMode === 'tax_excluded'
              ? 'text-white'
              : isDark
                ? 'text-gray-300 hover:text-white'
                : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calculator className={iconSizes[size]} />
          <span>税抜</span>
        </button>
      </div>

      {/* 表示モード説明（小さなヒント） */}
      <div className={`text-xs ${
        isDark ? 'text-gray-500' : 'text-gray-400'
      }`}>
        {taxDisplayMode === 'tax_included' ? '(税込価格)' : '(税抜価格)'}
      </div>
    </div>
  );
};