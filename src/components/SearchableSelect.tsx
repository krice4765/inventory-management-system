import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  darkMode?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "選択してください",
  required = false,
  className = "",
  darkMode = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 選択されたオプションを取得
  const selectedOption = options.find(option => option.value === value);

  // 検索でフィルタリングされたオプション
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 外部クリック時に閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ドロップダウンが開いた時に検索フィールドにフォーカス
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
    }
  };

  // ハイライトされた項目が見えるようにスクロール調整
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* メインの選択ボタン */}
      <div
        onClick={toggleDropdown}
        className={`
          flex items-center justify-between w-full px-3 py-2 border rounded-md cursor-pointer
          transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
          ${darkMode 
            ? 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700' 
            : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
          }
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
      >
        <span className={`flex-1 text-left ${
          selectedOption 
            ? darkMode ? 'text-white' : 'text-gray-900'
            : darkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        
        <div className="flex items-center space-x-2">
          {selectedOption && (
            <button
              onClick={handleClear}
              className={`p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded ${
                darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
              }`}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown 
            className={`w-4 h-4 transition-transform ${
              isOpen ? 'rotate-180' : ''
            } ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
          />
        </div>
      </div>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className={`
          absolute z-50 w-full mt-1 border rounded-md shadow-lg max-h-60 overflow-hidden
          ${darkMode 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-300'
          }
        `}>
          {/* 検索フィールド */}
          <div className={`sticky top-0 p-3 border-b ${
            darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
          }`}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="検索..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(-1);
                }}
                className={`
                  w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }
                `}
              />
            </div>
          </div>

          {/* オプションリスト */}
          <div 
            ref={dropdownRef}
            className="max-h-48 overflow-y-auto"
          >
            {filteredOptions.length === 0 ? (
              <div className={`px-3 py-2 text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                該当する項目がありません
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`
                    px-3 py-2 cursor-pointer transition-colors duration-150
                    ${index === highlightedIndex 
                      ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-900'
                      : darkMode 
                        ? 'text-white hover:bg-gray-700' 
                        : 'text-gray-900 hover:bg-gray-100'
                    }
                  `}
                >
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div className={`text-xs mt-1 ${
                      index === highlightedIndex 
                        ? darkMode ? 'text-blue-200' : 'text-blue-700'
                        : darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {option.description}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 隠しinput（フォームバリデーション用） */}
      {required && (
        <input
          type="hidden"
          value={value}
          required
          onChange={() => {}} // 制御されているのでwarning回避
        />
      )}
    </div>
  );
}