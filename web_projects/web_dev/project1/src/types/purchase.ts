// types/purchase.ts
export interface TransactionWithParent {
    id: string;
    created_at: string;
    partner_id: string;
    parent_order_id: string | null;
    status: 'draft' | 'confirmed' | string;
    notes: string | null;
    transaction_total: number;
    parent_order_code: string | null;
    parent_order_date: string | null;
    parent_order_total: number | null;
    parent_order_confirmed: number | null;
    parent_order_draft: number | null;
    parent_order_remaining: number | null;
    parent_order_usage_pct: number | null;
    parent_order_status: 'no_parent' | 'parent_not_found' | 'over_limit' | 'low_balance' | 'nearly_full' | 'normal';
}