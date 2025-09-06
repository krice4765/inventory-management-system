-- ===============================================================
-- 🚨 P0緊急対応: 担当者リスト不整合の根本解決
-- ===============================================================
-- 問題: 担当者作成→発注担当ドロップダウンに出ない／削除済み担当者が残る
-- 解決: staff_membersマスタ化と参照関係の正規化

BEGIN;

-- ===============================================================
-- 1. 現状分析とバックアップ
-- ===============================================================

-- 1.1 現在の担当者データ状況を分析
CREATE TEMP TABLE current_assignee_analysis AS
WITH po_assignees AS (
  SELECT DISTINCT assignee_name, COUNT(*) as po_count
  FROM purchase_orders 
  WHERE assignee_name IS NOT NULL 
  GROUP BY assignee_name
),
tx_assignees AS (
  SELECT DISTINCT assignee_name, COUNT(*) as tx_count
  FROM transactions 
  WHERE assignee_name IS NOT NULL 
  GROUP BY assignee_name
)
SELECT 
  COALESCE(po.assignee_name, tx.assignee_name) as name,
  COALESCE(po.po_count, 0) as purchase_order_count,
  COALESCE(tx.tx_count, 0) as transaction_count,
  CASE 
    WHEN po.assignee_name IS NOT NULL AND tx.assignee_name IS NOT NULL THEN 'BOTH'
    WHEN po.assignee_name IS NOT NULL THEN 'PO_ONLY'
    WHEN tx.assignee_name IS NOT NULL THEN 'TX_ONLY'
  END as usage_scope
FROM po_assignees po 
FULL OUTER JOIN tx_assignees tx ON po.assignee_name = tx.assignee_name
ORDER BY (COALESCE(po.po_count, 0) + COALESCE(tx.tx_count, 0)) DESC;

-- 1.2 既存partners/contactsの担当者情報を確認
CREATE TEMP TABLE partner_contacts_analysis AS
SELECT 
  p.id as partner_id,
  p.name as partner_name,
  p.contact_person,
  p.phone,
  p.email,
  COUNT(po.id) as related_orders
FROM partners p
LEFT JOIN purchase_orders po ON p.id = po.partner_id
WHERE p.contact_person IS NOT NULL
GROUP BY p.id, p.name, p.contact_person, p.phone, p.email
ORDER BY related_orders DESC;

-- ===============================================================
-- 2. staff_membersマスタテーブルの作成
-- ===============================================================

-- 2.1 staff_membersマスタテーブル
CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本情報
  name text NOT NULL UNIQUE,
  email text UNIQUE,
  phone text,
  
  -- 組織情報
  department text,
  position text,
  employee_id text UNIQUE,
  
  -- 権限・役割
  role text DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff', 'readonly')),
  can_create_orders boolean DEFAULT true,
  can_confirm_transactions boolean DEFAULT true,
  can_manage_inventory boolean DEFAULT false,
  
  -- ステータス管理
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  hire_date date,
  termination_date date,
  
  -- システム情報
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  created_by uuid,
  updated_by uuid,
  
  -- 制約
  CONSTRAINT valid_termination_date CHECK (termination_date IS NULL OR termination_date >= hire_date),
  CONSTRAINT active_has_no_termination CHECK (status != 'active' OR termination_date IS NULL)
);

-- インデックス作成
CREATE INDEX idx_staff_members_name ON public.staff_members (name);
CREATE INDEX idx_staff_members_status ON public.staff_members (status);
CREATE INDEX idx_staff_members_email ON public.staff_members (email) WHERE email IS NOT NULL;
CREATE INDEX idx_staff_members_employee_id ON public.staff_members (employee_id) WHERE employee_id IS NOT NULL;

-- ===============================================================
-- 3. 既存データからstaff_membersへの移行
-- ===============================================================

-- 3.1 既存の担当者名からstaff_membersを作成
INSERT INTO public.staff_members (name, status, created_at, created_by)
SELECT DISTINCT
  name,
  'active' as status,
  NOW() as created_at,
  NULL as created_by -- システムによる自動作成
