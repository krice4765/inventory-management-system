/**
 * 富士精工様向けシステム - PostgREST安全クエリヘルパー
 * 
 * PostgRESTの厳格な構文要件に準拠した安全なクエリ生成ユーティリティ
 */

// 安全な検索クエリ生成 (将来の実装用)
export const _createSafeSearchQuery = (
  searchTerm: string,
  textColumns: string[],
  numericColumns: string[] = [],
  dateColumns: string[] = []
): string => {
  if (!searchTerm?.trim()) return '';
  
  const escapedTerm = searchTerm.trim().replace(/'/g, "''"); // SQLインジェクション防御
  const like = `%${escapedTerm}%`;
  const conditions: string[] = [];
  
  // テキストカラムの検索
  textColumns.forEach(col => {
    if (col && col.trim()) {
      conditions.push(`${col.trim()}.ilike.${like}`);
    }
  });
  
  // 数値カラムの検索（型キャスト付き）
  numericColumns.forEach(col => {
    if (col && col.trim()) {
      conditions.push(`${col.trim()}::text.ilike.${like}`);
    }
  });
  
  // 日付カラムの検索（型キャスト付き）
  dateColumns.forEach(col => {
    if (col && col.trim()) {
      conditions.push(`${col.trim()}::text.ilike.${like}`);
    }
  });
  
  return conditions.length > 0 ? conditions.join(',') : ''; // スペースなしのカンマ区切り
};

// UUID形式の検証 (将来の実装用)
export const _isValidUUID = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// 安全なSupabaseクエリ実行 (将来の実装用)
export const _executeSafeQuery = async <T>(
  queryBuilder: any,
  fallbackData: T[] = []
): Promise<T[]> => {
  try {
    const { data, error } = await queryBuilder;
    
    if (error) {
      console.warn('クエリエラー（フォールバック使用）:', error.message);
      // 開発環境でのデバッグ情報
      if (process.env.NODE_ENV === 'development') {
        console.warn('Query details:', error);
      }
      return fallbackData;
    }
    
    return Array.isArray(data) ? data : (data ? [data] : fallbackData);
  } catch (err) {
    console.warn('クエリ実行エラー（フォールバック使用）:', err);
    return fallbackData;
  }
};

// 安全なIDベース検索
export const createIdSearchCondition = (searchTerm: string): string => {
  const trimmed = searchTerm.trim();
  if (!trimmed) return '';
  
  const conditions: string[] = [];
  
  // UUID形式の場合のみID検索を追加
  if (_isValidUUID(trimmed)) {
    conditions.push(`id.eq.${trimmed}`);
  }
  
  return conditions.join(',');
};

// 安全な日付範囲検索 (将来の実装用)
export const _createDateRangeCondition = (
  column: string,
  startDate?: string,
  endDate?: string
): string => {
  const conditions: string[] = [];
  
  if (startDate && column) {
    conditions.push(`${column}.gte.${startDate}T00:00:00.000Z`);
  }
  
  if (endDate && column) {
    // 指定日の23:59:59.999まで
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayISO = nextDay.toISOString().split('T')[0];
    conditions.push(`${column}.lt.${nextDayISO}T00:00:00.000Z`);
  }
  
  return conditions.join(',');
};

// 複合検索条件の結合 (将来の実装用)
export const _combineSearchConditions = (...conditions: string[]): string => {
  const validConditions = conditions.filter(cond => cond && cond.trim());
  return validConditions.length > 0 ? validConditions.join(',') : '';
};