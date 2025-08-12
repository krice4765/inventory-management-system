## 最新の改善（v0.3.1）

### JSON出力形式の標準化
disk_usageコマンドの出力形式が改善されました：
```json
[
  {"path": "file1.txt", "size": 1024},
  {"path": "directory/file2.txt", "size": 2048}
]
```

### MoveConflictBehaviorの後方互換性
以下のエイリアスが自動正規化されます：
- confirm → ask
- replace → overwrite
- prompt → ask

### ログ出力の分離
- stdout: データ出力専用（JSON/CSV/テーブル）
- stderr: ログ・警告・エラーメッセージ