FROM current_assignee_analysis
WHERE name IS NOT NULL 
  AND name != ''
  AND name NOT ILIKE '%test%'  -- テストデータ除外
  AND name NOT ILIKE '%削除%'  -- 削除済みデータ除外
ON CONFLICT (name) DO NOTHING;

-- 3.2 partnersのcontact_personからもstaff_membersを補完
INSERT INTO public.staff_members (name, email, phone, status, department, created_at)
SELECT DISTINCT
  p.contact_person as name,
  p.email,
  p.phone,
  'active' as status,
  '取引先担当' as department,
  NOW() as created_at
FROM partners p
WHERE p.contact_person IS NOT NULL 
  AND p.contact_person != ''
  AND p.contact_person NOT IN (SELECT name FROM public.staff_members)
ON CONFLICT (name) DO NOTHING;

-- ===============================================================
-- 4. テーブル構造の更新（段階的移行）
-- ===============================================================

-- 4.1 purchase_ordersにassignee_id追加
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.staff_members(id);

-- 4.2 transactionsにassignee_id追加  
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.staff_members(id);

-- 4.3 既存データのマッピング（purchase_orders）
UPDATE public.purchase_orders 
SET assignee_id = (
  SELECT sm.id FROM public.staff_members sm 
  WHERE sm.name = purchase_orders.assignee_name
)
WHERE assignee_name IS NOT NULL 
  AND assignee_id IS NULL;

-- 4.4 既存データのマッピング（transactions）
UPDATE public.transactions 
SET assignee_id = (
  SELECT sm.id FROM public.staff_members sm 
  WHERE sm.name = transactions.assignee_name
)
WHERE assignee_name IS NOT NULL 
  AND assignee_id IS NULL;

-- ===============================================================
-- 5. ビューの作成（API用）
-- ===============================================================

-- 5.1 アクティブ担当者ビュー（ドロップダウン用）
CREATE OR REPLACE VIEW public.v_active_staff_members AS
SELECT 
  sm.id,
  sm.name,
  sm.email,
  sm.phone,
  sm.department,
  sm.position,
  sm.role,
  sm.can_create_orders,
  sm.can_confirm_transactions,
  sm.can_manage_inventory,
  -- 利用統計
  COUNT(DISTINCT po.id) as purchase_orders_count,
  COUNT(DISTINCT tx.id) as transactions_count,
  MAX(GREATEST(po.created_at, tx.created_at)) as last_activity_at
FROM public.staff_members sm
LEFT JOIN public.purchase_orders po ON sm.id = po.assignee_id
LEFT JOIN public.transactions tx ON sm.id = tx.assignee_id
WHERE sm.status = 'active'
GROUP BY sm.id, sm.name, sm.email, sm.phone, sm.department, sm.position, 
         sm.role, sm.can_create_orders, sm.can_confirm_transactions, sm.can_manage_inventory
ORDER BY sm.name;

-- 5.2 発注用担当者ビュー（権限フィルタ付き）
CREATE OR REPLACE VIEW public.v_purchase_assignees AS
SELECT 
  sm.id,
  sm.name,
  sm.email,
  sm.department,
  sm.position,
  sm.role,
  COUNT(po.id) as orders_handled,
  MAX(po.created_at) as last_order_date,
  CASE 
    WHEN COUNT(po.id) = 0 THEN '未担当'
    WHEN COUNT(po.id) <= 5 THEN '軽負荷'
    WHEN COUNT(po.id) <= 20 THEN '中負荷'  
    ELSE '高負荷'
  END as workload_status
FROM public.staff_members sm
LEFT JOIN public.purchase_orders po ON sm.id = po.assignee_id
WHERE sm.status = 'active' 
  AND sm.can_create_orders = true
GROUP BY sm.id, sm.name, sm.email, sm.department, sm.position, sm.role
ORDER BY 
  CASE sm.role 
    WHEN 'admin' THEN 1 
    WHEN 'manager' THEN 2 
    ELSE 3 
  END,
  orders_handled ASC,  -- 負荷の少ない人を上位に
  sm.name;

