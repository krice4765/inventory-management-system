import os
import argparse
import logging
import sys
import shlex
from pathlib import Path
import signal

from file_management_tool.config import Config, default_config, normalize_conflict_behavior
from file_management_tool.logger import setup_logging
from file_management_tool.utils import format_output, restore_file, MoveConflictBehavior, safe_move_file
from file_management_tool.disk_analyzer import analyze_disk_usage

import json
import hashlib

import csv
import io

# Set up logging for the CLI application
setup_logging()
logger = logging.getLogger(__name__)

def ensure_parent_dir(path: str):
    """親ディレクトリが存在しない場合は作成"""
    p = Path(path)
    if p.parent and not p.parent.exists():
        p.parent.mkdir(parents=True, exist_ok=True)

def write_output(content: str, output_file: str = None, encoding: str = 'utf-8'):
    """統一された出力処理関数 - UTF-8保証"""
    if output_file:
        try:
            ensure_parent_dir(output_file)
            with open(output_file, "w", encoding=encoding, newline="") as f:
                f.write(content)
            logger.info(f"結果を '{output_file}' にUTF-8で出力しました")
        except IOError as e:
            logger.error(f"ファイル '{output_file}' への書き込みエラー: {e}")
            raise
    else:
        # stdoutに純粋な結果のみ出力
        sys.stdout.write(content)
        if not content.endswith("\n"):
            sys.stdout.write("\n")
        sys.stdout.flush()


# Global variables for Ctrl+C handling
cleanup_in_progress = False
temporary_files = []

def signal_handler(signum, frame):
    """
    Ctrl+C (SIGINT) 処理のためのシグナルハンドラ
    安全な中断とクリーンアップを実行
    """
    global cleanup_in_progress
    
    if cleanup_in_progress:
        print("\n強制終了中です...")
        sys.exit(1)
    
    cleanup_in_progress = True
    print("\n\n処理を安全に中断しています...")
    
    try:
        # 一時ファイルのクリーンアップ
        cleanup_temporary_files()
        
        # ログに中断記録を残す
        logger = logging.getLogger(__name__)
        logger.info("ユーザーによる処理中断 (Ctrl+C)")
        
        print("安全に中断しました。")
        
    except Exception as e:
        print(f"クリーンアップ中にエラーが発生しました: {e}")
        logging.getLogger(__name__).error(f"クリーンアップエラー: {e}")
    
    finally:
        sys.exit(0)

def cleanup_temporary_files():
    """一時ファイルとバックアップファイルのクリーンアップ"""
    global temporary_files
    
    for temp_file in temporary_files:
        try:
            if os.path.exists(temp_file):
                os.remove(temp_file)
                logging.getLogger(__name__).info(f"一時ファイルを削除しました: {temp_file}")
        except Exception as e:
            logging.getLogger(__name__).warning(f"一時ファイル削除エラー: {e}")
    
    temporary_files.clear()

def add_temporary_file(filepath):
    """一時ファイルを管理リストに追加"""
    global temporary_files
    temporary_files.append(str(filepath))

