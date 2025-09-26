import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
      variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'; size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon'; children: React.ReactNode; }

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'default',
  className = '',
  children,
  ...props
}) => {
      const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible: outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300'; const variantClasses = {
    default: 'bg-slate-900 text-slate-50 hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90',
    destructive: 'bg-red-500 text-slate-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-slate-50 dark:hover:bg-red-900/90',
    outline: 'border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800 dark:hover:text-slate-50',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800/80',
    ghost: 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50',
      link: 'text-slate-900 underline-offset-4 hover:underline dark:text-slate-50' };

  const sizeClasses = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-12 rounded-md px-8',
    xl: 'h-14 rounded-md px-12 text-base',
      icon: 'h-10 w-10' };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};