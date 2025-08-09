# file-management-tool v0.3.0

**file-management-tool** は、ディスク使用量の分析、重複ファイルの検出・管理など、ファイル整理を効率化するための高機能CLIツールです。v0.3.0では、APIの拡張性を高めるための重要な改善と、本番運用に対応するための品質保証基盤が確立されました。

---

## ⚠️ 重要な変更（v0.3.0）

**v0.3.0は破壊的変更を含みます。** `disk_usage` コマンドのJSON出力形式が変更されました。v0.2.x以前のバージョンからアップデートする際は、スクリプトやアプリケーションの修正が必要です。

- **旧形式 (v0.2.x以前):** `[["path/to/file", 1024], ...]` (タプルの配列)
- **新形式 (v0.3.0以降):** `[{"path": "path/to/file", "size": 1024}, ...]` (辞書の配列)

詳細は [JSON出力形式](#json出力形式) および、より詳しい移行手順は `docs/migration_0.3.0.md` を参照してください。

---

## 主な特徴

- **ディスク使用量分析:** 指定したディレクトリのファイルサイズを分析し、大きい順に一覧表示。
- **重複ファイル管理:** 重複ファイルを検出し、削除や移動が可能。
- **柔軟な出力形式:** `log` (人間可読), `json`, `csv` 形式での出力に対応。
- **堅牢なログ管理:** 実行結果 (stdout) とログ (stderr) を分離し、パイプライン処理や本番運用を容易に。
- **UTF-8保証:** `--output-file` オプションにより、文字化けの心配がないUTF-8エンコーディングのファイルを確実に出力。

## インストール方法

1.  **前提条件:**
    - Python 3.9以上

2.  **リポジトリのクローン:**
    ```bash
    git clone https://github.com/your-username/file-management-tool.git
    cd file-management-tool
    ```

3.  **依存関係のインストール:**
    現在、追加の依存関係はありません。

## 基本使用法

### ディスク使用量の分析

カレントディレクトリのディスク使用量を分析し、JSON形式で出力します。

```bash
python file_manager_cli.py disk_usage --output-format json
```

### 重複ファイルの検出

指定したパスから重複ファイルを検出し、一覧表示します。

```bash
python file_manager_cli.py duplicate list --path /path/to/your/directory
```

### 重複ファイルの削除（ドライラン）

実際に削除はせず、削除対象となるファイルを確認します。

```bash
python file_manager_cli.py duplicate remove --path /path/to/your/directory --dry-run
```

## JSON出力形式

v0.3.0では、`disk_usage`コマンドのJSON出力が、より構造化され拡張性の高い辞書配列形式に変更されました。

- **旧形式（タプル配列）**
  ```json
  [
    [
      "C:\Users\user\Documents\report.docx",
      15360
    ],
    [
      "C:\Users\user\Documents\archive.zip",
      10240
    ]
  ]
  ```

- **新形式（辞書配列）**
  ```json
  [
    {
      "path": "C:\Users\user\Documents\report.docx",
      "size": 15360
    },
    {
      "path": "C:\Users\user\Documents\archive.zip",
      "size": 10240
    }
  ]
  ```

### 移行例

Pythonで古い形式の出力をパースしている場合、以下のように修正が必要です。

- **Before (旧形式)**
  ```python
  import json
  data = json.loads(cli_output)
  for item in data:
      file_path = item[0]
      file_size = item[1]
      print(f"{file_path}: {file_size} bytes")
  ```

- **After (新形式)**
  ```python
  import json
  data = json.loads(cli_output)
  for item in data:
      file_path = item['path']
      file_size = item['size']
      print(f"{file_path}: {file_size} bytes")
  ```

## オプション解説

- `--output-format <format>`: 出力形式を `log`, `json`, `csv` から選択します。
- `--output-file <filepath>`: 結果を指定したファイルに出力します。このオプションを使用すると、**UTF-8エンコーディングが保証**され、Windows環境でのリダイレクト (`>`) に伴う文字化け問題（CP932など）を回避できます。
- `--path <directory>`: 分析や検索の対象となるディレクトリを指定します。
- `--dry-run`: ファイルの変更（削除など）を伴う操作を実際には行わず、実行結果のみを表示します。

## ログ管理

v0.3.0から、出力ストリームが明確に分離されました。

- **`stdout` (標準出力):** コマンドの実行結果（JSONやCSVデータなど）のみが出力されます。
- **`stderr` (標準エラー出力):** INFOレベル以上の実行ログ（処理の開始、終了、警告など）が出力されます。
- **`app.log`:** ファイルには、より詳細なログが記録されます。

この設計により、`jq` などのツールと連携しやすくなりました。

```bash
# 実行結果をjqでフィルタリングし、ログはコンソールに表示
python file_manager_cli.py disk_usage --output-format json | jq '.[] | select(.size > 1000000)'
```

## トラブルシューティング

### Windows環境でリダイレクトすると文字化けする

WindowsのコマンドプロンプトやPowerShellで `>` を使用して出力をファイルに保存すると、デフォルトのエンコーディング（CP932など）が使われるため、JSONが文字化けすることがあります。

**解決策:** `--output-file` オプションを使用してください。これにより、ツールが直接UTF-8でファイルを書き込むため、問題が解決します。

```bash
# NG: 文字化けの可能性あり
python file_manager_cli.py disk_usage --output-format json > output.json

# OK: UTF-8が保証される
python file_manager_cli.py disk_usage --output-format json --output-file output.json
```