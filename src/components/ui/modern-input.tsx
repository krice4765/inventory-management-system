import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface ModernInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
      label?: string; error?: string; success?: boolean; helperText?: string; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; size?: 'sm' | 'md' | 'lg'; variant?: 'default' | 'filled' | 'outlined'; }

export const ModernInput: React.FC<ModernInputProps> = ({
  label,
  error,
  success = false,
  helperText,
  leftIcon,
  rightIcon,
  size = 'md',
  variant = 'default',
  type = 'text',
  className = '',
  disabled = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-3 text-base min-h-[44px]',
      lg: 'px-5 py-4 text-lg min-h-[52px]' };

  const variantClasses = {
      default: `
        border-2 border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-900
        focus:border-blue-500 dark:focus:border-blue-400
        ${error ? 'border-red-500 dark:border-red-400' : ''}
        ${success ? 'border-green-500 dark:border-green-400' : ''}
      `,
      filled: `
        border-0
        bg-gray-100 dark:bg-gray-800
        focus:bg-white dark:focus:bg-gray-900
        focus:ring-2 focus:ring-blue-500
        ${error ? 'ring-2 ring-red-500' : ''}
        ${success ? 'ring-2 ring-green-500' : ''}
      `,
      outlined: `
        border-2 border-gray-300 dark:border-gray-600
        bg-transparent
        focus:border-blue-500 dark:focus:border-blue-400
        focus:bg-white dark:focus:bg-gray-900
        ${error ? 'border-red-500 dark:border-red-400' : ''}
        ${success ? 'border-green-500 dark:border-green-400' : ''}
      `
  };

  const baseClasses = `
    w-full rounded-xl font-medium transition-all duration-200
    text-gray-900 dark:text-gray-100
    placeholder-gray-500 dark:placeholder-gray-400
    focus:outline-none focus:ring-4 focus:ring-blue-500/20
    disabled:opacity-60 disabled:cursor-not-allowed
    ${leftIcon ? 'pl-12' : ''}
    ${rightIcon || type === 'password' ? 'pr-12' : ''}
  `;

      const inputType = type === 'password' && showPassword ? 'text' : type; return (
    <div className="space-y-2">
      {/* Label */}
      {label && (
        <motion.label
          initial={false}
          animate={{
            color: isFocused ? '#3B82F6' : error ? '#EF4444' : success ? '#10B981' : '#6B7280',
      scale: isFocused ? 1.02 : 1 }}
          className="block text-sm font-semibold transition-colors duration-200"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </motion.label>
      )}

      {/* Input Container */}
      <div className="relative group">
        {/* Left Icon */}
        {leftIcon && (
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200">{leftIcon}
          </div>
        )}

        {/* Input Field */}
        <motion.input
          type={inputType}
          className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          whileFocus={{ scale: 1.01 }}
          {...props}
        />

        {/* Right Icon / Password Toggle */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {success && <CheckCircle className="w-5 h-5 text-green-500" />}
          {error && <AlertCircle className="w-5 h-5 text-red-500" />}

          {type === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          )}

          {rightIcon && !success && !error && (
      <div className="text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200">{rightIcon}
            </div>
          )}
        </div>

        {/* Focus Ring Animation */}
        <motion.div
          initial={false}
          animate={{
            opacity: isFocused ? 1 : 0,
      scale: isFocused ? 1 : 0.95 }}
          className="absolute inset-0 rounded-xl bg-blue-500/10 pointer-events-none"
        />
      </div>

      {/* Helper Text / Error Message */}
      <AnimatePresence>
        {(error || helperText) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-2"
          >
            {error && (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</span>
              </>
            )}
            {!error && helperText && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{helperText}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};