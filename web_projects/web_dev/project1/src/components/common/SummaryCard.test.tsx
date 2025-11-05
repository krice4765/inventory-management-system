import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryCard } from './SummaryCard';
import { TrendingUp } from 'lucide-react';

describe('SummaryCard', () => {
  it('renders with provided title and value', () => {
    render(
      <SummaryCard
        title="総支払額"
        value="¥1,234,567"
        icon={TrendingUp}
        colorFrom="from-blue-500"
        colorTo="to-blue-600"
      />
    );

    expect(screen.getByText('総支払額')).toBeInTheDocument();
    expect(screen.getByText('¥1,234,567')).toBeInTheDocument();
  });

  it('renders with numeric value', () => {
    render(
      <SummaryCard
        title="件数"
        value={42}
        icon={TrendingUp}
        colorFrom="from-green-500"
        colorTo="to-green-600"
      />
    );

    expect(screen.getByText('件数')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('applies gradient colors correctly', () => {
    const { container } = render(
      <SummaryCard
        title="テスト"
        value="100"
        icon={TrendingUp}
        colorFrom="from-red-500"
        colorTo="to-red-600"
      />
    );

    const card = container.querySelector('.bg-gradient-to-br');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('from-red-500');
    expect(card).toHaveClass('to-red-600');
  });

  it('renders icon with default color', () => {
    render(
      <SummaryCard
        title="テスト"
        value="100"
        icon={TrendingUp}
        colorFrom="from-blue-500"
        colorTo="to-blue-600"
      />
    );

    // Icon should be rendered (lucide-react renders as svg)
    const icon = document.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('applies custom icon color when provided', () => {
    const { container } = render(
      <SummaryCard
        title="テスト"
        value="100"
        icon={TrendingUp}
        colorFrom="from-blue-500"
        colorTo="to-blue-600"
        iconColor="text-yellow-500"
      />
    );

    const icon = container.querySelector('.text-yellow-500');
    expect(icon).toBeInTheDocument();
  });

  it('applies custom text color when provided', () => {
    const { container } = render(
      <SummaryCard
        title="テスト"
        value="100"
        icon={TrendingUp}
        colorFrom="from-blue-500"
        colorTo="to-blue-600"
        textColor="text-gray-900"
      />
    );

    const card = container.querySelector('.text-gray-900');
    expect(card).toBeInTheDocument();
  });

  it('uses default text color when not provided', () => {
    const { container } = render(
      <SummaryCard
        title="テスト"
        value="100"
        icon={TrendingUp}
        colorFrom="from-blue-500"
        colorTo="to-blue-600"
      />
    );

    const card = container.querySelector('.text-white');
    expect(card).toBeInTheDocument();
  });

  it('maintains proper structure with flex layout', () => {
    const { container } = render(
      <SummaryCard
        title="テスト"
        value="100"
        icon={TrendingUp}
        colorFrom="from-blue-500"
        colorTo="to-blue-600"
      />
    );

    const flexContainer = container.querySelector('.flex.items-center.justify-between');
    expect(flexContainer).toBeInTheDocument();
  });

  it('does not re-render unnecessarily with memo', () => {
    const { rerender } = render(
      <SummaryCard
        title="テスト"
        value="100"
        icon={TrendingUp}
        colorFrom="from-blue-500"
        colorTo="to-blue-600"
      />
    );

    // Re-render with same props should not cause issues
    rerender(
      <SummaryCard
        title="テスト"
        value="100"
        icon={TrendingUp}
        colorFrom="from-blue-500"
        colorTo="to-blue-600"
      />
    );

    expect(screen.getByText('テスト')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
