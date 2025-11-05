import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorFrom: string;
  colorTo: string;
  iconColor?: string;
  textColor?: string;
}

/**
 * Reusable summary card component with gradient background
 * Used across all report pages for displaying key metrics
 * Memoized to prevent unnecessary re-renders
 */
export const SummaryCard = memo<SummaryCardProps>(function SummaryCard({
  title,
  value,
  icon: Icon,
  colorFrom,
  colorTo,
  iconColor = 'text-white/70',
  textColor = 'text-white',
}) {
  return (
    <div
      className={`bg-gradient-to-br ${colorFrom} ${colorTo} rounded-lg shadow-lg p-6 ${textColor}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-90">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <Icon className={`h-12 w-12 ${iconColor}`} />
      </div>
    </div>
  );
});

export default SummaryCard;
