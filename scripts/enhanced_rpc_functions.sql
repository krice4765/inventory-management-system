-- ===============================================================
-- 🚀 Phase 2: 改良版RPC関数システム - 完全安全性保証
-- ===============================================================
-- 前提条件: Phase 1 (comprehensive_defense_system.sql) の実行完了
-- 目的: 統一バリデーション関数を活用した堅牢なRPC実装

BEGIN;

-- ===============================================================
-- 1. 改良版分納追加RPC - Enterprise Grade
-- ===============================================================

CREATE OR REPLACE FUNCTION public.add_purchase_installment_v2(
  p_parent_order_id uuid,
  p_amount numeric,
  p_status text DEFAULT 'draft',
  p_due_date date DEFAULT CURRENT_DATE + INTERVAL '30 days',
  p_memo text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  installment_id uuid,
  parent_order_id uuid,
  installment_no integer,
  transaction_no text,
  status text,
  total_amount numeric,
  memo text,
  transaction_date date,
  due_date date,
  created_at timestamptz,
  validation_info jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_installment integer;
  v_validation_result record;
  v_order_no text;
  v_new_transaction_id uuid;
  v_transaction_no text;
  v_retry_count integer := 0;
  v_max_retries integer := 3;
BEGIN
  -- ステップ1: 排他ロック取得（同時実行制御）
  PERFORM 1 FROM public.purchase_orders WHERE id = p_parent_order_id FOR UPDATE;
  
  -- ステップ2: 統一バリデーション関数による検証
  SELECT * FROM public.validate_installment_amount(p_parent_order_id, p_amount)
  INTO v_validation_result;
  
  IF NOT v_validation_result.is_valid THEN
    -- 検証失敗時は詳細情報を返却
    RETURN QUERY SELECT 
      false,
      NULL::uuid,
      p_parent_order_id,
      NULL::integer,
      NULL::text,
      p_status,
      p_amount,
      p_memo,
      CURRENT_DATE,
      p_due_date,
      NULL::timestamptz,
      jsonb_build_object(
        'error_code', v_validation_result.error_code,
        'error_message', v_validation_result.error_message,
        'order_total', v_validation_result.order_total,
        'allocated_total', v_validation_result.allocated_total,
        'remaining_amount', v_validation_result.remaining_amount,
        'validation_timestamp', NOW()
      );
    RETURN;
  END IF;
  
  -- ステップ3: 発注番号取得
  SELECT order_no INTO v_order_no
  FROM public.purchase_orders WHERE id = p_parent_order_id;
  
  -- ステップ4: 競合制御ループによる安全な挿入
  <<retry_loop>>
  LOOP
    v_retry_count := v_retry_count + 1;
    
    -- 次の分納回次を計算
    SELECT COALESCE(MAX(installment_no), 0) + 1
    INTO v_next_installment
    FROM public.transactions
    WHERE parent_order_id = p_parent_order_id 
      AND transaction_type = 'purchase';
    
    -- 一意な取引番号生成
    v_transaction_no := 'TX-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') || '-' || 
                       substr(md5(random()::text || v_retry_count::text), 1, 6);
    
    v_new_transaction_id := gen_random_uuid();
    
    BEGIN
      -- 分納トランザクションの挿入
      INSERT INTO public.transactions (
        id,
        transaction_type,
        transaction_no,
        partner_id,
        transaction_date,
        due_date,
        status,
        total_amount,
        memo,
        parent_order_id,
        installment_no,
        created_at
      )
      SELECT
        v_new_transaction_id,
        'purchase',
        v_transaction_no,
        po.partner_id,
        CURRENT_DATE,
        p_due_date,
        p_status,
        p_amount,
        COALESCE(p_memo, '第' || v_next_installment || '回分納 - ' || po.order_no || ' (v2.0)'),
        p_parent_order_id,
        v_next_installment,
        NOW()
      FROM public.purchase_orders po
      WHERE po.id = p_parent_order_id;
      
      -- 成功時はループ終了
      EXIT retry_loop;
      
    EXCEPTION 
      WHEN unique_violation THEN
        -- 分納番号競合時のリトライ
        IF v_retry_count >= v_max_retries THEN
          RAISE EXCEPTION '分納番号の競合が解決できません。しばらくしてから再実行してください。'
            USING ERRCODE = 'P0002';
        END IF;
        -- 短時間待機後リトライ
        PERFORM pg_sleep(0.01 * v_retry_count);
      WHEN others THEN
        -- その他のエラーは即座に再発生
        RAISE;
    END;
  END LOOP;
  
  -- ステップ5: 成功レスポンス返却
  RETURN QUERY
  SELECT 
    true,
    v_new_transaction_id,
    p_parent_order_id,
    v_next_installment,
    v_transaction_no,
    p_status,
    p_amount,
    COALESCE(p_memo, '第' || v_next_installment || '回分納 - ' || v_order_no || ' (v2.0)'),
    CURRENT_DATE,
    p_due_date,
    NOW(),
    jsonb_build_object(
      'validation_passed', true,
      'order_total', v_validation_result.order_total,
      'allocated_total', v_validation_result.allocated_total,
      'remaining_amount', v_validation_result.remaining_amount - p_amount,
      'installment_no', v_next_installment,
      'retry_count', v_retry_count,
      'processing_timestamp', NOW()
    );
