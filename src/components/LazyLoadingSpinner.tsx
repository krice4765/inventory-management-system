import React from 'react';

interface LazyLoadingSpinnerProps {
  message?: string;
}

export const LazyLoadingSpinner: React.FC<LazyLoadingSpinnerProps> = ({ 
  message = "ページを読み込み中..." 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
};

export default LazyLoadingSpinner;