def create_parser(config):
    """Creates the argument parser."""
    parser = argparse.ArgumentParser(
        description="ファイル管理・システム分析ツール",
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    # Common arguments for all subcommands
    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument("--output-format", choices=["log", "json", "csv"], default="log",
                               help="出力フォーマットを指定します。")
    common_parser.add_argument("--output-file", help="結果を保存するファイルパスを指定します。")

    subparsers = parser.add_subparsers(dest="command", help="利用可能なコマンド", required=True)

    # Config command
    config_parser = subparsers.add_parser("config", parents=[common_parser], help="設定を管理します。")
    config_subparsers = config_parser.add_subparsers(dest="config_action", help="config コマンドのアクション", required=True)
    
    config_show_parser = config_subparsers.add_parser("show", parents=[common_parser], help="現在の設定を表示します。")
    
    config_set_parser = config_subparsers.add_parser("set", parents=[common_parser], help="設定値を変更します。")
    config_set_parser.add_argument("key", help="設定キー")
    config_set_parser.add_argument("value", help="設定値")

    # Duplicate command
    duplicate_parser = subparsers.add_parser("duplicate", parents=[common_parser], help="重複ファイル操作")
    duplicate_subparsers = duplicate_parser.add_subparsers(dest="duplicate_action", help="duplicate コマンドのアクション", required=True)
    
    # duplicate list サブコマンド
    list_parser = duplicate_subparsers.add_parser("list", parents=[common_parser], help="重複ファイルを一覧表示します。")
    list_parser.add_argument("--path", type=str, nargs='*', 
                            help="検索対象のディレクトリパス (複数指定可)", 
                            default=config.get("scan_paths", ["."]))
    list_parser.add_argument("--exclude", nargs='+', help="除外するパターン")
    list_parser.add_argument("--columns", nargs='+', help="表示する列を指定")
    list_parser.add_argument("--sort-by", help="結果のソートキーを指定")
    list_parser.add_argument("--filter", nargs=2, help="フィルタリング条件を指定")

    # duplicate remove サブコマンド
    remove_parser = duplicate_subparsers.add_parser("remove", parents=[common_parser], help="重複ファイルを削除します。")
    remove_parser.add_argument("--path", type=str, nargs='*', 
                              help="検索対象のディレクトリパス (複数指定可)", 
                              default=config.get("scan_paths", ["."]))
    remove_parser.add_argument("--exclude", nargs='+', help="除外するパターン")
    remove_parser.add_argument("--interactive", action="store_true", 
                              help="削除前に各ファイルについて確認")
    remove_parser.add_argument("--keep-newest", action="store_true", 
                              help="最も新しいファイルを残す")
    remove_parser.add_argument("--dry-run", action="store_true", 
                              help="実際には削除せず、削除予定のファイルを表示")
    remove_parser.add_argument("--backup", action="store_true", 
                              help="削除前にファイルをバックアップ")

    # duplicate move サブコマンド
    move_parser = duplicate_subparsers.add_parser("move", parents=[common_parser], help="ファイルを移動")
    move_parser.add_argument("source_path", help="移動元ファイルのパス")
    move_parser.add_argument("destination_path", help="移動先ファイルのパス")
    move_parser.add_argument("--target-dir", required=True, help="移動先ディレクトリ")
    move_parser.add_argument("--on-conflict", 
                             choices=["ask", "skip", "overwrite", "rename", "backup", "quit", "all-skip", "all-overwrite"],
                             default="ask",
                             help="ファイル競合時の動作")
    move_parser.add_argument("--backup", action="store_true", help="バックアップを作成")
    move_parser.add_argument("--dry-run", action="store_true", help="実行せずに表示のみ")
    
    # Disk usage command
    disk_usage_parser = subparsers.add_parser("disk_usage", parents=[common_parser], help="ディスク使用量を分析します。")
    disk_usage_parser.add_argument("--path", nargs='*', help="分析対象のディレクトリパス", default=["."])
    disk_usage_parser.add_argument("--exclude", nargs='+', help="除外するパターン")

    # Restore command
    restore_parser = subparsers.add_parser("restore", parents=[common_parser], help="バックアップからファイルを復元します。")
    restore_parser.add_argument("backup_path", help="復元するバックアップファイルのパス")
    restore_parser.add_argument("original_filepath", help="元のファイルのパス")

    return parser

def process_command(args, common_args, config_instance):
    """コマンド処理関数（Ctrl+C対応版）"""
    try:
        # 最強防御: あらゆるケースに対応した属性コピー
        args.output_format = getattr(common_args, 'output_format', 'log') if common_args else 'log'
        args.output_file = getattr(common_args, 'output_file', None) if common_args else None
        
        # --- Sanitize path arguments ---
        if hasattr(args, 'path') and args.path:
            args.path = [p.strip('"') for p in args.path]

        if args.command == "config":
            if args.config_action == "show":
                logger.info("現在の設定:")
                format_output(config_instance.config, args.output_format, args.output_file)
            elif args.config_action == "set":
                key = args.key
                value = args.value
                config_instance.set(key, value)
                config_instance.save_config()
                logger.info(f"設定を更新しました: {key} = {value}")

        elif args.command == "duplicate":
            # DuplicateDetectorインスタンスの作成（config_instanceを使用）
            from file_management_tool.duplicate_detector import DuplicateDetector
            detector = DuplicateDetector(
                config=config_instance,
                algorithm=config_instance.get('duplicate_hash_algorithm', 'md5'),
                min_size=config_instance.get('duplicate_min_size', 1)
            )

            if args.duplicate_action == "list":
                """重複ファイル検出 - 全出力形式対応"""
                logging.info(f"重複ファイル検出を開始: {args.path}")
                
                paths = args.path if isinstance(args.path, list) else [args.path]
                
                # ファイルのハッシュを計算してグルーピング
                hash_groups = {}
                for path_str in paths:
                    path = Path(path_str)
                    if not path.exists():
                        logging.error(f"パス '{path_str}' が存在しません")
                        continue

                    for file_path in path.rglob('*'):
                        if file_path.is_file():
                            try:
                                # チャンク読み込みによる効率的なハッシュ計算
                                file_hash = hashlib.md5()
                                with open(file_path, 'rb') as f:
                                    while chunk := f.read(8192):
                                        file_hash.update(chunk)
                                
                                hash_value = file_hash.hexdigest()
                                if hash_value not in hash_groups:
                                    hash_groups[hash_value] = []
                                # 重要: 文字列として格納してJSON serialization問題を回避
                                hash_groups[hash_value].append(str(file_path))
                                
                            except (OSError, PermissionError) as e:
                                logging.warning(f"ファイル読み取りエラー: {file_path} - {e}")
                
                # 重複ファイルのみ抽出
                duplicate_groups = {k: v for k, v in hash_groups.items() if len(v) > 1}
                logging.info(f"重複グループ数: {len(duplicate_groups)}")
                
                # 出力形式別の処理
                if args.output_format == 'json':
                    # v0.3.0対応のJSON形式
                    json_data = []
                    for hash_val, files in duplicate_groups.items():
                        json_data.append({
                            "hash": hash_val,
                            "files": files  # 既に文字列化済み
                        })
                    output = json.dumps(json_data, ensure_ascii=False, indent=2)
                    
                elif args.output_format == 'csv':
                    buf = io.StringIO()
                    writer = csv.writer(buf)
                    writer.writerow(['group_id', 'hash', 'file_path'])
                    for group_id, (hash_val, files) in enumerate(duplicate_groups.items(), 1):
                        for file_path in files:
                            writer.writerow([group_id, hash_val, file_path])
                    output = buf.getvalue().rstrip('\n')
                    
                else:  # log format
                    if duplicate_groups:
                        output_lines = ["重複ファイルが検出されました:"]
                        for i, (hash_val, files) in enumerate(duplicate_groups.items(), 1):
                            output_lines.append(f"\nグループ {i} (ハッシュ: {hash_val[:8]}...):")
                            for file_path in files:
                                output_lines.append(f"  - {file_path}")
                        output = "\n".join(output_lines)
                    else:
                        output = "重複ファイルは見つかりませんでした。"
                
                # 統一された出力処理
                try:
                    write_output(output, args.output_file)
                except IOError:
                    pass

            elif args.duplicate_action == "remove":
                """重複ファイル削除（ドライラン対応） - 統一出力対応"""
                if args.dry_run:
                    logging.info("ドライランモードで重複ファイル削除をシミュレーション")
                else:
                    logging.info("重複ファイル削除を実行")
                
                paths = args.path if isinstance(args.path, list) else [args.path]
                hash_groups = {}
                for path_str in paths:
                    path = Path(path_str)
                    if not path.exists():
                        logging.error(f"パス '{path_str}' が存在しません")
                        continue
                
                    # 重複検出（duplicate_list_commandと同じロジック）
                    for file_path in path.rglob('*'):
                        if file_path.is_file():
                            try:
                                file_hash = hashlib.md5()
                                with open(file_path, 'rb') as f:
                                    while chunk := f.read(8192):
                                        file_hash.update(chunk)
                                
                                hash_value = file_hash.hexdigest()
                                if hash_value not in hash_groups:
                                    hash_groups[hash_value] = []
                                hash_groups[hash_value].append(file_path)  # Pathオブジェクトのまま保持（削除用）
                                
                            except (OSError, PermissionError) as e:
                                logging.warning(f"ファイル読み取りエラー: {file_path} - {e}")
                
                # 重複ファイルのみ抽出
                duplicate_groups = {k: v for k, v in hash_groups.items() if len(v) > 1}
                
                # 削除処理と結果記録
                output_lines = []
                if args.dry_run:
                    output_lines.append("ドライランモード: 実際にはファイルを削除しません")
                
                removed_count = 0
                if duplicate_groups:
                    for i, (hash_val, files) in enumerate(duplicate_groups.items(), 1):
                        output_lines.append(f"\nグループ {i} (ハッシュ: {hash_val[:8]}...):")
                        output_lines.append(f"  残すファイル: {files[0]}")
                        
                        # 最初のファイルを残し、残りを削除対象
                        for file_path in files[1:]:
                            if args.dry_run:
                                output_lines.append(f"  [DRY RUN] 削除対象: {file_path}")
                            else:
                                try:
                                    file_path.unlink()
                                    output_lines.append(f"  削除しました: {file_path}")
                                    logging.info(f"ファイルを削除: {file_path}")
                                except (OSError, PermissionError) as e:
                                    output_lines.append(f"  削除エラー: {file_path} - {e}")
                                    logging.error(f"削除エラー: {file_path} - {e}")
                            removed_count += 1
                else:
                    output_lines.append("重複ファイルは見つかりませんでした。")
                
                # 結果サマリー
                if args.dry_run:
                    output_lines.append(f"\n[DRY RUN] {removed_count}個のファイルが削除対象です")
                else:
                    if removed_count > 0:
                        output_lines.append(f"\n{removed_count}個のファイルを削除しました")
                
                output = "\n".join(output_lines)
                
                # 統一された出力処理
                try:
                    write_output(output, args.output_file)
                    logging.info("重複ファイルの管理が完了しました。")
                except IOError:
                    pass

            elif args.duplicate_action == "move":
                # 重複検出をスキップして直接safe_move_fileを呼び出す修正（致命的バグテスト用）
                source_path = Path(args.source_path)
                destination_path = Path(args.destination_path)

                if not source_path.exists():
                    logger.error(f"移動元ファイルが存在しません: {source_path}")
                    return

                # バックアップファイルを一時ファイルとして登録（Ctrl+C対応）
                if hasattr(args, 'backup') and args.backup:
                    backup_dir = config_instance.get('backup_dir')
                    if backup_dir:
                        backup_file_path = Path(backup_dir) / f"{source_path.name}.backup"
                        add_temporary_file(str(backup_file_path))
                        logger.info(f"バックアップファイルを一時ファイルとして登録: {backup_file_path}")

                # 競合動作の設定
                # CLI引数で指定された場合はそれを優先し、正規化
                if getattr(args, 'on_conflict', None):
                    normalized_cli_behavior = normalize_conflict_behavior(args.on_conflict)
                    try:
                        conflict_behavior = MoveConflictBehavior(normalized_cli_behavior)
                    except ValueError as e:
                        logger.warning(f"CLI引数 --on-conflict に無効な値が指定されました: {args.on_conflict}. デフォルト設定を使用します。エラー: {e}")
                        conflict_behavior = config_instance.move_conflict_behavior
                else:
                    # CLI引数がない場合は設定ファイルの値を使用
                    conflict_behavior = config_instance.move_conflict_behavior

                # all_skip_activeフラグの初期化
                all_skip_active = False

                try:
                    from file_management_tool.utils import InterruptedByUserError, safe_move_file

                    # safe_move_fileの直接呼び出し（致命的バグテストのため）
                    moved, all_skip_active = safe_move_file(
                        str(source_path),
                        str(destination_path),
                        conflict_behavior,
                        config_instance.get('backup_dir'),
                        all_skip_active
                    )

                    output_data = { "status": "success", "message": f"ファイル移動完了: {source_path} -> {destination_path}"} if moved else { "status": "skipped", "message": f"ファイル移動をスキップしました: {source_path}"}
                    rendered = format_output(
                        output_data,
                        format_type=args.output_format,
                        output_file=args.output_file,
                        command=args.command
                    )
                    if rendered is not None:
                        if not rendered.endswith("\n"):
                            rendered = rendered + "\n"
                        sys.stdout.write(rendered)
                        sys.stdout.flush()

                except InterruptedByUserError:
                    logger.info("ユーザーの選択によりアプリケーションを終了します。")
                except Exception as e:
                    logger.error(f"ファイル移動処理中に予期せぬエラーが発生しました: {e}")

        elif args.command == "disk_usage":
            "ディスク使用量分析 - v0.3.0新形式対応"
            logging.info(f"ディスク使用量分析を開始: {args.path}")
            
            # パス存在チェック
            paths = args.path if isinstance(args.path, list) else [args.path]
            
            files_info = []
            for path_str in paths:
                path = Path(path_str)
                if not path.exists():
                    logging.warning(f"パスが見つかりません: {path_str}")
                    continue
                    
                # ファイルサイズ情報を収集
                for file_path in path.rglob('*'):
                    if file_path.is_file():
                        try:
                            size = file_path.stat().st_size
                            # v0.3.0の新形式: 辞書配列（文字列化保証）
                            files_info.append({"path": str(file_path), "size": size})
                        except (OSError, PermissionError) as e:
                            logging.warning(f"ファイルアクセスエラー: {file_path} - {e}")
            
            # サイズ順でソート
            files_info.sort(key=lambda x: x['size'], reverse=True)
            logging.info(f"分析完了: {len(files_info)}個のファイルを検出")
            
            # 出力形式の処理
            if args.output_format == 'json':
                output = json.dumps(files_info, ensure_ascii=False, indent=2)
            elif args.output_format == 'csv':
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow(['path', 'size'])
                for item in files_info:
                    writer.writerow([item['path'], item['size']])
                output = buf.getvalue().rstrip('\n')
            else:  # log format
                output = "\n".join(f"{item['path']}: {item['size']} bytes" for item in files_info)
            
            # 統一された出力処理
            try:
                write_output(output, args.output_file)
            except IOError:
                pass

        elif args.command == "restore":
            restore_file(args.backup_path, args.original_filepath)

    except KeyboardInterrupt:
        # シグナルハンドラで既に処理済みのため、ここでは何もしない
        pass
    except Exception as e:
        logger.error(f"コマンド処理中のエラー: {e}")
        raise

def setup_app():
    """アプリケーションの初期設定（修復版）"""
    try:
        config_instance = Config()
        logger.debug(f"読み込まれた設定 = {config_instance.config}")
        return config_instance
    except Exception as e:
        logger.error(f"アプリケーション初期設定中にエラーが発生しました: {e}")
        sys.exit(1)

def main():
    # Ctrl+C シグナルハンドラの登録
    signal.signal(signal.SIGINT, signal_handler)
    
    # Windows環境での追加対応
    if hasattr(signal, 'SIGBREAK'):
        signal.signal(signal.SIGBREAK, signal_handler)
    
    config_instance = setup_app()
    config = config_instance.config
    logger.info("アプリケーションを開始します。")
    
    # --- New Argument Parsing Logic ---
    # 1. Parse common arguments first
    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument("--output-format", choices=["log", "json", "csv"], default="log")
    common_parser.add_argument("--output-file", help="結果を保存するファイルパス")

    # Use parse_known_args to separate common args from command-specific args
    # sys.argv[1:] excludes the script name itself
    common_args, remaining_args = common_parser.parse_known_args(sys.argv[1:])

    # 2. If no command is given, print help for the main parser
    if not remaining_args:
        create_parser(config).print_help()
        sys.exit(0)

    # 3. Now, parse the remaining arguments with the main command parser
    if remaining_args:
        parser = create_parser(config)
        try:
            args = parser.parse_args(remaining_args)
            process_command(args, common_args, config_instance)
        except argparse.ArgumentError as e:
            logger.error(f"引数エラー: {e}")
        except SystemExit:
            pass # Ignore exit from argparse help/error
        except Exception as e:
            logger.error(f"予期せぬエラーが発生しました: {e}")

def interactive_main():
    """Interactive mode for the CLI."""
    print("対話型ファイル管理ツールへようこそ！ 'exit' または 'quit' で終了します。")
    
    config_instance = setup_app()

    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument("--output-format", choices=["log", "json", "csv"], default="log")
    common_parser.add_argument("--output-file", help="結果を保存するファイルパス")

    while True:
        try:
            command_line = input("\n> ").strip()
            if not command_line:
                continue
            if command_line.lower() in ["exit", "quit"]:
                logger.info("アプリケーションを終了します。")
                break

            # Use shlex.split to handle quotes in arguments
            args_list = shlex.split(command_line)

            # Parse common arguments first
            common_args, remaining_args = common_parser.parse_known_args(args_list)

            if remaining_args:
                parser = create_parser(config_instance.config)
                try:
                    args = parser.parse_args(remaining_args)
                    process_command(args, common_args, config_instance)
                except SystemExit:
                    pass # Ignore exit from argparse help/error
                except Exception as e:
                    logger.error(f"コマンド処理中にエラー: {e}")
            else:
                parser = create_parser(config_instance.config)
                parser.print_help()

        except KeyboardInterrupt:
            logger.info("ユーザーの選択によりアプリケーションを終了します。")
            break
        except EOFError:
            logger.info("EOFを受信しました。アプリケーションを終了します。")
            break
        except Exception as e:
            logger.error(f"対話モード中に予期せぬエラーが発生しました: {e}")

if __name__ == "__main__":
    config_instance = setup_app()
    config = config_instance.config # Ensure config is available for create_parser in main or interactive_main

    if len(sys.argv) > 1:
        # Command-line mode
        main()
    else:
        # Interactive mode
        interactive_main()