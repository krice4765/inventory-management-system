import { forwardRef } from 'react';
import { FieldError } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  error?: FieldError;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function FormField({ label, error, required, icon, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {icon && <span className="inline-block mr-2">{icon}</span>}
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error.message}
        </p>
      )}
    </div>
  );
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: FieldError;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-4 py-3 border rounded-xl transition-all ${
          error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
        } focus:ring-2 ${className}`}
        {...props}
      />
    );
  }
);

FormInput.displayName = 'FormInput';

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: FieldError;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full px-4 py-3 border rounded-xl transition-all ${
          error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
        } focus:ring-2 ${className}`}
        {...props}
      />
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: FieldError;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ error, options, placeholder, className = '', ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full px-4 py-3 border rounded-xl transition-all ${
          error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
        } focus:ring-2 ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

FormSelect.displayName = 'FormSelect';
