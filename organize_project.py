# organize_project.py - 修正版
import os
import shutil
import platform
from pathlib import Path
import subprocess
import sys

def create_organization_structure():
    """整理用ディレクトリ構造を作成"""
    directories = [
        'archive/test_artifacts',
        'archive/test_environments', 
        'archive/experimental_scripts',
        'archive/build_artifacts',
        'separate_projects'
    ]
    
    for dir_path in directories:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        print(f"[OK] Created: {dir_path}")

def safe_move(source, destination, dry_run=False):
    """安全なファイル移動（長いパス対応）"""
    try:
        if dry_run:
            print(f"[DRY-RUN] Would move: {source} -> {destination}")
            return True
            
        if not Path(source).exists():
            return True
            
        # Windows長いパス問題の対処
        if platform.system() == "Windows" and len(str(Path(source).absolute())) > 260:
            if Path(source).is_dir():
                dest_parent = Path(destination).parent
                dest_parent.mkdir(parents=True, exist_ok=True)
                
                result = subprocess.run([
                    'robocopy', str(source), str(destination), 
                    '/E', '/MOVE', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'
                ], capture_output=True, text=True)
                
                if result.returncode <= 1:
                    print(f"[OK] Moved (robocopy): {source} -> {destination}")
                    return True
                else:
                    print(f"[WARN] robocopy warning for {source}: exit code {result.returncode}")
                    return False
        
        # 通常の移動処理
        Path(destination).parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(destination))
        print(f"[OK] Moved: {source} -> {destination}")
        return True
        
    except Exception as e:
        print(f"[ERROR] Error moving {source}: {e}")
        return False

def classify_and_move(dry_run=False):
    """ファイル分類と移動の実行"""
    
    keep_items = {
        'file_management_tool', 'file_manager_cli.py', 'README.md', 
        '.gitignore', '.git', 'organize_project.py', 'archive', 
        'separate_projects', 'docs', 'CHANGELOG.md'
    }
    
    classification_rules = {
        'archive/test_artifacts': [
            'e2e_test_report_*.txt', 'debug_*.txt', '*.csv', 'current_status.txt',
            'tool_code_and_capabilities.txt', 'bug_fix_summary_*.txt', 'test_summary.txt',
            'test_plan_extended.txt', 'csv_output.txt', 'debug_csv.txt', 'debug_json.txt',
            'debug_log.txt', 'duplicates_output.csv', 'env_test.csv', 'test_small.csv',
            'out.json', 'logs.txt', 'validation.py', 'app.log', 'new_log.log'
        ],
        'archive/test_environments': [
            'test_data', 'large_test_data', 'test_environment', 'safe_confirm_*',
            'test_dest', 'test_duplicates_*', 'large_file_test_data', 'long_path_test_data',
            'test_data_moved_duplicates', 'safe_confirm_dest', 'safe_confirm_test'
        ],
        'archive/experimental_scripts': [
            'advanced_replace.py', 'fix_indent*.py', 'check_*.py', 
            'run_*_test.py', 'test_*.py', 'simple_*.py', 'e2e_test_runner.py',
            'test_critical_bug_fix.py', 'test_ctrl_c_final.py', 'simple_ctrl_c_test.py'
        ],
        'archive/build_artifacts': [
            'dist', 'build', '__pycache__', '.next', 'venv', 'logs'
        ],
        'separate_projects': [
            'Excel_VBA_AdvancedUtils'
        ]
    }
    
    moved_count = 0
    
    for item in Path('.').iterdir():
        if item.name in keep_items:
            continue
            
        moved = False
        for target_dir, patterns in classification_rules.items():
            for pattern in patterns:
                if item.match(pattern) or item.name.startswith(pattern.replace('*', '')):
                    if safe_move(item, f"{target_dir}/{item.name}", dry_run):
                        moved_count += 1
                        moved = True
                    break
            if moved:
                break
        
        if not moved and item.name not in keep_items:
            if item.is_file():
                target = f"archive/test_artifacts/{item.name}"
            else:
                target = f"archive/test_environments/{item.name}"
            
            if safe_move(item, target, dry_run):
                moved_count += 1
    
    return moved_count

def update_gitignore():
    """プロジェクト用.gitignoreの最適化"""
    gitignore_additions = """
# Project organization
archive/
separate_projects/

# Python
__pycache__/
*.pyc
*.pyo
venv/
env/

# Build artifacts  
build/
dist/
*.egg-info/
.next/

# Logs and temporary files
*.log
logs/
*.tmp
*.temp
app.log
new_log.log

# Test artifacts
e2e_test_report_*.txt
debug_*.txt
validation.py
out.json
logs.txt

# IDE/Editor
.vscode/
.idea/
*.code-workspace

# OS generated
.DS_Store
Thumbs.db
ehthumbs.db
Desktop.ini
"""
    
    with open('.gitignore', 'a', encoding='utf-8') as f:
        f.write(gitignore_additions)
    
    print("[OK] Updated .gitignore")

def generate_summary():
    """整理結果のサマリー生成"""
    summary = ["# Project Organization Summary", ""]
    
    total_files = 0
    for root, dirs, files in os.walk('archive'):
        if files:
            total_files += len(files)
            summary.append(f"## {root}")
            summary.append(f"- Files: {len(files)}")
            if len(files) <= 3:
                summary.append(f"- List: {', '.join(files)}")
            else:
                summary.append(f"- Examples: {', '.join(files[:3])}")
                summary.append(f"  (and {len(files) - 3} more)")
            summary.append("")
    
    summary.append(f"**Total moved files: {total_files}**")
    summary.append("")
    
    Path('archive').mkdir(exist_ok=True)
    with open('archive/organization_summary.md', 'w', encoding='utf-8') as f:
        f.write('
'.join(summary))
    
    print("[OK] Generated archive/organization_summary.md")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Project organization script')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be moved without actually moving')
    parser.add_argument('--yes', action='store_true', help='Assume yes and do not prompt')
    args = parser.parse_args()
    
    print("[START] Project organization starting...")
    print(f"Mode: {'Dry run' if args.dry_run else 'Execute'}")
    
    # ループ回避：非対話実行の確実な実装
    if not args.dry_run and not args.yes:
        # TTY判定による自動化
        if not sys.stdin.isatty():
            print("[AUTO] Non-interactive mode detected, proceeding...")
        else:
            response = input("Actually move files? (y/N): ")
            if response.lower() != 'y':
                print("Cancelled.")
                sys.exit(0)
    
    create_organization_structure()
    moved_count = classify_and_move(args.dry_run)
    
    if not args.dry_run:
        update_gitignore()
        generate_summary()
    
    print(f"[DONE] Complete! Processed {moved_count} items.")
    if not args.dry_run:
        print("Details: archive/organization_summary.md")
