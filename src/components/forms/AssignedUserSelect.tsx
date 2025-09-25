import React, { useState, useMemo } from 'react';
import { ChevronDown, User, AlertCircle, Search, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useAssignedUsers, AssignedUserUtils, type AssignedUserOption } from '../../hooks/useAssignedUsers';

interface AssignedUserSelectProps {
  value?: string;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  showDepartment?: boolean;
  allowClear?: boolean;
}

export const AssignedUserSelect: React.FC<AssignedUserSelectProps> = ({
  value,
  onChange,
  placeholder = '担当者を選択してください',
  required = false,
  disabled = false,
  error,
  className = '',
  showDepartment = true,
  allowClear = false,
}) => {
  const { isDark } = useDarkMode();
  const { activeUserOptions, isLoading, error: fetchError } = useAssignedUsers();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 選択された担当者の情報
  const selectedUser = useMemo(() => {
    return activeUserOptions.find(option => option.value === value);
  }, [activeUserOptions, value]);

  // 検索フィルタリング
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return activeUserOptions;

    const term = searchTerm.toLowerCase();
    return activeUserOptions.filter(option =>
      option.label.toLowerCase().includes(term) ||
      (option.department && option.department.toLowerCase().includes(term)) ||
      (option.description && option.description.toLowerCase().includes(term))
    );
  }, [activeUserOptions, searchTerm]);

  // 選択処理
  const handleSelect = (userId: string | null) => {
    onChange(userId);
    setIsOpen(false);
    setSearchTerm('');
  };

  // クリア処理
  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelect(null);
  };

  // エラー状態の判定
  const hasError = !!error || !!fetchError;
  const errorMessage = error || (fetchError ? 'データの取得に失敗しました' : '');

  return (
    <div className={`relative ${className}`}>
      {/* メインの選択ボックス */}
      <div
        onClick={disabled ? undefined : () => setIsOpen(!isOpen)}
        className={`
          relative w-full px-3 py-2 text-left border rounded-lg transition-colors cursor-pointer
          ${disabled
            ? 'bg-gray-100 cursor-not-allowed'
            : isDark
              ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
              : 'bg-white border-gray-300 hover:border-gray-400'
          }
          ${hasError
            ? 'border-red-500 ring-1 ring-red-500'
            : isOpen
              ? 'border-blue-500 ring-1 ring-blue-500'
              : ''
          }
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <User className={`h-4 w-4 flex-shrink-0 ${
              hasError ? 'text-red-500' : 'text-gray-400'
            }`} />

            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    読み込み中...
                  </span>
                </div>
              ) : selectedUser ? (
                <div>
                  <div className={`font-medium truncate ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedUser.label}
                  </div>
                  {showDepartment && selectedUser.department && (
                    <div className={`text-xs truncate ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {selectedUser.department}
                    </div>
                  )}
                </div>
              ) : (
                <span className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {placeholder}
                  {required && <span className="text-red-500 ml-1">*</span>}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {/* クリアボタン */}
            {allowClear && selectedUser && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="選択をクリア"
              >
                ×
              </button>
            )}

            {/* 展開アイコン */}
            <ChevronDown className={`h-4 w-4 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            } ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        </div>
      </div>

      {/* エラーメッセージ */}
      {hasError && (
        <div className="flex items-center space-x-1 mt-1">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-500">{errorMessage}</span>
        </div>
      )}

      {/* ドロップダウンリスト */}
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`
              absolute z-50 w-full mt-1 rounded-lg border shadow-lg
              ${isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-300'
              }
            `}
          >
            {/* 検索ボックス */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="担当者を検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`
                    w-full pl-10 pr-4 py-2 text-sm border rounded-md
                    ${isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }
                    focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                  `}
                />
              </div>
            </div>

            {/* オプションリスト */}
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className={`px-3 py-4 text-center text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {searchTerm ? '該当する担当者が見つかりません' : '利用可能な担当者がいません'}
                </div>
              ) : (
                <div className="py-1">
                  {filteredOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(option.value);
                      }}
                      className={`
                        w-full px-3 py-2 text-left transition-colors
                        ${option.value === value
                          ? isDark
                            ? 'bg-blue-900 text-blue-200'
                            : 'bg-blue-50 text-blue-900'
                          : isDark
                            ? 'hover:bg-gray-700 text-gray-300'
                            : 'hover:bg-gray-50 text-gray-900'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium truncate">
                              {option.label}
                            </span>
                            {option.value === value && (
                              <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          {showDepartment && option.department && (
                            <div className={`text-xs mt-1 ${
                              option.value === value
                                ? isDark ? 'text-blue-300' : 'text-blue-700'
                                : isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {option.department}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* フッター情報 */}
            {activeUserOptions.length > 0 && (
              <div className={`px-3 py-2 text-xs border-t ${
                isDark
                  ? 'border-gray-700 text-gray-400'
                  : 'border-gray-200 text-gray-500'
              }`}>
                {filteredOptions.length} / {activeUserOptions.length} 人の担当者
                {required && ' （※必須項目）'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* フォーカス時のクリックアウェイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// バリデーション付きの担当者選択コンポーネント
interface ValidatedAssignedUserSelectProps extends AssignedUserSelectProps {
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const ValidatedAssignedUserSelect: React.FC<ValidatedAssignedUserSelectProps> = ({
  onValidationChange,
  ...props
}) => {
  const { users } = useAssignedUsers();
  const [validationError, setValidationError] = useState<string | undefined>();

  // バリデーション処理
  const handleChange = (userId: string | null) => {
    const validation = AssignedUserUtils.validateAssignedUser(userId, users);

    setValidationError(validation.error);

    if (onValidationChange) {
      onValidationChange(validation.isValid, validation.error);
    }

    props.onChange(userId);
  };

  return (
    <AssignedUserSelect
      {...props}
      onChange={handleChange}
      error={validationError || props.error}
    />
  );
};