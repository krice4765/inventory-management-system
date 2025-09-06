-- 分納システム運用安定性向上機能
-- 長期運用での金額超過・データ不整合防止

-- ========================================
-- 1. 確定時の金額超過防止トリガー
-- ========================================

CREATE OR REPLACE FUNCTION public.prevent_confirmed_over_allocation()
RETURNS trigger AS $$
DECLARE
  v_order_total numeric;
  v_confirmed_sum numeric;
  v_order_no text;
BEGIN
  -- 購入取引の確定時のみチェック
  IF NEW.transaction_type = 'purchase' AND NEW.status = 'confirmed' AND NEW.parent_order_id IS NOT NULL THEN
    -- 元発注の総額を取得
    SELECT total_amount, order_no 
    INTO v_order_total, v_order_no
    FROM public.purchase_orders 
    WHERE id = NEW.parent_order_id;
    
    -- 既存の確定済み分納合計を計算（自分自身は除く）
    SELECT COALESCE(SUM(total_amount), 0) 
    INTO v_confirmed_sum
    FROM public.transactions
    WHERE parent_order_id = NEW.parent_order_id
      AND transaction_type = 'purchase'
      AND status = 'confirmed'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    -- 超過チェック
    IF v_confirmed_sum + NEW.total_amount > v_order_total THEN
      RAISE EXCEPTION '[P0002] 確定済み分納合計が発注金額を超過します | 発注: % | 超過額: ¥%.2f | 発注額: ¥%.2f | 確定済み: ¥%.2f | 今回: ¥%.2f', 
        v_order_no,
        (v_confirmed_sum + NEW.total_amount - v_order_total),
        v_order_total,
        v_confirmed_sum,
        NEW.total_amount;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー設定（既存があれば置き換え）
DROP TRIGGER IF EXISTS trg_prevent_over_allocation ON public.transactions;
CREATE TRIGGER trg_prevent_over_allocation
  BEFORE INSERT OR UPDATE OF status, total_amount
  ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_confirmed_over_allocation();

-- ========================================
-- 2. 日次品質監査ビュー
-- ========================================

CREATE OR REPLACE VIEW public.v_installment_quality_audit AS
SELECT 
    po.id as order_id,
    po.order_no,
    po.total_amount as order_total,
    COUNT(t.id) as installment_count,
    SUM(t.total_amount) as installment_total,
    ROUND((SUM(t.total_amount) / po.total_amount * 100)::numeric, 1) as completion_rate,
    STRING_AGG(t.installment_no::text ORDER BY t.installment_no, ' → ') as installment_sequence,
    STRING_AGG('¥' || t.total_amount::text ORDER BY t.installment_no, ' + ') as amount_sequence,
    
    CASE 
        WHEN COUNT(t.id) = 0 THEN '📋 未分納'
        WHEN SUM(t.total_amount) = po.total_amount THEN '✅ 完璧配分'
        WHEN SUM(t.total_amount) < po.total_amount THEN '⚠️ 未配分残あり'
        ELSE '🔴 超過配分'
    END as quality_status,
    
    -- 異常検知指標
    CASE 
        WHEN po.total_amount - SUM(t.total_amount) BETWEEN -0.01 AND 0.01 THEN '正常'
        WHEN po.total_amount - SUM(t.total_amount) > 0 THEN '不足'
        ELSE '超過'
    END as balance_status
    
FROM public.purchase_orders po
LEFT JOIN public.transactions t ON po.id = t.parent_order_id 
    AND t.transaction_type = 'purchase'
WHERE po.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY po.id, po.order_no, po.total_amount
ORDER BY po.created_at DESC;

-- ========================================
-- 3. 分納パフォーマンス監視
-- ========================================

CREATE OR REPLACE VIEW public.v_installment_performance AS
SELECT 
    DATE_TRUNC('day', t.created_at) as day,
    COUNT(DISTINCT t.parent_order_id) as orders_with_installments,
    COUNT(t.id) as total_installments,
    ROUND(AVG(t.total_amount)::numeric, 2) as avg_installment_amount,
    COUNT(CASE WHEN t.installment_no >= 2 THEN 1 END) as multi_installment_count,
    ROUND(
        COUNT(CASE WHEN t.installment_no >= 2 THEN 1 END)::numeric / 
        COUNT(t.id)::numeric * 100, 1
    ) as multi_installment_rate
FROM public.transactions t
WHERE t.transaction_type = 'purchase' 
  AND t.parent_order_id IS NOT NULL
  AND t.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', t.created_at)
ORDER BY day DESC;

-- ========================================
-- 4. 自動警告システム（オプション）
-- ========================================

-- 分納関連の異常を検知する関数
CREATE OR REPLACE FUNCTION public.check_installment_anomalies()
RETURNS TABLE(
    anomaly_type text,
    order_no text,
    description text,
    severity text
) AS $$
BEGIN
    -- 金額超過の検知
    RETURN QUERY
    SELECT 
        'amount_overflow'::text,
        po.order_no::text,
        ('分納合計 ¥' || SUM(t.total_amount)::text || ' が発注額 ¥' || po.total_amount::text || ' を超過')::text,
        'HIGH'::text
    FROM public.purchase_orders po
    JOIN public.transactions t ON po.id = t.parent_order_id
    WHERE t.transaction_type = 'purchase'
    GROUP BY po.id, po.order_no, po.total_amount
    HAVING SUM(t.total_amount) > po.total_amount;
    
    -- installment_no重複の検知
    RETURN QUERY  
    SELECT 
        'duplicate_installment'::text,
        po.order_no::text,
        ('分納回次 ' || t.installment_no::text || ' が重複')::text,
        'MEDIUM'::text
    FROM public.transactions t
    JOIN public.purchase_orders po ON t.parent_order_id = po.id
    WHERE t.transaction_type = 'purchase'
    GROUP BY po.id, po.order_no, t.installment_no
    HAVING COUNT(*) > 1;
    
END;
$$ LANGUAGE plpgsql;

-- 使用例: SELECT * FROM public.check_installment_anomalies();