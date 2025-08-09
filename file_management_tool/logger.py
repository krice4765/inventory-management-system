import logging
import os

def setup_logging(log_file="app.log", level=logging.INFO):
    """
    ロギングを設定します。
    コンソールとファイルにログを出力します。
    """
    # ルートロガーを取得
    logger = logging.getLogger()
    logger.setLevel(level)

    # 既存のハンドラをクリア（複数回呼び出し対策）
    if logger.handlers:
        for handler in logger.handlers:
            logger.removeHandler(handler)

    # コンソールハンドラ
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(console_handler)

    # ファイルハンドラ
    # ログファイルのディレクトリが存在しない場合は作成
    log_dir = os.path.dirname(log_file)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir)

    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(file_handler)

    logging.info(f"Logging setup complete. Log file: {os.path.abspath(log_file)}")

if __name__ == "__main__":
    # テスト用
    setup_logging()
    logging.debug("これはデバッグメッセージです。")
    logging.info("これは情報メッセージです。")
    logging.warning("これは警告メッセージです。")
    logging.error("これはエラーメッセージです。")
    logging.critical("これは致命的なエラーメッセージです。")
