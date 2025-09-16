-- duplicate_detection_records テーブルの作成
-- 分納処理の重複検出システムに必要

CREATE TABLE IF NOT EXISTS public.duplicate_detection_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL,
    operation_hash VARCHAR(255) NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_hash ON public.duplicate_detection_records (operation_hash);
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_session ON public.duplicate_detection_records (session_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_expires ON public.duplicate_detection_records (expires_at);

-- ユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS idx_duplicate_detection_unique_hash_expires
ON public.duplicate_detection_records (operation_hash, expires_at);

-- RLS (Row Level Security) 設定
ALTER TABLE public.duplicate_detection_records ENABLE ROW LEVEL SECURITY;

-- 認証されたユーザーのアクセス許可
DROP POLICY IF EXISTS "Authenticated users can manage duplicate detection records" ON public.duplicate_detection_records;
CREATE POLICY "Authenticated users can manage duplicate detection records"
ON public.duplicate_detection_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 過去のレコードクリーンアップ用の関数
CREATE OR REPLACE FUNCTION cleanup_expired_duplicate_detection_records()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.duplicate_detection_records
    WHERE expires_at < NOW();
END;
$$;