-- 5.3 取引担当者ビュー
CREATE OR REPLACE VIEW public.v_transaction_assignees AS
SELECT 
  sm.id,
  sm.name,
  sm.email,
  sm.department,
  COUNT(tx.id) as transactions_handled,
  COUNT(tx.id) FILTER (WHERE tx.status = 'confirmed') as confirmed_transactions,
  MAX(tx.created_at) as last_transaction_date
FROM public.staff_members sm
LEFT JOIN public.transactions tx ON sm.id = tx.assignee_id
WHERE sm.status = 'active' 
  AND sm.can_confirm_transactions = true
GROUP BY sm.id, sm.name, sm.email, sm.department
ORDER BY transactions_handled DESC, sm.name;

-- ===============================================================
-- 6. RPC関数の作成
-- ===============================================================

-- 6.1 担当者取得関数（発注用）
CREATE OR REPLACE FUNCTION public.get_assignees_for_purchase_orders(
  p_include_inactive boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  department text,
  workload_status text,
  orders_handled bigint,
  can_create_orders boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    va.id,
    va.name,
    va.email,
    va.department,
    va.workload_status,
    va.orders_handled,
    sm.can_create_orders
  FROM public.v_purchase_assignees va
  JOIN public.staff_members sm ON va.id = sm.id
  WHERE (p_include_inactive OR sm.status = 'active')
  ORDER BY va.workload_status, va.orders_handled, va.name;
END;
$$;

-- 6.2 担当者情報取得関数（特定発注用）
CREATE OR REPLACE FUNCTION public.get_assignee_for_order(
  p_order_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  department text,
  current_assignee boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id,
    sm.name,
    sm.email,
    sm.phone,
    sm.department,
    (po.assignee_id = sm.id) as current_assignee
  FROM public.staff_members sm
  LEFT JOIN public.purchase_orders po ON po.id = p_order_id
  WHERE sm.status IN ('active', 'inactive')  -- 現在の担当者が非アクティブでも表示
    AND (sm.can_create_orders = true OR po.assignee_id = sm.id)
  ORDER BY 
    (po.assignee_id = sm.id) DESC,  -- 現在の担当者を最上位
    sm.status = 'active' DESC,      -- アクティブを優先
    sm.name;
END;
$$;

-- 6.3 担当者作成関数
CREATE OR REPLACE FUNCTION public.create_staff_member(
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_role text DEFAULT 'staff',
  p_employee_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  created_at timestamptz,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_id uuid;
BEGIN
  -- バリデーション
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN QUERY SELECT 
      NULL::uuid, NULL::text, NULL::text, NULL::timestamptz,
      false, '担当者名は必須です';
    RETURN;
  END IF;
  
  -- 重複チェック
  IF EXISTS (SELECT 1 FROM public.staff_members WHERE name = trim(p_name)) THEN
    RETURN QUERY SELECT 
      NULL::uuid, trim(p_name), NULL::text, NULL::timestamptz,
      false, '同じ名前の担当者が既に存在します';
    RETURN;
  END IF;
  
  -- 担当者作成
  INSERT INTO public.staff_members (
    name, email, phone, department, position, role, employee_id, created_at
  ) VALUES (
    trim(p_name), p_email, p_phone, p_department, p_position, p_role, p_employee_id, NOW()
  ) RETURNING public.staff_members.id, public.staff_members.created_at 
  INTO v_staff_id, create_staff_member.created_at;
  
  -- 成功レスポンス
  RETURN QUERY SELECT 
    v_staff_id,
    trim(p_name),
    p_email,
    create_staff_member.created_at,
    true,
    '担当者を正常に作成しました'::text;
END;
$$;

-- ===============================================================
-- 7. 権限・セキュリティ設定
-- ===============================================================

-- RLS有効化
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- 基本権限設定
GRANT SELECT ON public.staff_members TO anon, authenticated;
GRANT SELECT ON public.v_active_staff_members TO anon, authenticated;
GRANT SELECT ON public.v_purchase_assignees TO anon, authenticated;
GRANT SELECT ON public.v_transaction_assignees TO anon, authenticated;

-- RPC関数の権限
GRANT EXECUTE ON FUNCTION public.get_assignees_for_purchase_orders TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignee_for_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_member TO authenticated;

-- RLSポリシー（基本は全件参照可能、更新は認証済みのみ）
CREATE POLICY staff_members_select_policy ON public.staff_members
  FOR SELECT USING (true);

CREATE POLICY staff_members_insert_policy ON public.staff_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY staff_members_update_policy ON public.staff_members
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ===============================================================
-- 8. データ整合性チェックとレポート
-- ===============================================================

-- 8.1 移行結果レポート関数
CREATE OR REPLACE FUNCTION public.staff_migration_report()
RETURNS TABLE (
  category text,
  item text,
  count bigint,
  details text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- staff_membersの統計
  RETURN QUERY
  SELECT 
    'staff_members'::text,
    'total'::text,
    COUNT(*)::bigint,
    'アクティブ: ' || COUNT(*) FILTER (WHERE status = 'active')::text || 
    ', 非アクティブ: ' || COUNT(*) FILTER (WHERE status != 'active')::text
  FROM public.staff_members;
  
  -- assignee_idマッピング状況（purchase_orders）
  RETURN QUERY
  SELECT 
    'purchase_orders_mapping'::text,
    'mapped'::text,
    COUNT(*) FILTER (WHERE assignee_id IS NOT NULL)::bigint,
    'マッピング済み発注数'::text
  FROM public.purchase_orders;
  
  RETURN QUERY
  SELECT 
    'purchase_orders_mapping'::text,
    'unmapped'::text,
    COUNT(*) FILTER (WHERE assignee_name IS NOT NULL AND assignee_id IS NULL)::bigint,
    'マッピング未完了（要確認）'::text
  FROM public.purchase_orders;
  
  -- assignee_idマッピング状況（transactions）
  RETURN QUERY
  SELECT 
    'transactions_mapping'::text,
    'mapped'::text,
    COUNT(*) FILTER (WHERE assignee_id IS NOT NULL)::bigint,
    'マッピング済み取引数'::text
  FROM public.transactions;
  
  RETURN QUERY
  SELECT 
    'transactions_mapping'::text,
    'unmapped'::text,
    COUNT(*) FILTER (WHERE assignee_name IS NOT NULL AND assignee_id IS NULL)::bigint,
    'マッピング未完了（要確認）'::text
  FROM public.transactions;
END;
$$;

-- ===============================================================
-- 9. 完了処理とログ記録
-- ===============================================================

-- PostgREST スキーマリロード
NOTIFY pgrst, 'reload schema';

-- システムログ記録
INSERT INTO public.system_logs (event_type, event_level, message, details)
VALUES (
  'STAFF_MEMBERS_MIGRATION',
  'INFO',
  'P0緊急対応: staff_membersマスタ化と担当者リスト統一完了',
  jsonb_build_object(
    'staff_members_created', (SELECT COUNT(*) FROM public.staff_members),
    'purchase_orders_mapped', (SELECT COUNT(*) FROM public.purchase_orders WHERE assignee_id IS NOT NULL),
    'transactions_mapped', (SELECT COUNT(*) FROM public.transactions WHERE assignee_id IS NOT NULL),
    'views_created', 3,
    'functions_created', 4
  )
);

-- 完了メッセージ
DO $$ BEGIN
  RAISE NOTICE '🚨 P0緊急対応完了: 担当者リスト統一システム';
  RAISE NOTICE '📊 移行結果確認: SELECT * FROM staff_migration_report();';
  RAISE NOTICE '👥 アクティブ担当者: SELECT * FROM v_purchase_assignees;';
  RAISE NOTICE '🔧 新規担当者作成: SELECT * FROM create_staff_member(''新担当者名'');';
  RAISE NOTICE '⚠️  次のステップ: フロントエンドのドロップダウンを新しいAPIに切り替えてください';
END $$;

COMMIT;