# AdvancedUtils CUI版 セットアップスクリプト
param(
    [string]$InstallPath = "$env:USERPROFILE\Documents\Excel_VBA_AdvancedUtils"
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "AdvancedUtils CUI版 セットアップ開始" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# プロジェクト構造作成
$folders = @("src", "output", "docs")
foreach ($folder in $folders) {
    $path = Join-Path $InstallPath $folder
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "フォルダ作成: $folder" -ForegroundColor Green
    }
}

# README作成
$readmeContent = @"
AdvancedUtils - 総合ファイル管理ツール (CUI重視版)
===============================================

セットアップ手順:
1. AdvancedUtils_Manager.xlsmを作成
2. VBAエディタでモジュールを追加
3. 提供されたコードを各モジュールに貼り付け
4. イミディエイトウィンドウで Call ShowMenu() を実行

基本コマンド:
- Call ShowMenu()        # メニュー表示
- Call DetectDuplicates() # 重複ファイル検出
- Call AnalyzeDisk()     # ディスク分析
- Call OrganizeFiles()   # ファイル整理
- Call ShowSystemInfo()  # システム情報
"@

$readmeContent | Out-File -FilePath "$InstallPath\docs\README.txt" -Encoding UTF8

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "セットアップ完了！" -ForegroundColor Green
Write-Host "次の手順:" -ForegroundColor Yellow
Write-Host "1. '$InstallPath' フォルダにAdvancedUtils_Manager.xlsmを作成" -ForegroundColor White
Write-Host "2. VBAエディタを開き、提供されたコードを貼り付け" -ForegroundColor White
Write-Host "3. イミディエイトウィンドウで Call ShowMenu() を実行" -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan
