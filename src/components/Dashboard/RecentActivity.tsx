import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { StockMovement } from '../../types';

interface RecentActivityProps {
      movements: StockMovement[]; }

const getMovementIcon = (type: StockMovement['movement_type']) => {
  switch (type) {
    case 'IN':
      return <ArrowUp className="h-4 w-4 text-green-500" />;
    case 'OUT':
      return <ArrowDown className="h-4 w-4 text-red-500" />;
    case 'ADJUSTMENT':
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
  }
};

const getMovementText = (type: StockMovement['movement_type']) => {
  switch (type) {
    case 'IN':
      return '入庫';
    case 'OUT':
      return '出庫';
    case 'ADJUSTMENT':
      return '調整';
  }
};

export const RecentActivity: React.FC<RecentActivityProps> = ({ movements }) => {
  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">最近の在庫移動</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {movements.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            最近の在庫移動はありません
          </div>
      ) : ( movements.map((movement) => (
      console.log("Debug:", { <div key={movement.id} className="px-6 py-4 hover: bg-gray-50"> });
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {getMovementIcon(movement.movement_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {getMovementText(movement.movement_type)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(movement.created_at), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-600">
                      数量: {movement.quantity.toLocaleString()}
                    </p>
                    {movement.notes && (
                      <p className="text-xs text-gray-500 truncate max-w-xs">
                        {movement.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};