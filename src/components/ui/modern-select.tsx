import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ModernSelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outlined';
  className?: string;
}

export const ModernSelect: React.FC<ModernSelectProps> = ({
  label,
  placeholder = 'Select an option...',
  options,
  value,
  onChange,
  error,
  disabled = false,
  searchable = false,
  size = 'md',
  variant = 'default',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  const filteredOptions = searchable
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-3 text-base min-h-[44px]',
    lg: 'px-5 py-4 text-lg min-h-[52px]'
  };

  const variantClasses = {
    default: `
      border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900
      focus-within:border-blue-500 dark:focus-within:border-blue-400
      ${error ? 'border-red-500 dark:border-red-400' : ''}
    `,
    filled: `
      border-0 bg-gray-100 dark:bg-gray-800
      focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:ring-2 focus-within:ring-blue-500
      ${error ? 'ring-2 ring-red-500' : ''}
    `,
    outlined: `
      border-2 border-gray-300 dark:border-gray-600 bg-transparent
      focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-gray-900
      ${error ? 'border-red-500 dark:border-red-400' : ''}
    `
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0) {
          onChange?.(filteredOptions[focusedIndex].value);
          setIsOpen(false);
          setSearchTerm('');
        }
        event.preventDefault();
        break;
      case 'ArrowDown':
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        event.preventDefault();
        break;
      case 'ArrowUp':
        if (isOpen) {
          setFocusedIndex(prev =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          event.preventDefault();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  };

  const handleOptionClick = (option: SelectOption) => {
    if (option.disabled) return;
    onChange?.(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      {/* Label */}
      {label && (
        <motion.label
          initial={false}
          animate={{
            color: isOpen ? '#3B82F6' : error ? '#EF4444' : '#6B7280'
          }}
          className="block text-sm font-semibold mb-2 transition-colors duration-200"
        >
          {label}
        </motion.label>
      )}

      {/* Select Trigger */}
      <motion.div
        className={`
          relative w-full rounded-xl font-medium transition-all duration-200 cursor-pointer
          ${variantClasses[variant]} ${sizeClasses[size]}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg'}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        whileHover={!disabled ? { scale: 1.01 } : undefined}
        whileTap={!disabled ? { scale: 0.99 } : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {selectedOption?.icon && (
              <span className="flex-shrink-0">{selectedOption.icon}</span>
            )}
            <div className="flex-1 min-w-0">
              {selectedOption ? (
                <>
                  <div className="text-gray-900 dark:text-gray-100 font-medium">
                    {selectedOption.label}
                  </div>
                  {selectedOption.description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {selectedOption.description}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">
                  {placeholder}
                </span>
              )}
            </div>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </div>

        {/* Focus Ring */}
        <motion.div
          initial={false}
          animate={{
            opacity: isOpen ? 1 : 0,
            scale: isOpen ? 1 : 0.95
          }}
          className="absolute inset-0 rounded-xl bg-blue-500/10 pointer-events-none"
        />
      </motion.div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
          >
            {/* Search */}
            {searchable && (
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search options..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            {/* Options */}
            <div className="max-h-60 overflow-y-auto" ref={listRef}>
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <motion.div
                    key={option.value}
                    className={`
                      px-4 py-3 cursor-pointer transition-colors duration-150 flex items-center space-x-3
                      ${index === focusedIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                      ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                      ${option.value === value ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
                    `}
                    onClick={() => handleOptionClick(option)}
                    whileHover={!option.disabled ? { x: 4 } : undefined}
                  >
                    {option.icon && (
                      <span className="flex-shrink-0">{option.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {option.label}
                        </span>
                        {option.value === value && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      {option.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-2 mt-2"
          >
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};