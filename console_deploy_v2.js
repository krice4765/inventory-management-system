// ブラウザコンソールでv2関数をデプロイし、分納番号バグを修正
// http://localhost:5174/ のコンソールで実行

console.log('🔧 分納番号修正: v2関数デプロイ開始...');

// 1. まず現在の関数を確認
const checkFunctions = async () => {
  const { data, error } = await supabase
    .from('information_schema.routines')
    .select('routine_name')
    .like('routine_name', '%installment%');

  console.log('📋 現在の分納関数:', data);
  return data;
};

// 2. v2関数をデプロイ
const deployV2Function = async () => {
  const sqlQuery = `
    CREATE OR REPLACE FUNCTION public.add_purchase_installment_v2(
      p_parent_order_id uuid,
      p_amount numeric,
      p_status text DEFAULT 'confirmed',
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
    SECURITY DEFINER
    AS $$
    DECLARE
      v_order_total numeric;
      v_allocated_total numeric;
      v_next_installment integer;
      v_order_no text;
      v_transaction_no text;
      v_partner_id uuid;
      v_transaction_date date := CURRENT_DATE;
    BEGIN
      -- 排他ロック
      PERFORM 1 FROM public.purchase_orders WHERE id = p_parent_order_id FOR UPDATE;

      -- 発注情報取得
      SELECT total_amount, order_no, partner_id
      INTO v_order_total, v_order_no, v_partner_id
      FROM public.purchase_orders
      WHERE id = p_parent_order_id;

      IF v_order_total IS NULL THEN
        RAISE EXCEPTION '指定された発注が見つかりません: %', p_parent_order_id;
      END IF;

      -- 既存分納合計計算
      SELECT COALESCE(SUM(total_amount), 0)
      INTO v_allocated_total
      FROM public.transactions
      WHERE parent_order_id = p_parent_order_id
        AND transaction_type = 'purchase';

      -- 金額超過チェック
      IF (v_allocated_total + p_amount) > v_order_total THEN
        RAISE EXCEPTION '分納合計が発注金額を超過します';
      END IF;

      -- 🚨 重要: 正しい分納番号計算（1から開始）
      SELECT COALESCE(MAX(installment_no), 0) + 1
      INTO v_next_installment
      FROM public.transactions
      WHERE parent_order_id = p_parent_order_id
        AND transaction_type = 'purchase';

      -- 伝票番号生成
      SELECT 'TXN' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(EXTRACT(EPOCH FROM NOW())::bigint % 100000, 5, '0')
      INTO v_transaction_no;

      -- 分納挿入
      RETURN QUERY
      INSERT INTO public.transactions (
        id,
        transaction_type,
        transaction_no,
        partner_id,
        parent_order_id,
        installment_no,
        delivery_sequence,
        transaction_date,
        due_date,
        status,
        total_amount,
        memo,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        'purchase',
        v_transaction_no,
        v_partner_id,
        p_parent_order_id,
        v_next_installment,
        v_next_installment,
        v_transaction_date,
        p_due_date,
        p_status,
        p_amount,
        COALESCE(p_memo, '第' || v_next_installment || '回'),
        NOW(),
        NOW()
      )
      RETURNING
        transactions.id,
        transactions.parent_order_id,
        transactions.installment_no,
        transactions.transaction_no,
        transactions.status,
        transactions.total_amount,
        transactions.memo,
        transactions.transaction_date,
        transactions.due_date,
        transactions.created_at;
    END;
    $$;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlQuery });
    if (error) {
      console.error('❌ v2関数デプロイエラー:', error);
      return false;
    }
    console.log('✅ add_purchase_installment_v2関数デプロイ完了');
    return true;
  } catch (e) {
    console.error('❌ 関数作成エラー:', e);
    return false;
  }
};

// 3. 権限設定
const setPermissions = async () => {
  const permissions = [
    "GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2 TO authenticated;",
    "GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2 TO anon;"
  ];

  for (const perm of permissions) {
    try {
      await supabase.rpc('exec_sql', { sql: perm });
      console.log('✅ 権限設定完了:', perm);
    } catch (e) {
      console.warn('⚠️ 権限設定スキップ:', e.message);
    }
  }
};

// 4. 実行
const fixInstallmentBug = async () => {
  console.log('🚀 分納番号バグ修正開始...');

  // 関数確認
  await checkFunctions();

  // v2関数デプロイ
  const deployed = await deployV2Function();
  if (deployed) {
    await setPermissions();
    console.log('🎉 修正完了！新規分納で「第1回」が正しく表示されます');
    console.log('📝 次回分納テスト: PO250920003で新しい分納を作成してください');
  } else {
    console.error('❌ 修正失敗。手動でSQLを実行してください');
  }
};

// 実行
fixInstallmentBug();