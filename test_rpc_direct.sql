-- 🧪 RPC関数の直接テスト
-- ブラウザで送信されているのと同じパラメータでテスト

-- まず既存のpartnerを確認
SELECT id, name FROM partners LIMIT 5;

-- RPC関数を直接実行（ブラウザと同じパラメータ）
SELECT create_purchase_order(
    'TEST-DIRECT-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    (SELECT id FROM partners LIMIT 1),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    100000.00,
    'active',
    'Direct Test from SQL'
);

-- 関数の存在と権限を再確認
SELECT
    routine_name,
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'create_purchase_order';

-- 関数の権限を確認
SELECT
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'create_purchase_order';