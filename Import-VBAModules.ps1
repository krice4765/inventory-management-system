# VBAモジュール自動インポートスクリプト
# Excel VBA AdvancedUtils プロジェクト用

param(
    [string]$ProjectPath = ".\Excel_VBA_AdvancedUtils",
    [switch]$CreateExcelFile = $false,
    [switch]$Verbose = $false
)

# カラー表示関数
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "======================================" "Cyan"
Write-ColorOutput "VBAモジュール自動インポートスクリプト" "Cyan"
Write-ColorOutput "Excel VBA AdvancedUtils プロジェクト用" "Cyan"
Write-ColorOutput "======================================" "Cyan"

# パスの設定と検証
$ExcelFilePath = Join-Path $ProjectPath "AdvancedUtils_Manager.xlsm"
$SourceFolder = Join-Path $ProjectPath "src"

Write-ColorOutput "プロジェクトパス: $ProjectPath" "Yellow"
Write-ColorOutput "Excelファイル: $ExcelFilePath" "Yellow"
Write-ColorOutput "ソースフォルダ: $SourceFolder" "Yellow"

# インポート対象モジュール（依存関係を考慮した順序）
$ModuleFiles = @(
    "Module_Utility.bas",        # 最初にインポート（他のモジュールが依存）
    "Module_Main.bas",
    "Module_DuplicateDetector.bas",
    "Module_DiskAnalyzer.bas",
    "Module_FileOrganizer.bas",
    "Module_SystemInfo.bas"
)

# ソースフォルダの存在確認
if (-not (Test-Path $SourceFolder)) {
    Write-ColorOutput "エラー: ソースフォルダが見つかりません: $SourceFolder" "Red"
    Write-ColorOutput "プロジェクトパスを確認してください" "Yellow"
    exit 1
}

# モジュールファイルの存在確認
Write-ColorOutput "`n[ファイル存在確認]" "Green"
$missingFiles = @()
foreach ($file in $ModuleFiles) {
    $fullPath = Join-Path $SourceFolder $file
    if (Test-Path $fullPath) {
        Write-ColorOutput "✓ $file" "Green"
    } else {
        Write-ColorOutput "✗ $file (見つかりません)" "Red"
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-ColorOutput "`nエラー: 以下のファイルが見つかりません:" "Red"
    $missingFiles | ForEach-Object { Write-ColorOutput "  - $_" "Red" }
    exit 1
}

# Excelファイル作成オプション
if ($CreateExcelFile) {
    Write-ColorOutput "`n[Excelファイル作成]" "Green"
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        
        $workbook = $excel.Workbooks.Add()
        $workbook.SaveAs($ExcelFilePath, 52) # xlOpenXMLWorkbookMacroEnabled
        $workbook.Close()
        $excel.Quit()
        
        # COMオブジェクトの解放
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        
        Write-ColorOutput "✓ Excelファイルを作成しました: $ExcelFilePath" "Green"
    }
    catch {
        Write-ColorOutput "エラー: Excelファイルの作成に失敗しました: $($_.Exception.Message)" "Red"
        exit 1
    }
}

# Excelファイル存在確認
if (-not (Test-Path $ExcelFilePath)) {
    Write-ColorOutput "`nエラー: Excelファイルが見つかりません: $ExcelFilePath" "Red"
    Write-ColorOutput "ファイルを作成するには -CreateExcelFile スイッチを使用してください" "Yellow"
    Write-ColorOutput "例: .\Import-VBAModules.ps1 -CreateExcelFile" "White"
    exit 1
}

Write-ColorOutput "`n[VBAモジュールインポート開始]" "Green"

# Excel変数の初期化
$excel = $null
$workbook = $null

