# file_management_tool/config.py
"""
Configuration settings for file_management_tool
"""
import logging
from enum import Enum
from typing import Set, Dict, Any, Optional

# ファイル移動時の競合処理動作
class MoveConflictBehavior(Enum):
    """ファイル移動時の競合処理動作を定義"""
    SKIP = "skip"           # 競合時はスキップ
    OVERWRITE = "overwrite" # 競合時は上書き
    RENAME = "rename"       # 競合時は自動リネーム
    ASK = "ask"            # 競合時はユーザーに確認

CONFLICT_BEHAVIOR_ALIASES = {
    'confirm': 'ask',
    'prompt': 'ask', 
    'replace': 'overwrite',
    'overwrite': 'overwrite',
    'skip': 'skip',
    'rename': 'rename'
}

def normalize_conflict_behavior(value):
    """設定値を正規化して有効なMoveConflictBehavior値に変換"""
    if isinstance(value, str):
        return CONFLICT_BEHAVIOR_ALIASES.get(value.lower(), value)
    return value

# アプリケーション設定管理クラス
class Config:
    """file_management_tool の設定を一元管理するクラス"""
    
    def __init__(self):
        # ログ関連設定
        self.log_level = logging.INFO
        self.default_log_file = "app.log"
        
        # 出力形式設定
        self.default_output_format = "json"
        self.supported_output_formats = ["json", "csv", "table"]
        
        # ディスク分析の除外パターン
        self.exclude_patterns = {
            '.git', '.svn', '.hg',
            '__pycache__', '.pytest_cache',
            'venv', 'env', '.venv',
            'node_modules', '.next',
            'dist', 'build', '*.egg-info',
            'archive', 'logs'
        }
        
        # ディスク分析設定
        self.disk_usage_config = {
            'include_hidden': False,
            'follow_symlinks': False,
            'max_depth': None,
            'sort_by': 'size',
            'reverse_sort': True
        }
        
        # ファイル操作設定
        # move_conflict_behavior の読み込みと正規化
        raw_behavior = "ask" # Default value, as no config_data is passed to __init__
        normalized_behavior = normalize_conflict_behavior(raw_behavior)
        
        try:
            self.move_conflict_behavior = MoveConflictBehavior(normalized_behavior)
        except ValueError as e:
            logging.warning(f"無効なmove_conflict_behavior値: {raw_behavior}. デフォルト値'ask'を使用します。")
            self.move_conflict_behavior = MoveConflictBehavior.ASK
        self.max_file_size = 1024 * 1024 * 1024  # 1GB
        self.timeout_seconds = 30
        
        # アプリケーション情報
        self.app_version = "0.3.0"
        self.config_version = "0.1.0"
        
        # 後方互換のための追加項目
        self.scan_paths = ['.']          # 既定のスキャン対象
        self.backup_dir = None           # 既定のバックアップ先（未指定）
        
        # 重複検出関連の設定
        self.duplicate_hash_algorithm = 'md5'
        self.duplicate_min_size = 1
        
        # 既存コードとの互換性のため、内部ストア(dict)を用意
        # move_conflict_behavior は文字列で格納（Enum化は呼び出し側に委ねる）
        self._store = {
            'log_level': self.log_level,
            'default_log_file': self.default_log_file,
            'default_output_format': self.default_output_format,
            'supported_output_formats': self.supported_output_formats,
            'exclude_patterns': set(self.exclude_patterns),
            'disk_usage_config': dict(self.disk_usage_config),
            'move_conflict_behavior': MoveConflictBehavior.ASK.value,
            'max_file_size': self.max_file_size,
            'timeout_seconds': self.timeout_seconds,
            'app_version': self.app_version,
            'config_version': self.config_version,
            'scan_paths': list(self.scan_paths),
            'backup_dir': self.backup_dir,
            'duplicate_hash_algorithm': self.duplicate_hash_algorithm,
            'duplicate_min_size': self.duplicate_min_size,
        }
    
    @property
    def config(self) -> dict:
        """後方互換: 既存コードが期待する dict アクセス"""
        return self._store
    
    def get(self, key: str, default=None):
        """後方互換: dict 風アクセサ"""
        return self._store.get(key, default)
    
    def set(self, key: str, value):
        """後方互換: 設定の更新（属性と_storeを可能な範囲で同期）"""
        self._store[key] = value
        # 代表的な属性は同期しておく
        if hasattr(self, key):
            setattr(self, key, value)
        elif key == 'exclude_patterns':
            self.exclude_patterns = set(value)
        elif key == 'disk_usage_config':
            self.disk_usage_config = dict(value)
        elif key == 'move_conflict_behavior':
            normalized_behavior = normalize_conflict_behavior(value)
            try:
                self.move_conflict_behavior = MoveConflictBehavior(normalized_behavior)
            except ValueError as e:
                logging.warning(f"無効なmove_conflict_behavior値: {value}. 設定は更新されません。エラー: {e}")
    
    def get_exclude_patterns(self) -> Set[str]:
        """除外パターンのコピーを取得"""
        return self.exclude_patterns.copy()
    
    def set_log_level(self, level: int) -> None:
        """ログレベルを設定"""
        self.log_level = level
        self._store['log_level'] = level
    
    def is_supported_format(self, format_name: str) -> bool:
        """サポートされている出力形式かチェック"""
        return format_name.lower() in self.supported_output_formats
    
    def to_dict(self) -> dict:
        """表示用に安全な dict を返す"""
        out = dict(self._store)
        # セット等を文字列/リスト化
        if isinstance(out.get('exclude_patterns'), set):
            out['exclude_patterns'] = sorted(out['exclude_patterns'])
        return out
    
    def save_config(self, path: Optional[str] = None) -> bool:
        """後方互換: 実際の永続化が不要ならTrueを返すスタブ"""
        return True

# 後方互換性のための定数（既存コードとの互換性維持）
DEFAULT_LOG_LEVEL = logging.INFO
LOG_LEVEL = DEFAULT_LOG_LEVEL  # テスト互換性のためのエイリアス
DEFAULT_LOG_FILE = "app.log"

# 出力形式設定
DEFAULT_OUTPUT_FORMAT = "json"
SUPPORTED_OUTPUT_FORMATS = ["json", "csv", "table"]

# ディスク分析の除外パターン
DEFAULT_EXCLUDE_PATTERNS = {
    '.git', '.svn', '.hg',
    '__pycache__', '.pytest_cache',
    'venv', 'env', '.venv',
    'node_modules', '.next',
    'dist', 'build', '*.egg-info',
    'archive', 'logs'
}

# ディスク分析設定
DISK_USAGE_CONFIG = {
    'include_hidden': False,
    'follow_symlinks': False,
    'max_depth': None,
    'sort_by': 'size',
    'reverse_sort': True
}

# アプリケーション情報
APP_VERSION = "0.3.0"
CONFIG_VERSION = "0.1.0"

# デフォルト設定インスタンス
default_config = Config()
