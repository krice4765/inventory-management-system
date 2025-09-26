import React from 'react';
import { Search, X } from 'lucide-react';

interface ProductSearchProps {
      value: string; onChange: (value: string) => void; placeholder?: string; className?: string; }

export const ProductSearch: React.FC<ProductSearchProps> = ({
  value,
  onChange,
  placeholder = "商品名または商品コードで検索...",
  className = "",
}) => {
  const handleClear = () => {
    onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
      className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus: outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            type="button"
      className="text-gray-400 hover: text-gray-600 focus:outline-none"onClick={handleClear}
            title="検索をクリア"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};