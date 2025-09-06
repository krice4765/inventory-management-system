-- installment_noをビューに追加する最小限の更新
-- フロントエンドですぐにテストできるよう、既存ビューを拡張

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
  
  -- 🆕 分納回次を追加（まだテーブルにない場合はNULLを返す）
  COALESCE(t.installment_no, 1) AS installment_no,
  
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