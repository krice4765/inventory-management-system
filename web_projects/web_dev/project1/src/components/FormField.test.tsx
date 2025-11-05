import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField, FormInput, FormTextarea, FormSelect } from './FormField';

describe('FormField', () => {
  it('should render label and children', () => {
    render(
      <FormField label="Test Label">
        <input type="text" />
      </FormField>
    );

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should display required asterisk when required is true', () => {
    render(
      <FormField label="Required Field" required>
        <input type="text" />
      </FormField>
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    const TestIcon = () => <span data-testid="test-icon">📝</span>;

    render(
      <FormField label="Field with Icon" icon={<TestIcon />}>
        <input type="text" />
      </FormField>
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should display error message when error is provided', () => {
    const error = { type: 'required', message: 'This field is required' };

    render(
      <FormField label="Error Field" error={error}>
        <input type="text" />
      </FormField>
    );

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should render without error message when no error', () => {
    render(
      <FormField label="Normal Field">
        <input type="text" />
      </FormField>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('FormInput', () => {
  it('should render input with default styles', () => {
    render(<FormInput placeholder="Enter text" />);

    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('border-gray-300');
  });

  it('should apply error styles when error is provided', () => {
    const error = { type: 'required', message: 'Required' };
    render(<FormInput error={error} placeholder="Error input" />);

    const input = screen.getByPlaceholderText('Error input');
    expect(input).toHaveClass('border-red-300');
  });

  it('should forward ref correctly', () => {
    const ref = { current: null as HTMLInputElement | null };

    render(<FormInput ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('should accept additional props', () => {
    render(<FormInput type="email" name="email" disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toBeDisabled();
  });

  it('should merge custom className with default classes', () => {
    render(<FormInput className="custom-class" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
    expect(input).toHaveClass('w-full');
  });
});

describe('FormTextarea', () => {
  it('should render textarea with default styles', () => {
    render(<FormTextarea placeholder="Enter description" />);

    const textarea = screen.getByPlaceholderText('Enter description');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveClass('border-gray-300');
  });

  it('should apply error styles when error is provided', () => {
    const error = { type: 'minLength', message: 'Too short' };
    render(<FormTextarea error={error} placeholder="Error textarea" />);

    const textarea = screen.getByPlaceholderText('Error textarea');
    expect(textarea).toHaveClass('border-red-300');
  });

  it('should forward ref correctly', () => {
    const ref = { current: null as HTMLTextAreaElement | null };

    render(<FormTextarea ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('should accept additional props', () => {
    render(<FormTextarea rows={5} name="description" disabled />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('rows', '5');
    expect(textarea).toHaveAttribute('name', 'description');
    expect(textarea).toBeDisabled();
  });

  it('should merge custom className with default classes', () => {
    render(<FormTextarea className="custom-textarea" />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('custom-textarea');
    expect(textarea).toHaveClass('w-full');
  });
});

describe('FormSelect', () => {
  const mockOptions = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' },
  ];

  it('should render select with options', () => {
    render(<FormSelect options={mockOptions} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('should render placeholder option when provided', () => {
    render(<FormSelect options={mockOptions} placeholder="Select an option" />);

    expect(screen.getByText('Select an option')).toBeInTheDocument();
    const placeholderOption = screen.getByRole('option', { name: 'Select an option' }) as HTMLOptionElement;
    expect(placeholderOption.value).toBe('');
  });

  it('should not render placeholder when not provided', () => {
    render(<FormSelect options={mockOptions} />);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3); // Only mockOptions, no placeholder
  });

  it('should apply error styles when error is provided', () => {
    const error = { type: 'required', message: 'Please select' };
    render(<FormSelect options={mockOptions} error={error} />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('border-red-300');
  });

  it('should apply default styles when no error', () => {
    render(<FormSelect options={mockOptions} />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('border-gray-300');
  });

  it('should forward ref correctly', () => {
    const ref = { current: null as HTMLSelectElement | null };

    render(<FormSelect ref={ref} options={mockOptions} />);

    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('should accept additional props', () => {
    render(<FormSelect options={mockOptions} name="category" disabled />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('name', 'category');
    expect(select).toBeDisabled();
  });

  it('should merge custom className with default classes', () => {
    render(<FormSelect options={mockOptions} className="custom-select" />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('custom-select');
    expect(select).toHaveClass('w-full');
  });

  it('should render all options with correct values', () => {
    render(<FormSelect options={mockOptions} />);

    const option1 = screen.getByRole('option', { name: 'Option 1' }) as HTMLOptionElement;
    const option2 = screen.getByRole('option', { name: 'Option 2' }) as HTMLOptionElement;
    const option3 = screen.getByRole('option', { name: 'Option 3' }) as HTMLOptionElement;

    expect(option1.value).toBe('1');
    expect(option2.value).toBe('2');
    expect(option3.value).toBe('3');
  });
});
