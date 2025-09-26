import React from 'react';
import { motion } from 'framer-motion';

interface ModernCardProps {
      children: React.ReactNode; className?: string; hover?: boolean; glass?: boolean; }

export function ModernCard({ children, className = '', hover = true, glass = false }: ModernCardProps) {
  const baseClasses = `
    rounded-xl border transition-all duration-300
    ${glass 
      ? 'bg-white/10 dark: bg-gray-900/10 backdrop-blur-md border-white/20'  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' }
    ${hover ? 'hover:shadow-lg hover:-translate-y-1' : ''}
  `;

  return (
    <motion.div
      className={`${baseClasses} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { scale: 1.02 } : undefined}
    >
      {children}
    </motion.div>
  );
}