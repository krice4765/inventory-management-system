-- 分納制約問題の根本解決SQLスクリプト
-- 実行前に必ずバックアップを取得してください

-- ========================================
-- Phase 1: 緊急修復（分納機能の即座復旧）
-- ========================================

-- 1. 分納を妨げるUNIQUE制約の解除
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_parent_order_unique;

-- 2. 検索性能維持のためのINDEXを追加
CREATE INDEX IF NOT EXISTS idx_transactions_parent_order_id
  ON public.transactions(parent_order_id);

-- ========================================
-- Phase 2: 高度な分納管理（推奨実装）
-- ========================================

-- 3. 分納回次カラムの追加
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS installment_no integer;

-- 4. 分納の適切な一意性制約（同発注の同回次は1つのみ）
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_parent_installment
  ON public.transactions(parent_order_id, installment_no)
  WHERE transaction_type = 'purchase' AND parent_order_id IS NOT NULL;

-- ========================================
-- Phase 3: 自動採番とトリガー実装
-- ========================================

-- 5. 分納回次の自動採番関数
CREATE OR REPLACE FUNCTION set_installment_no()
RETURNS TRIGGER AS $$
BEGIN
  -- installment_noが未指定かつparent_order_idが存在する場合
  IF NEW.installment_no IS NULL AND NEW.parent_order_id IS NOT NULL AND NEW.transaction_type = 'purchase' THEN
    SELECT COALESCE(MAX(installment_no), 0) + 1
    INTO NEW.installment_no
    FROM public.transactions
    WHERE parent_order_id = NEW.parent_order_id
      AND transaction_type = 'purchase';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. トリガーの設定
DROP TRIGGER IF EXISTS trigger_set_installment_no ON public.transactions;
CREATE TRIGGER trigger_set_installment_no
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION set_installment_no();

-- ========================================
-- Phase 4: ビュー拡張（分納回次表示対応）
-- ========================================

-- 7. ビューの更新（installment_no追加）
CREATE OR REPLACE VIEW public.v_purchase_transactions AS
SELECT 
  t.id::text AS transaction_id,
  t.transaction_no,
  t.transaction_type,
  t.partner_id::text,
  TRIM(p.name) AS partner_name,
  t.transaction_date,
  t.due_date,
  t.status,
  t.total_amount,
  t.memo AS order_memo,
  t.parent_order_id::text,
  po.order_no,
  po.order_manager_name,
  t.created_at,
  first_item.name AS product_name,
  item_counts.item_count,
  first_item.name AS first_product_name,
  t.installment_no,  -- 🆕 分納回次を追加
  
  -- document_no: order_no優先、transaction_no代替
  COALESCE(po.order_no, t.transaction_no) AS document_no,
  
  -- item_summary: 明細集約表示
  CASE 
    WHEN item_counts.item_count = 0 AND t.memo IS NOT NULL AND t.memo != '' 
      THEN t.memo
    WHEN item_counts.item_count = 0 
      THEN '明細未登録'
    WHEN item_counts.item_count = 1 
      THEN first_item.name
    WHEN item_counts.item_count > 1 
      THEN first_item.name || ' ほか' || (item_counts.item_count - 1)::text || '件'
    ELSE '明細未登録'
  END AS item_summary,
  
  -- display_name: 表示名（item_summary優先、備考代替）
  CASE 
    WHEN item_counts.item_count = 0 AND t.memo IS NOT NULL AND t.memo != '' 
      THEN '備考: ' || t.memo
    WHEN item_counts.item_count = 0 
      THEN '明細未登録'
    WHEN item_counts.item_count = 1 
      THEN first_item.name
    WHEN item_counts.item_count > 1 
      THEN first_item.name || ' ほか' || (item_counts.item_count - 1)::text || '件'
    ELSE '明細未登録'
  END AS display_name
  
FROM public.transactions t
-- ...既存のJOIN文は省略...
LEFT JOIN public.partners p ON t.partner_id = p.id
LEFT JOIN public.purchase_orders po ON t.parent_order_id = po.id
LEFT JOIN (
  SELECT 
    ti.transaction_id,
    COUNT(*) AS item_count
  FROM public.transaction_items ti
  GROUP BY ti.transaction_id
) item_counts ON t.id = item_counts.transaction_id
LEFT JOIN (
  SELECT DISTINCT ON (ti.transaction_id)
    ti.transaction_id,
    pr.name
  FROM public.transaction_items ti
  JOIN public.products pr ON ti.product_id = pr.id
  ORDER BY ti.transaction_id, ti.id ASC
) first_item ON t.id = first_item.transaction_id
WHERE t.transaction_type = 'purchase'
ORDER BY t.created_at DESC;

-- ========================================
-- 検証用クエリ
-- ========================================

-- 8. 分納状況の確認
-- SELECT parent_order_id, COUNT(*) as installment_count, 
--        STRING_AGG(installment_no::text, ', ' ORDER BY installment_no) as installments
-- FROM public.transactions 
-- WHERE parent_order_id IS NOT NULL 
-- GROUP BY parent_order_id 
-- HAVING COUNT(*) > 1;