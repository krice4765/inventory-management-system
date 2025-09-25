-- tax_display_settingsテーブルのRLSポリシー修正
-- 作成・更新権限の追加

-- ===============================================
-- 現在のポリシー状況確認
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔍 現在のRLSポリシー状況を確認中...';
END $$;

-- 現在のポリシーを確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'tax_display_settings';

-- ===============================================
-- INSERTとUPDATE権限の追加
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 tax_display_settings INSERT/UPDATE権限追加開始';

    -- INSERT権限ポリシーの追加
    DROP POLICY IF EXISTS "tax_display_settings_insert" ON tax_display_settings;
    CREATE POLICY "tax_display_settings_insert" ON tax_display_settings
        FOR INSERT TO authenticated
        WITH CHECK (user_id = auth.uid());

    RAISE NOTICE '✅ INSERT権限ポリシーを追加しました';

    -- UPDATE権限ポリシーの追加
    DROP POLICY IF EXISTS "tax_display_settings_update" ON tax_display_settings;
    CREATE POLICY "tax_display_settings_update" ON tax_display_settings
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());

    RAISE NOTICE '✅ UPDATE権限ポリシーを追加しました';

    -- SELECT権限ポリシーの更新（ユーザー制限を追加）
    DROP POLICY IF EXISTS "tax_display_settings_select" ON tax_display_settings;
    CREATE POLICY "tax_display_settings_select" ON tax_display_settings
        FOR SELECT TO authenticated
        USING (user_id = auth.uid() OR setting_type = 'organization');

    RAISE NOTICE '✅ SELECT権限ポリシーを更新しました';

    RAISE NOTICE '✅ tax_display_settings RLSポリシー設定完了';
END $$;

-- ===============================================
-- 権限確認
-- =======================================

































































========

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RLSポリシー修正が完了しました！';
    RAISE NOTICE '';
    RAISE NOTICE '設定されたポリシー:';
    RAISE NOTICE '- INSERT: 自分のuser_idのレコードのみ作成可能';
    RAISE NOTICE '- UPDATE: 自分のuser_idのレコードのみ更新可能';
    RAISE NOTICE '- SELECT: 自分のuser_idまたは組織設定のレコードを取得可能';
    RAISE NOTICE '';
    RAISE NOTICE '確認SQL:';
    RAISE NOTICE '  SELECT * FROM pg_policies WHERE tablename = ''tax_display_settings'';';
    RAISE NOTICE '';
END $$;
