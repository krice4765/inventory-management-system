import pytest
import subprocess
import tempfile
import re
from pathlib import Path
import os

# === ヘルパー関数とフィクスチャ ===

@pytest.fixture
def temp_test_dir():
    """テストごとに独立した一時ディレクトリを提供するフィクスチャ"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)

def run_cli_command(command_args, cwd=None, encoding='cp932'):
    """
    CLIコマンドを実行し、標準出力、標準エラー、終了コードを返す。
    """
    cli_path = Path(__file__).parent.parent.parent / 'file_manager_cli.py'
    cmd = ["python", str(cli_path)] + command_args
    
    try:
        process = subprocess.Popen(
            cmd,
            cwd=str(cwd) if cwd else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding=encoding,
            errors='replace'
        )
        stdout_data, stderr_data = process.communicate(timeout=300)
        return stdout_data, stderr_data, process.returncode
    except subprocess.TimeoutExpired:
        process.kill()
        return "", "タイムアウトエラー", -1
    except Exception as e:
        return "", f"実行エラー: {str(e)}", -1

# === duplicate remove コマンドのテスト ===

def test_duplicate_remove_dry_run(temp_test_dir):
    """重複ファイル削除のドライラン機能テスト"""
    (temp_test_dir / "file_a.txt").write_text("same content")
    (temp_test_dir / "file_b.txt").write_text("same content")
    (temp_test_dir / "unique.txt").write_text("different content")

    stdout, stderr, returncode = run_cli_command([
        "duplicate", "remove",
        "--path", str(temp_test_dir),
        "--dry-run"
    ], cwd=temp_test_dir)

    assert returncode == 0, f"ドライランコマンドが失敗: {stderr}"
    assert "[dry-run]" in stdout or "[dry-run]" in stderr, "ドライランの出力がありません"
    assert (temp_test_dir / "file_a.txt").exists()
    assert (temp_test_dir / "file_b.txt").exists()

def test_duplicate_remove_basic(temp_test_dir):
    """重複ファイル削除の基本機能テスト"""
    (temp_test_dir / "duplicate_a.txt").write_text("same content")
    (temp_test_dir / "duplicate_b.txt").write_text("same content")
    (temp_test_dir / "unique.txt").write_text("different content")

    (temp_test_dir / "duplicate_a.txt").touch()
    import time; time.sleep(0.1);
    (temp_test_dir / "duplicate_b.txt").touch()

    stdout, stderr, returncode = run_cli_command([
        "duplicate", "remove",
        "--path", str(temp_test_dir),
        "--keep-newest"
    ], cwd=temp_test_dir)

    assert returncode == 0, f"削除コマンドが失敗: {stderr}"
    remaining_files = list(f.name for f in temp_test_dir.glob("*.txt"))
    assert len(remaining_files) == 2
    assert "unique.txt" in remaining_files
    assert "duplicate_b.txt" in remaining_files

def test_duplicate_remove_no_duplicates(temp_test_dir):
    """重複ファイルが存在しない場合のテスト"""
    (temp_test_dir / "file_a.txt").write_text("content a")
    (temp_test_dir / "file_b.txt").write_text("content b")

    stdout, stderr, returncode = run_cli_command([
        "duplicate", "remove",
        "--path", str(temp_test_dir)
    ], cwd=temp_test_dir)

    assert returncode == 0, f"コマンドが失敗: {stderr}"
    assert (temp_test_dir / "file_a.txt").exists()
    assert (temp_test_dir / "file_b.txt").exists()
    assert "重複ファイルは見つかりませんでした" in stdout or "No duplicate files were found" in stdout or "重複ファイルは見つかりませんでした" in stderr

# === duplicate move コマンドのテスト ===

def test_duplicate_move_basic(temp_test_dir):
    """重複ファイル移動の基本機能テスト"""
    source_dir = temp_test_dir / "source"
    dest_dir = temp_test_dir / "destination"
    source_dir.mkdir()
    dest_dir.mkdir()

    (source_dir / "file_a.txt").write_text("same content")
    (source_dir / "file_b.txt").write_text("same content")

    # moveは現在、単一ファイルのみを対象とするため、テストを修正
    stdout, stderr, returncode = run_cli_command([
        "duplicate", "move",
        str(source_dir / "file_a.txt"),
        str(dest_dir / "file_a.txt"),
        "--target-dir", str(dest_dir)
    ], cwd=temp_test_dir)

    assert returncode == 0, f"移動コマンドが失敗: {stderr}"
    assert not (source_dir / "file_a.txt").exists()
    assert (dest_dir / "file_a.txt").exists()
    assert "ファイル移動完了" in stdout or "moved" in stdout.lower()

# === disk_usage コマンドのテスト ===

def test_disk_usage_basic(temp_test_dir):
    """ディスク使用量計算の基本テスト"""
    (temp_test_dir / "file1.txt").write_text("A" * 100)
    (temp_test_dir / "file2.txt").write_text("B" * 200)
    
    stdout, stderr, returncode = run_cli_command([
        "disk_usage",
        "--path", str(temp_test_dir),
        "--output-format", "json"
    ], cwd=temp_test_dir)

    assert returncode == 0, f"ディスク使用量コマンドが失敗: {stderr}"
    
    import json
    try:
        data = json.loads(stdout)
        assert isinstance(data, list)
        # 正確な合計サイズのアサーションは、OSやファイルシステムに依存するため、
        # ここでは個々のファイルサイズが含まれているかで判断する
        sizes = [item['size'] for item in data]
        assert 100 in sizes
        assert 200 in sizes
    except (json.JSONDecodeError, IndexError, TypeError) as e:
        pytest.fail(f"JSON出力の解析に失敗: {e}\nOutput:\n{stdout}")