-- RPC関数のテスト
SELECT * FROM check_and_insert_duplicate_detection(
    'test_hash_12345',
    'ae41a1b4-5686-4dd1-abba-7d257c6a4e5e'::uuid,
    'transaction_creation',
    'test_order_123',
    (NOW() + INTERVAL '1 hour')::timestamptz,
    '{"test": true}'::jsonb
);