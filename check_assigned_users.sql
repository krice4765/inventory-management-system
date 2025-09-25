-- 発注担当者として登録されているユーザーを確認
SELECT
    id,
    full_name,
    role,
    can_manage_orders,
    department,
    updated_at
FROM profiles
WHERE can_manage_orders = true
ORDER BY full_name;

-- 全ユーザーの権限状況確認
SELECT
    id,
    full_name,
    role,
    can_manage_orders,
    can_manage_inventory,
    department
FROM profiles
ORDER BY full_name;