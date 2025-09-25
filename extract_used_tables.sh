#!/bin/bash
# コードベースで使用されているテーブル名を抽出

echo "=== プロジェクトで使用されているテーブル一覧 ==="
echo ""

# src配下のtsファイルから.from('table_name')パターンを抽出
grep -r "\.from('" src/ --include="*.ts" --include="*.tsx" | \
    sed -n "s/.*\.from('\([^']*\)').*/\1/p" | \
    sort | uniq -c | sort -nr

echo ""
echo "=== Hooks・APIで使用されているテーブル ==="
echo ""

# フックやAPIファイルから特に重要なテーブル参照を抽出
grep -r "select.*from\|\.from(" src/hooks/ src/api/ src/lib/ --include="*.ts" --include="*.tsx" | \
    grep -v "console.log\|comment" | \
    head -20

echo ""
echo "=== 型定義で参照されているテーブル構造 ==="
echo ""

# 型定義からテーブル構造を推定
find src/ -name "*.ts" -exec grep -l "interface.*Order\|type.*Order\|interface.*Product\|interface.*Inventory" {} \;