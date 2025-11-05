// components/ParentOrderCell.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { TransactionWithParent } from '../types/purchase';

interface ParentOrderCellProps {
    transaction: TransactionWithParent;
}

export const ParentOrderCell: React.FC<ParentOrderCellProps> = ({ transaction }) => {
    const location = useLocation();
    const {
        parent_order_id,
        parent_order_code,
        parent_order_total,
        parent_order_remaining,
        parent_order_status,
        transaction_total,
        delivery_sequence
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
    const deliveryLabel = delivery_sequence ? ` (第${delivery_sequence}回)` : '';

    // ステータスに応じた表示設定
    const getStatusConfig = (status: string, remaining: number | null) => {
        if (remaining !== null && remaining <= 0) {
            return {
                bgColor: 'bg-red-100',
                textColor: 'text-red-700',
                borderColor: 'border-red-200',
                icon: '🔴',
                label: '残額なし',
                tooltip: 'この発注は既に満額使用されています。これ以上の仕入は発注額を超過します。',
                priority: 'high'
            };
        }

        if (remaining !== null && remaining < (parent_order_total || 0) * 0.1) {
            return {
                bgColor: 'bg-amber-100',
                textColor: 'text-amber-700',
                borderColor: 'border-amber-200',
                icon: '🟡',
                label: '残額わずか',
                tooltip: `残額が発注額の10%未満です。残り¥${remaining.toLocaleString()}`,
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
                    label: 'もうすぐ満額',
                    tooltip: 'この発注はもうすぐ満額に達します。残額にご注意ください。',
                    priority: 'medium'
                };
            case 'normal':
                return {
                    bgColor: 'bg-emerald-100',
                    textColor: 'text-emerald-700',
                    borderColor: 'border-emerald-200',
                    icon: '✅',
                    label: '余裕あり',
                    tooltip: 'この発注にはまだ十分な残額があります。',
                    priority: 'low'
                };
            default:
                return {
                    bgColor: 'bg-gray-100',
                    textColor: 'text-gray-600',
                    borderColor: 'border-gray-200',
                    icon: '❓',
                    label: '状態不明',
                    tooltip: '発注の状態を判定できません。データを確認してください。',
                    priority: 'low'
                };
        }
    };

    const statusConfig = getStatusConfig(parent_order_status, parent_order_remaining);

    return (
        <div className="flex flex-col items-start gap-1 min-w-0">
            {/* 発注番号 */}
            <Link
                to={`/orders/${parent_order_id}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded font-medium text-sm truncate max-w-full transition-colors"
                title={`発注番号: ${displayCode}${deliveryLabel}\n発注額: ¥${parent_order_total?.toLocaleString() || '不明'}\n残額: ¥${parent_order_remaining?.toLocaleString() || '不明'}${delivery_sequence ? `\n納品回数: 第${delivery_sequence}回` : ''}`}
            >
                {displayCode}{deliveryLabel}
            </Link>

            {/* ステータスと残額表示 */}
            <div className="flex flex-wrap gap-1">
                <span
                    className={`text-xs px-2 py-0.5 rounded border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} cursor-help`}
                    title={statusConfig.tooltip}
                >
                    {statusConfig.icon} {statusConfig.label}
                </span>

                {parent_order_remaining !== null && (
                    <span
                        className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 cursor-help"
                        title={`親発注の残額\n発注額: ¥${parent_order_total?.toLocaleString() || '不明'}\n残額: ¥${parent_order_remaining.toLocaleString()}`}
                    >
                        残 ¥{parent_order_remaining.toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    );
};
