import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectContextType {
      value: string; onValueChange: (value: string) => void; open: boolean; setOpen: (open: boolean) => void; }

const SelectContext = createContext<SelectContextType | undefined>(undefined);

interface SelectProps {
      value?: string; onValueChange?: (value: string) => void; children: React.ReactNode; }

export const Select: React.FC<SelectProps> = ({
  value = '',
  onValueChange,
  children
}) => {
  const [open, setOpen] = useState(false);

  const contextValue = {
    value,
    onValueChange: onValueChange || (() => {}),
    open,
    setOpen
  };

  return (
    <SelectContext.Provider value={contextValue}>
      {children}
    </SelectContext.Provider>
  );
};

interface SelectTriggerProps {
      children: React.ReactNode; className?: string; }

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
  children,
  className = ''
}) => {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error('SelectTrigger must be used within a Select');
  }

  const { open, setOpen } = context;

  const classes = `flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:ring-offset-slate-800 dark:placeholder:text-slate-400 dark:focus:ring-slate-300 ${className}`;

  return (
    <button
      type="button"
      className={classes}
      onClick={() => setOpen(!open)}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
};

interface SelectValueProps {
      placeholder?: string; }

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error('SelectValue must be used within a Select');
  }

  const { value } = context;

  return <span>{value || placeholder}</span>;
};

interface SelectContentProps {
      children: React.ReactNode; className?: string; }

export const SelectContent: React.FC<SelectContentProps> = ({
  children,
  className = ''
}) => {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error('SelectContent must be used within a Select');
  }

  const { open, setOpen } = context;

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => { const target = event.target as HTMLElement;
      if (!target.closest('[data-select-content]')) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, setOpen]);

  if (!open) return null;

  const classes = `relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 ${className}`;

  return (
    <div className="relative">
      <div
        data-select-content
        className={classes}
      >
        <div className="p-1">
          {children}
        </div>
      </div>
    </div>
  );
};

interface SelectItemProps {
      value: string; children: React.ReactNode; }

export const SelectItem: React.FC<SelectItemProps> = ({ value, children }) => {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error('SelectItem must be used within a Select');
  }

  const { onValueChange, setOpen } = context;

  const handleClick = () => {
    onValueChange(value);
    setOpen(false);
  };

  return (
    <div
      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-50"
      onClick={handleClick}
    >
      {children}
    </div>
  );
};