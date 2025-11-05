import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayPicker } from './DayPicker';

describe('DayPicker', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本表示', () => {
    it('should render with placeholder when no value selected', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      expect(screen.getByText('選択してください')).toBeInTheDocument();
    });

    it('should display selected day when value is provided', () => {
      render(<DayPicker value={15} onChange={mockOnChange} />);

      expect(screen.getByText('15日')).toBeInTheDocument();
    });

    it('should display "月末" when value is 0', () => {
      render(<DayPicker value={0} onChange={mockOnChange} />);

      expect(screen.getByText('月末')).toBeInTheDocument();
    });

    it('should apply default border style when no error', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      const button = screen.getByText('選択してください').closest('button');
      expect(button).toHaveClass('border-gray-300');
    });

    it('should apply error border style when error is provided', () => {
      const error = { type: 'required', message: 'Required' };
      render(<DayPicker value={null} onChange={mockOnChange} error={error} />);

      const button = screen.getByText('選択してください').closest('button');
      expect(button).toHaveClass('border-red-300');
    });
  });

  describe('ドロップダウンの開閉', () => {
    it('should not show calendar by default', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      expect(screen.queryByText('締日・支払日を選択')).not.toBeInTheDocument();
    });

    it('should show calendar when button is clicked', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      const button = screen.getByText('選択してください');
      fireEvent.click(button);

      expect(screen.getByText('締日・支払日を選択')).toBeInTheDocument();
      expect(screen.getByText('毎月の繰り返し設定です')).toBeInTheDocument();
    });

    it('should toggle calendar visibility on button click', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      const button = screen.getByText('選択してください');

      // Open
      fireEvent.click(button);
      expect(screen.getByText('締日・支払日を選択')).toBeInTheDocument();

      // Close
      fireEvent.click(button);
      expect(screen.queryByText('締日・支払日を選択')).not.toBeInTheDocument();

      // Open again
      fireEvent.click(button);
      expect(screen.getByText('締日・支払日を選択')).toBeInTheDocument();
    });

    it('should close calendar when overlay is clicked', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      // Open calendar
      const button = screen.getByText('選択してください');
      fireEvent.click(button);
      expect(screen.getByText('締日・支払日を選択')).toBeInTheDocument();

      // Click overlay to close
      const overlay = document.querySelector('.fixed.inset-0') as HTMLElement;
      fireEvent.click(overlay);

      expect(screen.queryByText('締日・支払日を選択')).not.toBeInTheDocument();
    });
  });

  describe('日付選択', () => {
    it('should render all 31 days in calendar', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('選択してください'));

      // Check all days are present
      for (let day = 1; day <= 31; day++) {
        const dayButton = screen.getAllByText(day.toString()).find(el =>
          el.tagName === 'BUTTON' && el.classList.contains('w-8')
        );
        expect(dayButton).toBeInTheDocument();
      }
    });

    it('should call onChange with selected day number', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('選択してください'));

      // Click day 15
      const day15Buttons = screen.getAllByText('15');
      const day15Button = day15Buttons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('w-8')
      );
      fireEvent.click(day15Button!);

      expect(mockOnChange).toHaveBeenCalledWith(15);
    });

    it('should close calendar after selecting a day', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('選択してください'));
      expect(screen.getByText('締日・支払日を選択')).toBeInTheDocument();

      // Select day 20
      const day20Buttons = screen.getAllByText('20');
      const day20Button = day20Buttons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('w-8')
      );
      fireEvent.click(day20Button!);

      expect(screen.queryByText('締日・支払日を選択')).not.toBeInTheDocument();
    });

    it('should render "月末" button in calendar', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('選択してください'));

      // Check "月末" button exists
      const endOfMonthButtons = screen.getAllByText('月末');
      const calendarEndOfMonthButton = endOfMonthButtons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('mb-3')
      );
      expect(calendarEndOfMonthButton).toBeInTheDocument();
    });

    it('should call onChange with 0 when "月末" is selected', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('選択してください'));

      // Click "月末" button in calendar
      const endOfMonthButtons = screen.getAllByText('月末');
      const calendarEndOfMonthButton = endOfMonthButtons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('mb-3')
      );
      fireEvent.click(calendarEndOfMonthButton!);

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('should close calendar after selecting "月末"', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('選択してください'));
      expect(screen.getByText('締日・支払日を選択')).toBeInTheDocument();

      // Select "月末"
      const endOfMonthButtons = screen.getAllByText('月末');
      const calendarEndOfMonthButton = endOfMonthButtons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('mb-3')
      );
      fireEvent.click(calendarEndOfMonthButton!);

      expect(screen.queryByText('締日・支払日を選択')).not.toBeInTheDocument();
    });
  });

  describe('選択状態のハイライト', () => {
    it('should highlight selected day in calendar', () => {
      render(<DayPicker value={10} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('10日'));

      // Find day 10 button in calendar grid
      const day10Buttons = screen.getAllByText('10');
      const day10Button = day10Buttons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('w-8')
      ) as HTMLElement;

      expect(day10Button).toHaveClass('bg-blue-600');
      expect(day10Button).toHaveClass('text-white');
    });

    it('should highlight "月末" when value is 0', () => {
      render(<DayPicker value={0} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('月末'));

      // Find "月末" button in calendar
      const endOfMonthButtons = screen.getAllByText('月末');
      const calendarEndOfMonthButton = endOfMonthButtons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('mb-3')
      ) as HTMLElement;

      expect(calendarEndOfMonthButton).toHaveClass('bg-blue-600');
      expect(calendarEndOfMonthButton).toHaveClass('text-white');
    });

    it('should not highlight any day when value is null', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      // Open calendar
      fireEvent.click(screen.getByText('選択してください'));

      // Check that no day buttons have active styling
      const dayButtons = document.querySelectorAll('button.w-8');
      dayButtons.forEach(button => {
        expect(button).toHaveClass('bg-gray-50');
        expect(button).not.toHaveClass('bg-blue-600');
      });
    });

    it('should show text in correct color when value is selected', () => {
      render(<DayPicker value={25} onChange={mockOnChange} />);

      const span = screen.getByText('25日');
      expect(span).toHaveClass('text-gray-900');
    });

    it('should show placeholder text in gray when no value', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      const span = screen.getByText('選択してください');
      expect(span).toHaveClass('text-gray-400');
    });
  });

  describe('特殊ケース', () => {
    it('should handle day 1 selection', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      fireEvent.click(screen.getByText('選択してください'));

      const day1Buttons = screen.getAllByText('1');
      const day1Button = day1Buttons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('w-8')
      );
      fireEvent.click(day1Button!);

      expect(mockOnChange).toHaveBeenCalledWith(1);
    });

    it('should handle day 31 selection', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      fireEvent.click(screen.getByText('選択してください'));

      const day31Buttons = screen.getAllByText('31');
      const day31Button = day31Buttons.find(el =>
        el.tagName === 'BUTTON' && el.classList.contains('w-8')
      );
      fireEvent.click(day31Button!);

      expect(mockOnChange).toHaveBeenCalledWith(31);
    });

    it('should render calendar grid in 7 columns', () => {
      render(<DayPicker value={null} onChange={mockOnChange} />);

      fireEvent.click(screen.getByText('選択してください'));

      const grid = document.querySelector('.grid-cols-7');
      expect(grid).toBeInTheDocument();
    });
  });
});