try {
    # Excel アプリケーション起動
    Write-ColorOutput "Excelアプリケーションを起動しています..." "Yellow"
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    
    # ワークブックを開く
    Write-ColorOutput "ワークブックを開いています..." "Yellow"
    $workbook = $excel.Workbooks.Open($ExcelFilePath)
    
    # VBAプロジェクトにアクセス
    $vbaProject = $workbook.VBProject
    Write-ColorOutput "VBAプロジェクト名: $($vbaProject.Name)" "Cyan"
    
    # 既存のモジュールを削除（重複回避）
    Write-ColorOutput "`n[既存モジュール削除]" "Yellow"
    $deletedCount = 0
    foreach ($moduleFile in $ModuleFiles) {
        $moduleName = [System.IO.Path]::GetFileNameWithoutExtension($moduleFile)
        try {
            $existingModule = $vbaProject.VBComponents | Where-Object { 
                $_.Name -eq $moduleName -and $_.Type -eq 1 
            }
            if ($existingModule) {
                $vbaProject.VBComponents.Remove($existingModule)
                Write-ColorOutput "- 削除完了: $moduleName" "Yellow"
                $deletedCount++
            }
        }
        catch {
            if ($Verbose) {
                Write-ColorOutput "- 削除スキップ: $moduleName (存在しないか削除できませんでした)" "Gray"
            }
        }
    }
    Write-ColorOutput "既存モジュール削除完了 ($deletedCount 個削除)" "Green"
    
    # モジュールを順番にインポート
    Write-ColorOutput "`n[モジュールインポート]" "Green"
    $importedCount = 0
    $failedModules = @()
    
    foreach ($file in $ModuleFiles) {
        $fullPath = Join-Path $SourceFolder $file
        $moduleName = [System.IO.Path]::GetFileNameWithoutExtension($file)
        
        try {
            Write-ColorOutput "インポート中: $file" "Yellow"
            $vbaProject.VBComponents.Import($fullPath)
            Write-ColorOutput "✓ インポート完了: $moduleName" "Green"
            $importedCount++
            
            # 安定性向上のため少し待機
            Start-Sleep -Milliseconds 300
        }
        catch {
            Write-ColorOutput "✗ インポート失敗: $file" "Red"
            Write-ColorOutput "  エラー: $($_.Exception.Message)" "Red"
            $failedModules += $file
        }
    }
    
    # インポート結果確認
    Write-ColorOutput "`n[インポート結果確認]" "Green"
    $finalModules = @()
    foreach ($component in $vbaProject.VBComponents) {
        if ($component.Type -eq 1) { # vbext_ct_StdModule
            $finalModules += $component.Name
            Write-ColorOutput "✓ モジュール確認: $($component.Name)" "Green"
        }
    }
    
    # ワークブック保存
    Write-ColorOutput "`nワークブックを保存しています..." "Yellow"
    $workbook.Save()
    
    # 完了メッセージ
    Write-ColorOutput "`n======================================" "Cyan"
    Write-ColorOutput "インポート完了！" "Green"
    Write-ColorOutput "======================================" "Cyan"
    Write-ColorOutput "インポートされたモジュール数: $importedCount / $($ModuleFiles.Count)" "White"
    Write-ColorOutput "現在のモジュール一覧:" "White"
    $finalModules | ForEach-Object { Write-ColorOutput "  - $_" "Cyan" }
    
    if ($importedCount -eq $ModuleFiles.Count) {
        Write-ColorOutput "`n🎉 すべてのモジュールが正常にインポートされました！" "Green"
        Write-ColorOutput "`n次のステップ:" "Yellow"
        Write-ColorOutput "1. Excelファイルを開く: $ExcelFilePath" "White"
        Write-ColorOutput "2. Alt+F11 でVBAエディタを開く" "White"
        Write-ColorOutput "3. ユーザーフォーム (UserForm_Simple) を手動作成" "White"
        Write-ColorOutput "4. Ctrl+G でイミディエイトウィンドウを表示" "White"
        Write-ColorOutput "5. 'Call ShowMenu()' を実行してツールを起動" "White"
    } else {
        Write-ColorOutput "`n⚠️  一部のモジュールでインポートエラーが発生しました" "Yellow"
        Write-ColorOutput "失敗したモジュール:" "Red"
        $failedModules | ForEach-Object { Write-ColorOutput "  - $_" "Red" }
        Write-ColorOutput "`n手動でのインポートを試してください" "Yellow"
    }
}
catch {
    Write-ColorOutput "`nエラー: VBAモジュールのインポートに失敗しました" "Red"
    Write-ColorOutput "詳細: $($_.Exception.Message)" "Red"
    Write-ColorOutput "`n可能な原因:" "Yellow"
    Write-ColorOutput "- Excelのマクロセキュリティ設定が無効" "White"
    Write-ColorOutput "- 'VBAプロジェクトオブジェクトモデルへのアクセスを信頼する'が無効" "White"
    Write-ColorOutput "- ファイルが読み取り専用または他のプロセスで使用中" "White"
    Write-ColorOutput "- PowerShellの実行ポリシー制限" "White"
}
finally {
    # リソースのクリーンアップ
    if ($workbook) {
        try {
            $workbook.Close($false)
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
        } catch { }
    }
    if ($excel) {
        try {
            $excel.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        } catch { }
    }
    
    # ガベージコレクション
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    Write-ColorOutput "`nリソースクリーンアップ完了" "Gray"
}

Write-ColorOutput "`n======================================" "Cyan"
