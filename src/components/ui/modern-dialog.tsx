import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, Maximize2 } from 'lucide-react';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

interface ModernDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ModernDialog: React.FC<ModernDialogProps> = ({
  children,
  open = false,
  onOpenChange
}) => {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const contextValue = {
    open: isOpen,
    onOpenChange: handleOpenChange
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  );
};

interface ModernDialogContentProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  minimizable?: boolean;
}

export const ModernDialogContent: React.FC<ModernDialogContentProps> = ({
  children,
  className = '',
  size = 'md',
  closable = true,
  minimizable = false
}) => {
  const context = useContext(DialogContext);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!context) {
    throw new Error('ModernDialogContent must be used within a ModernDialog');
  }

  const { open, onOpenChange } = context;

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-md max-h-[90vh] w-full',
    md: 'max-w-lg max-h-[90vh] w-full',
    lg: 'max-w-2xl max-h-[90vh] w-full',
    xl: 'max-w-3xl max-h-[80vh] w-full sm:max-w-2xl md:max-w-3xl',
    full: 'max-w-6xl max-h-[90vh] w-full'
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  const dialogElement = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        {/* Modern Backdrop with Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Dialog Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{
            opacity: 1,
            scale: isMinimized ? 0.3 : 1,
            y: isMinimized ? window.innerHeight - 200 : 0
          }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30
          }}
          className={`
            relative w-full ${sizeClasses[size]} mx-auto bg-white dark:bg-gray-900
            rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700
            flex flex-col overflow-hidden
            ${className}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modern Header with Glass Effect */}
          <div className="relative bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-gray-800/50 dark:to-gray-700/50 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-red-500 opacity-60"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-60"></div>
                <div className="w-3 h-3 rounded-full bg-green-500 opacity-60"></div>
              </div>

              <div className="flex items-center space-x-2">
                {minimizable && (
                  <motion.button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-2 rounded-lg bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isMinimized ? (
                      <Maximize2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <Minimize2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    )}
                  </motion.button>
                )}

                {closable && (
                  <motion.button
                    onClick={() => onOpenChange(false)}
                    className="p-2 rounded-lg bg-red-50/80 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors group"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <motion.div
            animate={{ opacity: isMinimized ? 0 : 1, height: isMinimized ? 0 : 'auto' }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>

          {/* Modern Glass Effect Overlay */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(dialogElement, document.body);
};

interface ModernDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const ModernDialogHeader: React.FC<ModernDialogHeaderProps> = ({
  children,
  className = '',
  icon
}) => {
  return (
    <div className={`px-8 py-6 border-b border-gray-100 dark:border-gray-800 ${className}`}>
      <div className="flex items-center space-x-4">
        {icon && (
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg">
            {icon}
          </div>
        )}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

interface ModernDialogTitleProps {
  children: React.ReactNode;
  className?: string;
  subtitle?: string;
}

export const ModernDialogTitle: React.FC<ModernDialogTitleProps> = ({
  children,
  className = '',
  subtitle
}) => {
  return (
    <div>
      <h2 className={`text-2xl font-bold text-gray-900 dark:text-gray-100 ${className}`}>
        {children}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      )}
    </div>
  );
};

interface ModernDialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const ModernDialogBody: React.FC<ModernDialogBodyProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`flex-1 overflow-y-auto ${className}`}>
      {typeof children === 'string' ? (
        <div className="px-6 py-4 space-y-4 sm:px-8 sm:py-6 sm:space-y-6">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
};

interface ModernDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModernDialogFooter: React.FC<ModernDialogFooterProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`flex-shrink-0 px-8 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 sm:justify-end ${className}`}>
      {children}
    </div>
  );
};