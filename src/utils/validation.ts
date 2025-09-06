// utils/validation.ts
import { TransactionWithParent } from '../types/purchase';

export const validateTransactionConfirm = (transaction: TransactionWithParent) => {
    if (!transaction.parent_order_id) {
        return {
            canProceed: false,
            severity: 'error' as const,
            message: '親発注が設定されていません。',
            suggestions: ['親発注を選択してください']
        };
    }
    
    if (transaction.parent_order_remaining === null) {
        return {
            canProceed: true,
            severity: 'info' as const,
            message: '残額情報が取得できません。データベース側で検証されます。'
        };
    }
    
    if (transaction.transaction_total > transaction.parent_order_remaining) {
        const exceedAmount = transaction.transaction_total - transaction.parent_order_remaining;
        return {
            canProceed: false,
            severity: 'error' as const,
            message: `発注残額 ¥${transaction.parent_order_remaining.toLocaleString()} を ¥${exceedAmount.toLocaleString()} 超過します。`,
            suggestions: [
                `金額を¥${transaction.parent_order_remaining.toLocaleString()}以下に調整`,
                '別の親発注に変更',
                '新規発注を作成'
            ]
        };
    }
    
    return {
        canProceed: true,
        severity: 'success' as const,
        message: `確定後残額: ¥${(transaction.parent_order_remaining - transaction.transaction_total).toLocaleString()}`
    };
};