import os
import shutil
import logging
import sys
import json
import csv
import io
from pathlib import Path
from datetime import datetime
from enum import Enum
from typing import Optional, Any, List, Dict, Union

logger = logging.getLogger(__name__)

class MoveConflictBehavior(Enum):
    """ファイル移動時の競合動作を定義する列挙型"""
    ASK = 'ask'
    SKIP = 'skip'
    OVERWRITE = 'overwrite'
    RENAME = 'rename'
    BACKUP = 'backup'
    QUIT = 'quit'
    ALL_SKIP = 'all-skip'
    ALL_OVERWRITE = 'all-overwrite'

class InterruptedByUserError(Exception):
    """ユーザーが処理を中断したときに発生するカスタム例外"""
    pass

def ensure_directory_exists(path: Union[str, Path]):
    """指定されたパスのディレクトリが存在することを確認し、必要に応じて作成します。"""
    Path(path).mkdir(parents=True, exist_ok=True)

def get_absolute_path(relative_path: Union[str, Path], base_path: Optional[Union[str, Path]] = None) -> str:
    """相対パスを絶対パスに変換します。"""
    if base_path is None:
        base_path = Path.cwd()
    else:
        base_path = Path(base_path)
    
    path = Path(relative_path)
    if path.is_absolute():
        return str(path)
    else:
        return str(base_path / path)

def get_file_size(file_path: Union[str, Path]) -> int:
    """ファイルのサイズをバイト単位で取得します。"""
    try:
        return Path(file_path).stat().st_size
    except OSError:
        return 0

def format_bytes(size: int) -> str:
    """バイト単位のサイズを人間が読める形式に変換します。"""
    if size < 1024:
        return f"{size} B"
    elif size < 1024**2:
        return f"{size / 1024:.2f} KB"
    elif size < 1024**3:
        return f"{size / 1024**2:.2f} MB"
    elif size < 1024**4:
        return f"{size / 1024**3:.2f} GB"
    else:
        return f"{size / 1024**4:.2f} TB"

def backup_file(file_path: str, backup_dir: str) -> Optional[str]:
    """ファイルを指定されたバックアップディレクトリにコピーします。"""
    try:
        backup_dir_path = Path(backup_dir)
        backup_dir_path.mkdir(parents=True, exist_ok=True)
        
        source_path = Path(file_path)
        if not source_path.exists():
            logger.warning(f"バックアップ元ファイルが見つかりません: {file_path}")
            return None
            
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        backup_filename = f"{source_path.name}.{timestamp}.bak"
        backup_path = backup_dir_path / backup_filename
        
        shutil.copy2(source_path, backup_path)
        logger.info(f"ファイル '{file_path}' を '{backup_path}' にバックアップしました。")
        return str(backup_path)
    except Exception as e:
        logger.error(f"ファイルのバックアップに失敗しました '{file_path}' から '{backup_dir}': {e}")
        return None

def restore_file(backup_path: str, original_filepath: str) -> bool:
    """バックアップファイルから元の場所にファイルを復元します。"""
    try:
        backup_path_obj = Path(backup_path)
        original_path_obj = Path(original_filepath)
        
        if not backup_path_obj.exists():
            logger.error(f"バックアップファイルが見つかりません: {backup_path}")
            return False
            
        # 元ファイルのディレクトリを作成
        original_path_obj.parent.mkdir(parents=True, exist_ok=True)
        
        # ファイルをコピー（メタデータも含む）
        shutil.copy2(backup_path_obj, original_path_obj)
        logger.info(f"ファイルを復元しました: {backup_path} -> {original_filepath}")
        return True
        
    except Exception as e:
        logger.error(f"ファイルの復元に失敗しました: {backup_path} -> {original_filepath} - {e}")
        return False

def generate_unique_filename(original_path: Path) -> Path:
    """既存のファイル名に基づいてユニークなファイル名を生成します。"""
    counter = 1
    new_path = original_path
    while new_path.exists():
        name = original_path.stem
        suffix = original_path.suffix
        new_path = original_path.parent / f"{name}_{counter}{suffix}"
        counter += 1
    return new_path

def interactive_conflict_resolution(source_path: str, target_path: str, source_size: int, target_size: int, source_mtime: float, target_mtime: float) -> str:
    """ファイル移動時の競合を対話的に解決します。"""
    try:
        print(f"\n{'='*60}")
        print(f"競合を検出: {target_path}")
        print(f"移動元: {source_path} ({format_bytes(source_size)})")
        print(f"移動先: {target_path} ({format_bytes(target_size)})")
        
        source_time = datetime.fromtimestamp(source_mtime).strftime('%Y-%m-%d %H:%M:%S')
        target_time = datetime.fromtimestamp(target_mtime).strftime('%Y-%m-%d %H:%M:%S')
        print(f"移動元更新日時: {source_time}")
        print(f"移動先更新日時: {target_time}")
        print(f"{'='*60}")
        
        while True:
            choice = input("処理を選択 [s]kip/[o]verwrite/[r]ename/[a]ll-skip/[q]uit/[b]ackup: ").lower().strip()
            if choice in ['s', 'skip']:
                return 'skip'
            elif choice in ['o', 'overwrite']:
                return 'overwrite'
            elif choice in ['r', 'rename']:
                return 'rename'
            elif choice in ['a', 'all-skip']:
                return 'all-skip'
            elif choice in ['q', 'quit']:
                return 'quit'
            elif choice in ['b', 'backup']:
                return 'backup'
            else:
                print("無効な選択です。")
    except (EOFError, KeyboardInterrupt):
        logger.info("入力処理が中断されました。自動的にskipを選択します。")
        return 'skip'

