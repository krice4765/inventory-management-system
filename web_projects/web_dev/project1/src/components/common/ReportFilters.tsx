import React, { memo, useCallback } from 'react';

interface DateRangeProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  startLabel?: string;
  endLabel?: string;
}

/**
 * Date range filter component
 * Memoized to prevent unnecessary re-renders
 */
export const DateRangeFilter = memo<DateRangeProps>(function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = '開始日',
  endLabel = '終了日',
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {startLabel}
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {endLabel}
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </>
  );
});

interface SelectFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

/**
 * Dropdown select filter component
 * Memoized to prevent unnecessary re-renders
 */
export const SelectFilter = memo<SelectFilterProps>(function SelectFilter({
  label,
  value,
  onChange,
  options,
  placeholder = 'すべて',
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
});

interface CheckboxFilterProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Checkbox filter component
 * Memoized to prevent unnecessary re-renders
 */
export const CheckboxFilter = memo<CheckboxFilterProps>(function CheckboxFilter({
  label,
  checked,
  onChange,
}) {
  return (
    <div className="flex items-end">
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span className="ml-2 text-sm text-gray-700">{label}</span>
      </label>
    </div>
  );
});

interface ReportFiltersProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

/**
 * Container component for report filters
 * Provides consistent styling and layout
 * Memoized to prevent unnecessary re-renders
 */
export const ReportFilters = memo<ReportFiltersProps>(function ReportFilters({ children, columns = 3 }) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className={`grid grid-cols-1 ${gridCols[columns]} gap-4`}>
        {children}
      </div>
    </div>
  );
});

export default ReportFilters;
