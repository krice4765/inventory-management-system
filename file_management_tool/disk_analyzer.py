import os
import logging
from .utils import get_file_size

logger = logging.getLogger(__name__)

def analyze_disk_usage(paths, exclude_patterns=None):
    """
    指定されたパス内のファイルのディスク使用量を分析し、
    個々のファイルパスとサイズのリストを返します。
    
    Args:
        paths (list or str): 分析対象のパスまたはそのリスト
        exclude_patterns (list): 除外するディレクトリ名のパターン
    
    Returns:
        list: (ファイルパス, サイズ) のタプルのリスト
    """
    if isinstance(paths, (str, os.PathLike)):
        paths = [str(paths)]
    elif not isinstance(paths, (list, tuple)):
        raise TypeError("paths must be a str, os.PathLike, list, or tuple")

    if exclude_patterns is None:
        exclude_patterns = []
    
    results = []

    logger.info(f"ディスク使用量分析を開始します。対象パス: {paths}")

    for path_to_analyze in paths:
        if not os.path.exists(path_to_analyze):
            logger.warning(f"パスが見つかりません: {path_to_analyze}")
            continue

        if os.path.isfile(path_to_analyze):
            try:
                size = get_file_size(path_to_analyze)
                results.append((path_to_analyze, size))
            except OSError as e:
                logger.warning(f"ファイル情報取得エラー: {path_to_analyze} - {e}")
            continue

        for dirpath, dirnames, filenames in os.walk(path_to_analyze):
            logger.debug(f"DEBUG (disk_analyzer): os.walk found: dirpath={dirpath}, dirnames={dirnames}, filenames={filenames}")
            dirnames[:] = [d for d in dirnames if d not in exclude_patterns]

            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                if not os.path.islink(filepath):
                    try:
                        size = get_file_size(filepath)
                        
                        results.append((filepath, size))
                    except FileNotFoundError:
                        logger.warning(f"ファイルが見つかりません（スキップ）: {filepath}")
                    except PermissionError:
                        logger.warning(f"ファイルへのアクセス権がありません（スキップ）: {filepath}")
                    except Exception as e:
                        logger.warning(f"ファイルサイズ取得中に予期せぬエラーが発生しました（スキップ）: {filepath} - {e}")

    results.sort(key=lambda x: x[1], reverse=True)

    logger.info(f"ディスク使用量分析が完了しました。検出ファイル数: {len(results)}")
    return results