import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ModernButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  gradient?: boolean;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  gradient = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = `
    relative inline-flex items-center justify-center font-medium transition-all duration-200
    rounded-xl border-0 focus:outline-none focus:ring-4 focus:ring-opacity-50
    active:scale-95 disabled:cursor-not-allowed disabled:opacity-60
    shadow-lg hover:shadow-xl transform hover:-translate-y-0.5
  `;

  const variantClasses = {
    primary: gradient
      ? `bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
         text-white focus:ring-blue-500 shadow-blue-500/25 hover:shadow-blue-500/40`
      : `bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500
         shadow-blue-500/25 hover:shadow-blue-500/40`,

    secondary: gradient
      ? `bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800
         text-white focus:ring-gray-500 shadow-gray-500/25 hover:shadow-gray-500/40`
      : `bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500
         shadow-gray-500/25 hover:shadow-gray-500/40`,

    danger: gradient
      ? `bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800
         text-white focus:ring-red-500 shadow-red-500/25 hover:shadow-red-500/40`
      : `bg-red-600 hover:bg-red-700 text-white focus:ring-red-500
         shadow-red-500/25 hover:shadow-red-500/40`,

    success: gradient
      ? `bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800
         text-white focus:ring-green-500 shadow-green-500/25 hover:shadow-green-500/40`
      : `bg-green-600 hover:bg-green-700 text-white focus:ring-green-500
         shadow-green-500/25 hover:shadow-green-500/40`,

    ghost: `bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700
           dark:text-gray-300 focus:ring-gray-500 shadow-none hover:shadow-md`,

    outline: `bg-transparent border-2 border-gray-300 hover:border-gray-400
             text-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500
             focus:ring-gray-500 shadow-none hover:shadow-md`
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm min-h-[36px]',
    md: 'px-6 py-3 text-base min-h-[44px]',
    lg: 'px-8 py-4 text-lg min-h-[52px]',
    xl: 'px-12 py-5 text-xl min-h-[60px]'
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      {...props}
    >
      {loading && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      )}

      {!loading && icon && iconPosition === 'left' && (
        <span className="mr-2">{icon}</span>
      )}

      <span className="relative">{children}</span>

      {!loading && icon && iconPosition === 'right' && (
        <span className="ml-2">{icon}</span>
      )}

      {/* Modern glow effect */}
      {variant !== 'ghost' && variant !== 'outline' && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200" />
      )}
    </motion.button>
  );
};