END;
$$;

-- ===============================================================
-- 2. 分納確定RPC - 段階的状態管理
-- ===============================================================

CREATE OR REPLACE FUNCTION public.confirm_purchase_installment(
  p_transaction_id uuid,
  p_confirm_amount numeric DEFAULT NULL  -- NULLの場合は既存金額を使用
)
RETURNS TABLE (
  success boolean,
  transaction_id uuid,
  old_status text,
  new_status text,
  confirmed_amount numeric,
  validation_info jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction record;
  v_validation_result record;
  v_final_amount numeric;
BEGIN
  -- ステップ1: 対象取引の取得と排他ロック
  SELECT t.*, po.order_no
  INTO v_transaction
  FROM public.transactions t
  JOIN public.purchase_orders po ON t.parent_order_id = po.id
  WHERE t.id = p_transaction_id AND t.transaction_type = 'purchase'
  FOR UPDATE;
  
  IF v_transaction.id IS NULL THEN
    RETURN QUERY SELECT 
      false, p_transaction_id, NULL::text, NULL::text, NULL::numeric,
      jsonb_build_object('error', '指定された分納取引が見つかりません');
    RETURN;
  END IF;
  
  IF v_transaction.status = 'confirmed' THEN
    RETURN QUERY SELECT 
      false, p_transaction_id, v_transaction.status, v_transaction.status, v_transaction.total_amount,
      jsonb_build_object('error', '既に確定済みの分納です');
    RETURN;
  END IF;
  
  -- ステップ2: 確定金額の決定
  v_final_amount := COALESCE(p_confirm_amount, v_transaction.total_amount);
  
  -- ステップ3: 金額変更がある場合のバリデーション
  IF v_final_amount != v_transaction.total_amount THEN
    SELECT * FROM public.validate_installment_amount(
      v_transaction.parent_order_id, v_final_amount, p_transaction_id
    ) INTO v_validation_result;
    
    IF NOT v_validation_result.is_valid THEN
      RETURN QUERY SELECT 
        false, p_transaction_id, v_transaction.status, v_transaction.status, v_final_amount,
        jsonb_build_object(
          'error', v_validation_result.error_message,
          'error_code', v_validation_result.error_code
        );
      RETURN;
    END IF;
  END IF;
  
  -- ステップ4: 分納の確定
  UPDATE public.transactions 
  SET 
    status = 'confirmed',
    total_amount = v_final_amount,
    updated_at = NOW(),
    memo = CASE 
      WHEN v_final_amount != v_transaction.total_amount 
      THEN v_transaction.memo || ' [金額調整: ¥' || v_transaction.total_amount || '→¥' || v_final_amount || ']'
      ELSE v_transaction.memo 
    END
  WHERE id = p_transaction_id;
  
  -- ステップ5: 成功レスポンス
  RETURN QUERY SELECT 
    true,
    p_transaction_id,
    v_transaction.status,
    'confirmed'::text,
    v_final_amount,
    jsonb_build_object(
      'previous_amount', v_transaction.total_amount,
      'confirmed_amount', v_final_amount,
      'amount_changed', (v_final_amount != v_transaction.total_amount),
      'confirmation_timestamp', NOW(),
      'order_no', v_transaction.order_no
    );
END;
$$;

-- ===============================================================
-- 3. 分納削除RPC - 安全削除
-- ===============================================================

CREATE OR REPLACE FUNCTION public.delete_purchase_installment(
  p_transaction_id uuid,
  p_force_delete boolean DEFAULT false
)
RETURNS TABLE (
  success boolean,
  deleted_transaction_id uuid,
  deleted_amount numeric,
  installment_no integer,
  order_no text,
  info jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction record;
BEGIN
  -- ステップ1: 対象取引の確認
  SELECT t.*, po.order_no
  INTO v_transaction
  FROM public.transactions t
  JOIN public.purchase_orders po ON t.parent_order_id = po.id
  WHERE t.id = p_transaction_id AND t.transaction_type = 'purchase'
  FOR UPDATE;
  
  IF v_transaction.id IS NULL THEN
    RETURN QUERY SELECT 
      false, p_transaction_id, NULL::numeric, NULL::integer, NULL::text,
      jsonb_build_object('error', '指定された分納取引が見つかりません');
    RETURN;
  END IF;
  
  -- ステップ2: 削除可能性チェック
  IF v_transaction.status = 'confirmed' AND NOT p_force_delete THEN
    RETURN QUERY SELECT 
      false, p_transaction_id, v_transaction.total_amount, v_transaction.installment_no, v_transaction.order_no,
      jsonb_build_object('error', '確定済み分納は強制削除フラグなしでは削除できません');
    RETURN;
  END IF;
  
  -- ステップ3: 安全削除実行
  DELETE FROM public.transactions WHERE id = p_transaction_id;
  
  -- ステップ4: 成功レスポンス
  RETURN QUERY SELECT 
    true,
    p_transaction_id,
    v_transaction.total_amount,
    v_transaction.installment_no,
    v_transaction.order_no,
    jsonb_build_object(
      'deleted_status', v_transaction.status,
      'deletion_timestamp', NOW(),
      'force_delete_used', p_force_delete
    );
END;
$$;

-- ===============================================================
-- 4. 発注サマリー取得RPC - 高性能読み込み
-- ===============================================================

CREATE OR REPLACE FUNCTION public.get_order_installment_summary(
  p_order_id uuid
)
RETURNS TABLE (
  order_id uuid,
  order_no text,
  partner_name text,
  order_total numeric,
  allocated_total numeric,
  remaining_amount numeric,
  installment_count bigint,
  completion_rate numeric,
  status text,
  installments jsonb,
  summary_info jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH installment_data AS (
    SELECT 
      po.id,
      po.order_no,
      p.name as partner_name,
      po.total_amount,
      COALESCE(SUM(t.total_amount), 0) as allocated,
      COUNT(t.id) as installments,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'installment_no', t.installment_no,
            'amount', t.total_amount,
            'status', t.status,
            'transaction_no', t.transaction_no,
            'due_date', t.due_date,
            'created_at', t.created_at
          ) ORDER BY t.installment_no
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'::jsonb
      ) as installment_list
    FROM public.purchase_orders po
    JOIN public.partners p ON po.partner_id = p.id
    LEFT JOIN public.transactions t ON po.id = t.parent_order_id 
      AND t.transaction_type = 'purchase'
    WHERE po.id = p_order_id
    GROUP BY po.id, po.order_no, p.name, po.total_amount
  )
  SELECT 
    id.id,
    id.order_no,
    id.partner_name,
    id.total_amount,
    id.allocated,
    id.total_amount - id.allocated,
    id.installments,
    CASE WHEN id.total_amount > 0 THEN 
      ROUND((id.allocated / id.total_amount * 100), 1)
    ELSE 0 END,
    CASE 
      WHEN id.allocated = 0 THEN '未分納'
      WHEN id.allocated = id.total_amount THEN '完了'
      WHEN id.allocated > id.total_amount THEN '超過エラー'
      ELSE '分納中'
    END,
    id.installment_list,
    jsonb_build_object(
      'generated_at', NOW(),
      'next_installment_no', id.installments + 1,
      'can_add_installment', (id.total_amount - id.allocated) > 0,
      'integrity_status', CASE 
        WHEN id.allocated <= id.total_amount THEN 'OK'
        ELSE 'ERROR'
      END
    )
  FROM installment_data id;
END;
$$;

-- ===============================================================
-- 5. レガシー関数の無効化と互換性保証
-- ===============================================================

-- 既存関数を v2 関数にリダイレクト（段階的移行）
CREATE OR REPLACE FUNCTION public.add_purchase_installment(
  p_parent_order_id uuid,
  p_amount numeric,
  p_status text DEFAULT 'draft',
  p_due_date date DEFAULT CURRENT_DATE + INTERVAL '30 days',
  p_memo text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  parent_order_id uuid,
  installment_no integer,
  transaction_no text,
  status text,
  total_amount numeric,
  memo text,
  transaction_date date,
  due_date date,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v2_result record;
BEGIN
  -- v2 関数を呼び出し
  SELECT * FROM public.add_purchase_installment_v2(
    p_parent_order_id, p_amount, p_status, p_due_date, p_memo
  ) INTO v2_result;
  
  -- レガシー形式で結果を返却
  IF v2_result.success THEN
    RETURN QUERY SELECT 
      v2_result.installment_id,
      v2_result.parent_order_id,
      v2_result.installment_no,
      v2_result.transaction_no,
      v2_result.status,
      v2_result.total_amount,
      v2_result.memo,
      v2_result.transaction_date,
      v2_result.due_date,
      v2_result.created_at;
  ELSE
    -- v2でエラーの場合は例外を発生
    RAISE EXCEPTION '%', (v2_result.validation_info->>'error_message')
      USING ERRCODE = COALESCE(v2_result.validation_info->>'error_code', 'P0001');
  END IF;
END;
$$;

-- ===============================================================
-- 6. PostgREST権限設定とスキーマ更新
-- ===============================================================

-- 新しいRPC関数の権限設定
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_installment TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_purchase_installment TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_installment_summary TO anon, authenticated;

-- PostgREST スキーマリロード
NOTIFY pgrst, 'reload schema';

-- 完了ログ記録
INSERT INTO public.system_logs (event_type, message, created_at)
VALUES (
  'RPC_UPGRADE',
  'Phase 2: 改良版RPC関数システム完了 - Enterprise Grade安全性と高性能を実装',
  NOW()
) ON CONFLICT DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE '🚀 Phase 2完了: 改良版RPC関数システムが正常に実装されました';
  RAISE NOTICE '📊 利用可能な新機能:';
  RAISE NOTICE '  - add_purchase_installment_v2(): 完全安全分納追加';
  RAISE NOTICE '  - confirm_purchase_installment(): 段階的確定';
  RAISE NOTICE '  - delete_purchase_installment(): 安全削除';
  RAISE NOTICE '  - get_order_installment_summary(): 高性能サマリー';
  RAISE NOTICE '🔄 既存関数add_purchase_installment()は自動的にv2にリダイレクト';
  RAISE NOTICE '🎯 次のステップ: TypeScript型安全性とサービス層の実装 (Phase 3)';
END $$;

COMMIT;