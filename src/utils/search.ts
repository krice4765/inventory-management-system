/**
 * 日本語検索のための文字列正規化
 * 全角/半角、大文字/小文字、空白の統一
 */
export const normalizeForSearch = (text: string): string => {
  if (!text) return '';
  
  return text
    .normalize('NFKC') // Unicode正規化
    .toLowerCase()
    .replace(/\s+/g, ' ') // 複数空白を単一空白に
    .trim();
};

/**
 * 検索キーワードでのマッチング判定
 */
export const matchesSearch = (target: string, keyword: string): boolean => {
  if (!keyword) return true;
  
  const normalizedTarget = normalizeForSearch(target);
  const normalizedKeyword = normalizeForSearch(keyword);
  
  return normalizedTarget.includes(normalizedKeyword);
};