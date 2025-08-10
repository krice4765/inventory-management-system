import logging
import os
import sys

def setup_logging(level=logging.DEBUG):
    """
    ロギングを設定します。
    コンソール（stderr）にログを出力します。
    """
    # ルートロガーを取得
    logger = logging.getLogger()
    logger.setLevel(level)

    # 既存のハンドラをクリア（複数回呼び出し対策）
    if logger.handlers:
        for handler in logger.handlers:
            logger.removeHandler(handler)

    # stderrにのみ出力するハンドラを設定
    handler = logging.StreamHandler(stream=sys.stderr)
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    logging.info(f"Logging setup complete. Logs directed to stderr.")

if __name__ == "__main__":
    # テスト用
    setup_logging()
    logging.debug("これはデバッグメッセージです。")
    logging.info("これは情報メッセージです。")
    logging.warning("これは警告メッセージです。")
    logging.error("これはエラーメッセージです。")
    logging.critical("これは致命的なエラーメッセージです。")
