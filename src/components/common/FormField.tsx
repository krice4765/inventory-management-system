import React from 'react';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface BaseFieldProps {
  readonly label: string;
  readonly required?: boolean;
  readonly error?: FieldError;
  readonly className?: string;
}

interface TextFieldProps extends BaseFieldProps {
  readonly placeholder?: string;
  readonly register: UseFormRegisterReturn;
}

export const TextField: React.FC<TextFieldProps> = React.memo(({
  label,
  required = false,
  error,
  placeholder,
  register,
  className = ''
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input 
      type="text"
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      placeholder={placeholder}
      {...register} 
    />
    {error && <p className="text-sm text-red-600 mt-1">{error.message}</p>}
  </div>
));

TextField.displayName = 'TextField';

interface CurrencyFieldProps extends BaseFieldProps {
  readonly register: UseFormRegisterReturn;
  readonly step?: string;
  readonly min?: string;
}

export const CurrencyField: React.FC<CurrencyFieldProps> = React.memo(({
  label,
  required = false,
  error,
  register,
  step = "0.01",
  min = "0",
  className = ''
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-2 text-gray-500">¥</span>
      <input 
        type="number" 
        step={step}
        min={min}
        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
        className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        placeholder="0.00"
        {...register} 
      />
    </div>
    {error && <p className="text-sm text-red-600 mt-1">{error.message}</p>}
  </div>
));

CurrencyField.displayName = 'CurrencyField';

interface NumberFieldProps extends BaseFieldProps {
  readonly register: UseFormRegisterReturn;
  readonly min?: string;
  readonly placeholder?: string;
}

export const NumberField: React.FC<NumberFieldProps> = React.memo(({
  label,
  required = false,
  error,
  register,
  min = "0",
  placeholder = "0",
  className = ''
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input 
      type="number"
      min={min}
      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      placeholder={placeholder}
      {...register} 
    />
    {error && <p className="text-sm text-red-600 mt-1">{error.message}</p>}
  </div>
));

NumberField.displayName = 'NumberField';

export interface SelectOption {
  readonly value: string | number;
  readonly label: string;
}

interface SelectFieldProps extends BaseFieldProps {
  readonly register: UseFormRegisterReturn;
  readonly options: readonly SelectOption[];
  readonly loading?: boolean;
  readonly placeholder?: string;
}

export const SelectField: React.FC<SelectFieldProps> = React.memo(({
  label,
  required = false,
  error,
  register,
  options,
  loading = false,
  placeholder = "選択してください",
  className = ''
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select 
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      {...register}
      disabled={loading}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {loading && <p className="text-sm text-gray-500 mt-1">読み込み中...</p>}
    {error && <p className="text-sm text-red-600 mt-1">{error.message}</p>}
  </div>
));

SelectField.displayName = 'SelectField';

interface TextAreaFieldProps extends BaseFieldProps {
  readonly register: UseFormRegisterReturn;
  readonly rows?: number;
  readonly placeholder?: string;
}

export const TextAreaField: React.FC<TextAreaFieldProps> = React.memo(({
  label,
  required = false,
  error,
  register,
  rows = 3,
  placeholder,
  className = ''
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea 
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      rows={rows} 
      placeholder={placeholder}
      {...register} 
    />
    {error && <p className="text-sm text-red-600 mt-1">{error.message}</p>}
  </div>
));

TextAreaField.displayName = 'TextAreaField';

interface URLFieldProps extends BaseFieldProps {
  readonly register: UseFormRegisterReturn;
  readonly placeholder?: string;
}

export const URLField: React.FC<URLFieldProps> = React.memo(({
  label,
  required = false,
  error,
  register,
  placeholder,
  className = ''
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input 
      type="url"
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      placeholder={placeholder}
      {...register} 
    />
    {error && <p className="text-sm text-red-600 mt-1">{error.message}</p>}
  </div>
));

URLField.displayName = 'URLField';