def safe_move_file(source_path, destination_path, conflict_behavior=MoveConflictBehavior.SKIP, backup_dir=None, all_skip_active=False):
    """
    ファイルを安全に移動します。【重要な修正を含む】
    """
    logger.debug(f"safe_move_file called: source={source_path}, dest={destination_path}, conflict={conflict_behavior}")
    
    if all_skip_active:
        logger.info(f"All-skipモードのためスキップ: {source_path}")
        return False, True
        
    try:
        source_path = Path(source_path)
        destination_path = Path(destination_path)
        
        # 防御的型変換：文字列が渡された場合にEnumに変換
        if isinstance(conflict_behavior, str):
            try:
                conflict_behavior = MoveConflictBehavior(conflict_behavior)
            except ValueError:
                logger.warning(f"未知の競合動作 '{conflict_behavior}' が指定されたため ASK にフォールバックします。")
                conflict_behavior = MoveConflictBehavior.ASK
        
        logger.debug(f"Resolved paths: source={source_path.resolve()}, dest={destination_path.resolve()}")

        if not source_path.exists():
            logger.error(f"移動元ファイルが存在しません: {source_path}")
            return False, all_skip_active

        # 【重要な修正】宛先がディレクトリの場合、ファイルパスに解決
        if destination_path.exists() and destination_path.is_dir():
            logger.debug(f"Destination is an existing directory: {destination_path}. Resolving to file path inside it.")
            destination_path = destination_path / source_path.name
        
        # 親ディレクトリの作成を確実に実行
        destination_path.parent.mkdir(parents=True, exist_ok=True)

        # ファイルとしての存在チェック（ディレクトリ解決後）
        if destination_path.exists():
            logger.debug(f"Destination file exists: {destination_path}")
            
            if conflict_behavior == MoveConflictBehavior.ASK:
                if not (sys.stdin and sys.stdin.isatty()):
                    logger.info(f"非対話的環境のため、競合ファイル {destination_path} を上書きします。")
                    action = 'overwrite'
                else:
                    logger.warning(f"Interactive mode for ASK conflict behavior is not fully implemented. Defaulting to overwrite for {destination_path}")
                    action = 'overwrite'

            if action == 'skip':
                logger.info(f"競合のためスキップします: {destination_path}")
                return False, all_skip_active
            elif action == 'quit':
                logger.info("ユーザーの選択により処理を中断します。")
                raise InterruptedByUserError("User chose to quit.")
            elif action == 'all-skip':
                logger.info("All-skipモードを有効化しました。")
                return False, True
            elif action == 'rename':
                destination_path = generate_unique_filename(destination_path)
                logger.info(f"ファイル名を変更して移動します: {destination_path}")
            elif action == 'backup':
                if backup_dir:
                    backup_result = backup_file(str(destination_path), backup_dir)
                    if not backup_result: # backup_file returns str or None
                        logger.error(f"バックアップの作成に失敗しました: {destination_path}")
                        return False, all_skip_active
                else:
                    logger.error("バックアップディレクトリが指定されていません")
                    return False, all_skip_active
            elif action == 'overwrite':
                logger.debug(f"Overwriting existing file: {destination_path}")
        else:
            logger.info(f"Destination file does not exist: {destination_path}, proceeding with direct move.")

        shutil.move(str(source_path), str(destination_path))
        logger.info(f"ファイル移動完了: {source_path} -> {destination_path}")
        return True, all_skip_active
        
    except InterruptedByUserError:
        raise
    except Exception as e:
        logger.error(f"移動中にエラーが発生しました {source_path} から {destination_path}: {e}")
        return False, all_skip_active

def format_output(data: Any, format_type: str, output_file: Optional[str] = None, command: Optional[str] = None, columns: Optional[List[str]] = None, sort_by: Optional[str] = None, filter_by: Optional[str] = None):
    """データを指定された形式でフォーマットして出力します。"""
    output = ""
    
    try:
        if format_type == "json":
            if command == "disk_usage":
                try:
                    json.dump(data, sys.stdout, ensure_ascii=False)
                    sys.stdout.write('\n')
                    sys.stdout.flush()
                    return # Exit after direct output
                except Exception as e:
                    logger.error(f"JSON出力エラー: {e}")
                    sys.exit(1)
            else:
                output = json.dumps(data, indent=2, ensure_ascii=False)
        elif format_type == "csv":
            if isinstance(data, list) and data:
                output_buffer = io.StringIO()
                if isinstance(data[0], dict):
                    fieldnames = columns or list(data[0].keys())
                    writer = csv.DictWriter(output_buffer, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(data)
                else:
                    writer = csv.writer(output_buffer)
                    writer.writerows(data)
                output = output_buffer.getvalue()
        elif format_type in ("table", "text"):
            if isinstance(data, list) and data:
                if isinstance(data[0], dict):
                    # 簡易テーブル形式
                    headers = columns or list(data[0].keys())
                    output = " | ".join(headers) + "\n"
                    output += "-" * len(output) + "\n"
                    for row in data:
                        output += " | ".join(str(row.get(h, "")) for h in headers) + "\n"
                else:
                    output = "\n".join(str(item) for item in data)
            else:
                output = str(data)
        else:
            output = str(data)
    except Exception as e:
        logger.error(f"出力整形中にエラーが発生しました: {e}")
        output = str(data)

    if output_file:
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output)
            logger.info(f"出力をファイルに保存しました: {output_file}")
        except Exception as e:
            logger.error(f"ファイル出力中にエラーが発生しました: {e}")
    
    return output

__all__ = [
    'MoveConflictBehavior',
    'InterruptedByUserError',
    'safe_move_file',
    'backup_file',
    'restore_file',
    'format_output',
    'get_absolute_path',
    'ensure_directory_exists',
    'get_file_size',
    'format_bytes',
    'generate_unique_filename',
    'interactive_conflict_resolution',
]