import os
from pathlib import Path
import shutil
import logging
from datetime import datetime
from typing import List, Optional, Tuple
import zipfile
import json
import csv
import io
import pprint

from file_management_tool.config import MoveConflictBehavior

logger = logging.getLogger(__name__)

def get_absolute_path(relative_path, base_path=None):
    if base_path is None:
        base_path = Path.cwd()
    return Path(base_path).joinpath(relative_path).resolve()

def ensure_directory_exists(path):
    Path(path).mkdir(parents=True, exist_ok=True)

def get_file_size(file_path):
    return Path(file_path).stat().st_size

def format_bytes(size: int) -> str:
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

def generate_unique_filename(file_path: Path) -> Path:
    if not file_path.exists():
        return file_path
    stem = file_path.stem
    suffix = file_path.suffix
    parent = file_path.parent
    counter = 1
    while True:
        new_name = f"{stem} ({counter}){suffix}"
        new_path = parent / new_name
        if not new_path.exists():
            return new_path
        counter += 1

def interactive_conflict_resolution(source_path: str, target_path: str, source_size: int, target_size: int, source_mtime: float, target_mtime: float) -> str:
    import sys
    logger = logging.getLogger(__name__)
    if not sys.stdin.isatty():
        logger.info(f"非対話的環境を検出。ファイル競合を自動的にスキップします: {source_path}")
        return 'skip'
    try:
        print(f"\n{'='*60}")
        print(f"ファイル競合が発生しました:")
        print(f"移動元: {source_path}")
        print(f"移動先: {target_path}")
        print(f"移動元サイズ: {source_size} bytes")
        print(f"移動先サイズ: {target_size} bytes")
        source_time = datetime.fromtimestamp(source_mtime).strftime('%Y-%m-%d %H:%M:%S')
        target_time = datetime.fromtimestamp(target_mtime).strftime('%Y-%m-%d %H:%M:%S')
        print(f"移動元更新日時: {source_time}")
        print(f"移動先更新日時: {target_time}")
        print(f"{'='*60}")
        while True:
            choice = input("処理を選択 [s]kip/[o]verwrite/[r]ename/[a]ll-skip/[q]uit: ").lower().strip()
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
            else:
                print("無効な選択です。s/o/r/a/q のいずれかを入力してください。")
    except (EOFError, KeyboardInterrupt):
        logger.info("入力処理が中断されました。自動的にskipを選択します。")
        return 'skip'

class InterruptedByUserError(Exception):
    pass

def safe_move_file(source_path, destination_path, conflict_behavior=MoveConflictBehavior.SKIP, backup_dir=None, all_skip_active=False):
    if all_skip_active:
        logger.info(f"All-skipモードのためスキップ: {source_path}")
        return False, True
    try:
        source_path = Path(source_path)
        destination_path = Path(destination_path)
        if not source_path.exists():
            logger.error(f"移動元ファイルが存在しません: {source_path}")
            return False, all_skip_active
        try:
            source_stat = source_path.stat()
            source_size = source_stat.st_size
            source_mtime = source_stat.st_mtime
        except OSError as e:
            logger.error(f"移動元ファイルの情報取得に失敗: {source_path}, エラー: {e}")
            return False, all_skip_active
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        if destination_path.exists():
            try:
                target_stat = destination_path.stat()
                target_size = target_stat.st_size
                target_mtime = target_stat.st_mtime
            except OSError as e:
                logger.warning(f"移動先ファイル情報取得失敗: {destination_path}, エラー: {e}")
                target_size = None
                target_mtime = None
            action = 'skip'
            if conflict_behavior == MoveConflictBehavior.CONFIRM:
                if target_size is not None and target_mtime is not None:
                    action = interactive_conflict_resolution(
                        str(source_path), str(destination_path),
                        source_size, target_size,
                        source_mtime, target_mtime
                    )
                else:
                    logger.warning(f"移動先ファイルのメタデータを取得できなかったため、競合解決をスキップします: {destination_path}")
                    action = 'skip'
            elif conflict_behavior != MoveConflictBehavior.SKIP:
                 action = conflict_behavior.value
            if action == 'skip':
                logger.info(f"競合のためスキップします: {destination_path}")
                return False, all_skip_active
            elif action == 'quit':
                logger.info("ユーザーの選択により処理を中断します。")
                raise InterruptedByUserError("User chose to quit.")
            elif action == 'all-skip':
                logger.info("All-skipモードを有効化しました。以降の競合はすべてスキップされます。")
                return False, True
            elif action == 'rename':
                destination_path = generate_unique_filename(destination_path)
                logger.info(f"ファイル名を変更して移動します: {destination_path}")
            elif action == 'backup':
                 if backup_dir:
                    backup_path = backup_file(str(destination_path), backup_dir)
                    if not backup_path:
                        logger.error(f"バックアップの作成に失敗しました: {destination_path}")
                        return False, all_skip_active
                 else:
                    logger.error("バックアップディレクトリが指定されていません")
                    return False, all_skip_active
        shutil.move(str(source_path), str(destination_path))
        return True, all_skip_active
    except InterruptedByUserError:
        raise
    except Exception as e:
        logger.error(f"ファイル移動中にエラーが発生しました: {e}")
        return False, all_skip_active

