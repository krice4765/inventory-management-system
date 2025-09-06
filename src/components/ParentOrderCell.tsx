// components/ParentOrderCell.tsx
import React from 'react';
import type { TransactionWithParent } from '../types/purchase';

interface ParentOrderCellProps {
    transaction: TransactionWithParent;
}

export const ParentOrderCell: React.FC<ParentOrderCellProps> = ({ transaction }) => {
    const {
        parent_order_id,
        parent_order_code,
        parent_order_total,
        parent_order_remaining,
        parent_order_status,
        transaction_total
    } = transaction;

    // 親発注未設定の場合
    if (!parent_order_id) {
        return (
            <div className="flex flex-col items-start gap-1">
                <span className="inline-flex items-center rounded px-2 py-1 text-xs bg-amber-100 text-amber-700 border border-amber-200">
                    ⚠️ 未割当
                </span>
                <div className="text-xs text-gray-500">
                    <div>親発注なし</div>
                    <div className="font-medium text-gray-700">
                        ¥{transaction_total?.toLocaleString() || '0'}
                    </div>
                </div>
            </div>
        );
    }

    const displayCode = parent_order_code || `PO-${parent_order_id}`;

    // ステータスに応じた表示設定
    const getStatusConfig = (status: string, remaining: number | null) => {
        if (remaining !== null && remaining <= 0) {
            return {
                bgColor: 'bg-red-100',
                textColor: 'text-red-700',
                borderColor: 'border-red-200',
                icon: '🔴',
                label: '満額',
                priority: 'high'
            };
        }

        if (remaining !== null && remaining < (parent_order_total || 0) * 0.1) {
            return {
                bgColor: 'bg-amber-100',
                textColor: 'text-amber-700',
                borderColor: 'border-amber-200',
                icon: '🟡',
                label: '残少',
                priority: 'medium'
            };
        }

        switch (status) {
            case 'nearly_full':
                return {
                    bgColor: 'bg-orange-100',
                    textColor: 'text-orange-700',
                    borderColor: 'border-orange-200',
                    icon: '🟠',
                    label: '満杯近',
                    priority: 'medium'
                };
            case 'normal':
                return {
                    bgColor: 'bg-emerald-100',
                    textColor: 'text-emerald-700',
                    borderColor: 'border-emerald-200',
                    icon: '✅',
                    label: '正常',
                    priority: 'low'
                };
            default:
                return {
                    bgColor: 'bg-gray-100',
                    textColor: 'text-gray-600',
                    borderColor: 'border-gray-200',
                    icon: '❓',
                    label: '不明',
                    priority: 'low'
                };
        }
    };

    const statusConfig = getStatusConfig(parent_order_status, parent_order_remaining);

    return (
        <div className="flex flex-col items-start gap-1 min-w-0">
            {/* 発注番号 */}
            <div
                className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded cursor-pointer font-medium text-sm truncate max-w-full"
                title={`発注番号: ${displayCode}\n発注額: ¥${parent_order_total?.toLocaleString() || '不明'}\n残額: ¥${parent_order_remaining?.toLocaleString() || '不明'}`}
                onClick={() => {
                    console.log('親発注詳細:', {
                        id: parent_order_id,
                        code: displayCode,
                        total: parent_order_total,
                        remaining: parent_order_remaining
                    });
                }}
            >
                {displayCode}
            </div>

            {/* ステータスと残額表示 */}
            <div className="flex flex-wrap gap-1">
                <span className={`text-xs px-2 py-0.5 rounded border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                    {statusConfig.icon} {statusConfig.label}
                </span>

                {parent_order_remaining !== null && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        残 ¥{parent_order_remaining.toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    );
};
