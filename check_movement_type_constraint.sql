-- movement_type制約の確認と修正

-- Step 1: 現在の制約を確認
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'inventory_movements'::regclass
AND contype = 'c'  -- check constraint
AND conname LIKE '%movement_type%';

-- Step 2: 現在のmovement_type値を確認
SELECT
    movement_type,
    COUNT(*) as count
FROM inventory_movements
GROUP BY movement_type
ORDER BY movement_type;

-- Step 3: 制約の詳細確認
SELECT
    'movement_type制約詳細' as info,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'inventory_movements'
AND column_name = 'movement_type'
AND table_schema = 'public';