import os
import argparse
import logging
import sys
import shlex
from pathlib import Path
import signal

from file_management_tool.config import Config, MoveConflictBehavior
from file_management_tool.logger import setup_logging
from file_management_tool.utils import format_output, restore_file
from file_management_tool.disk_analyzer import analyze_disk_usage

# Set up logging for the CLI application
setup_logging()
logger = logging.getLogger(__name__)

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
                             choices=["skip", "overwrite", "rename", "confirm"],
                             default="confirm",
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
            detector = DuplicateDetector(config_instance)

            if args.duplicate_action == "list":
                # 重複ファイル検出と表示
                duplicates = detector.find_duplicates(args.path)
                if not duplicates:
                    logger.info("重複ファイルは見つかりませんでした。")
                    return

                format_output(
                    duplicates,
                    args.output_format,
                    args.output_file,
                    command="duplicate",
                    columns=getattr(args, 'columns', None),
                    sort_by=getattr(args, 'sort_by', None),
                    filter_by=getattr(args, 'filter', None)
                )

            elif args.duplicate_action == "remove":
                # 重複ファイル検出と削除
                duplicates = detector.find_duplicates(args.path)
                if not duplicates:
                    logger.info("重複ファイルは見つかりませんでした。")
                    return

                detector.manage_duplicates(
                    duplicates,
                    action="削除",
                    interactive=getattr(args, 'interactive', False),
                    keep_newest=getattr(args, 'keep_newest', False),
                    dry_run=getattr(args, 'dry_run', False),
                    enable_backup=getattr(args, 'backup', False),
                    backup_dir=config_instance.get("backup_dir")
                )

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
                conflict_behavior = MoveConflictBehavior(config_instance.get('move_conflict_behavior'))
                if getattr(args, 'on_conflict', None):
                    conflict_behavior = MoveConflictBehavior(args.on_conflict)

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

                    if moved:
                        format_output({ "status": "success", "message": f"ファイル移動完了: {source_path} -> {destination_path}"}, args.output_format, args.output_file)
                    else:
                        format_output({ "status": "skipped", "message": f"ファイル移動をスキップしました: {source_path}"}, args.output_format, args.output_file)

                except InterruptedByUserError:
                    logger.info("ユーザーの選択によりアプリケーションを終了します。")
                except Exception as e:
                    logger.error(f"ファイル移動処理中に予期せぬエラーが発生しました: {e}")

        elif args.command == "disk_usage":
            paths = args.path if isinstance(args.path, (list, tuple)) else [args.path]
            usage_results = analyze_disk_usage(paths, getattr(args, 'exclude', None))
            format_output(usage_results, args.output_format, args.output_file, command="disk_usage")

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