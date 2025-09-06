// src/utils/number.ts - 新規作成
export const round2 = (n: number): number => 
  Math.round((n + Number.EPSILON) * 100) / 100;

export const sumBy = <T,>(arr: T[], pick: (x: T) => number): number =>
  arr.reduce((a, x) => {
    const value = pick(x);
    return a + (Number.isFinite(value) ? value : 0);
  }, 0);

// 安全な金額取得関数
export const getAmount = (item: Record<string, unknown>): number => {
  return Number(
    item.total_amount ?? 
    item.totalAmount ?? 
    ((item.qty ?? item.quantity ?? 0) * (item.unit_price ?? item.unitPrice ?? 0))
  ) || 0;
};

// src/utils/number.ts - 改善版
export const calculateRemainingAmount = (
  purchaseOrder: Record<string, unknown>,
  allTransactions: Record<string, unknown>[],
  currentAmount: number = 0,
  excludeTransactionId?: string
) => {
  const orderTotal = getAmount(purchaseOrder);
  const siblingsTotal = round2(
    sumBy(
      allTransactions.filter(t => 
        t.parent_order_id === purchaseOrder.id &&
        t.id !== excludeTransactionId &&
        (t.status === 'confirmed' || t.status === 'draft')
      ),
      getAmount
    )
  );
  
  const plannedTotal = round2(siblingsTotal + currentAmount);
  
  // 🔥 改善: 「確定後の残額」として再定義
  const remainingAmount = round2(orderTotal - plannedTotal);
  
  return {
    orderTotal,
    siblingsTotal,
    currentAmount,
    plannedTotal,
    remainingAmount, // これで¥693入力時に¥0と表示される
    isExceeding: plannedTotal > orderTotal,
    exceedingAmount: Math.max(0, plannedTotal - orderTotal)
  };
};