def backup_file(filepath: str, backup_dir: str) -> str | None:
    if not os.path.exists(filepath):
        logger.warning(f"バックアップ元ファイルが見つかりません: {filepath}")
        return None
    backup_dir_abs = get_absolute_path(backup_dir)
    ensure_directory_exists(backup_dir_abs)
    base_name = os.path.basename(filepath)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S_%f")
    backup_filename = f"{base_name}.{timestamp}.bak"
    backup_path = os.path.join(backup_dir_abs, backup_filename)
    try:
        shutil.copy2(filepath, backup_path)
        logger.info(f"ファイルをバックアップしました: {filepath} -> {backup_path}")
        return backup_path
    except OSError as e:
        logger.error(f"ファイルのバックアップに失敗しました: {filepath} -> {backup_path} - {e}")
        return None

def restore_file(backup_path: str, original_filepath: str) -> bool:
    if not os.path.exists(backup_path):
        logger.error(f"バックアップファイルが見つかりません: {backup_path}")
        return False
    original_dir = os.path.dirname(original_filepath)
    ensure_directory_exists(original_dir)
    try:
        shutil.copy2(backup_path, original_filepath)
        logger.info(f"ファイルを復元しました: {backup_path} -> {original_filepath}")
        return True
    except OSError as e:
        logger.error(f"ファイルの復元に失敗しました: {backup_path} -> {original_filepath} - {e}")
        return False

def format_output(data, format_type, output_file=None, command=None, columns=None, sort_by=None, filter_by=None):
    output = ""
    if format_type == "json":
        import json
        if command == "disk_usage":
            # disk_usageの場合、タプルのリストを辞書のリストに変換
            formatted_data = []
            for p, s in data:
                formatted_data.append({"path": str(p), "size": s})
            output = json.dumps(formatted_data, ensure_ascii=False, indent=2)
        else:
            output = json.dumps(data, ensure_ascii=False, indent=2)
    elif format_type == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        if command == "disk_usage" and isinstance(data, list):
            writer.writerow(["path", "size"])
            for row in data:
                if isinstance(row, (list, tuple)) and len(row) >= 2:
                    writer.writerow([row[0], row[1]])
                elif isinstance(row, dict):
                    writer.writerow([row.get("path", ""), row.get("size", "")])
        else:
            if isinstance(data, list) and data and isinstance(data[0], dict):
                writer.writerow(data[0].keys())
                for row in data:
                    writer.writerow(row.values())
            else:
                writer.writerow([str(data)])
        output = buf.getvalue()
        buf.close()
    else:
        output = pprint.pformat(data)
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(output)
    else:
        print(output)