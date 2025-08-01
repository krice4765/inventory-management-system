# setup_excel_vba_project.ps1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Excel VBA FileSplitter セットアップ"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Excel VBA FileSplitter セットアップ開始" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host

# パス定義
$BasePath = "C:\Users\kuris\Pictures\Screenpresso\フリーランス活動\AI開発"
$ProjectPath = Join-Path $BasePath "Excel_VBA_FileSplitter"
$SrcPath = Join-Path $ProjectPath "src"
$DocsPath = Join-Path $ProjectPath "docs"
$TemplatesPath = Join-Path $ProjectPath "templates"

# フォルダ作成
Write-Host "1. フォルダ構造を作成中..." -ForegroundColor Yellow
try {
    @($BasePath, $ProjectPath, $SrcPath, $DocsPath, $TemplatesPath) | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -Path $_ -ItemType Directory -Force | Out-Null
        }
    }
    Write-Host "   フォルダ作成完了: $ProjectPath" -ForegroundColor Green
} catch {
    Write-Host "   エラー: フォルダ作成に失敗 - $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "続行するには何かキーを押してください"
    exit 1
}

# VBAファイル作成
Write-Host "`n2. VBAコンポーネントファイルを作成中..." -ForegroundColor Yellow

$vbaFiles = @{
    "UserForm_Split.frm" = @"
' UserForm_Split - ファイル分割用フォーム
' 以下にUserForm_Splitのコードを貼り付けてください

Private Sub UserForm_Initialize()
    ' フォーム初期化処理
End Sub

Private Sub CommandButton_Execute_Click()
    ' ファイル分割実行処理
End Sub
"@
    "UserForm_Progress.frm" = @"
' UserForm_Progress - 進捗表示用フォーム
' 以下にUserForm_Progressのコードを貼り付けてください

Private Sub UserForm_Initialize()
    ' 進捗フォーム初期化処理
End Sub

Public Sub UpdateProgress(percentage As Long, statusText As String)
    ' 進捗更新処理
End Sub
"@
    "Class_FileSplitter.cls" = @"
' Class_FileSplitter - ファイル分割処理クラス
' 以下にClass_FileSplitterのコードを貼り付けてください

Private Type TFileSplitter
    ' クラス変数定義
End Type

Private this As TFileSplitter

Public Sub Initialize()
    ' クラス初期化処理
End Sub
"@
    "Module_Utility.bas" = @"
' Module_Utility - ユーティリティ関数モジュール
' 以下にModule_Utilityのコードを貼り付けてください

Public Function ConvertSize(value As Double, unit As String) As Double
    ' サイズ変換処理
End Function

Public Function ValidatePath(path As String) As Boolean
    ' パス検証処理
End Function
"@
    "Module_Main.bas" = @"
' Module_Main - メイン処理モジュール
' 以下にModule_Mainのコードを貼り付けてください

Sub Main()
    ' アプリケーション起動処理
End Sub

Sub ShowFileSplitterForm()
    ' フォーム表示処理
End Sub
"@
}

foreach ($file in $vbaFiles.GetEnumerator()) {
    $filePath = Join-Path $SrcPath $file.Key
    $file.Value | Out-File -FilePath $filePath -Encoding UTF8
    Write-Host "   $($file.Key) を作成しました" -ForegroundColor Green
}

Write-Host "`n3. 実装ガイドを作成中..." -ForegroundColor Yellow
# 実装ガイドの内容は上記のバッチファイルと同じ内容をここに記述

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "セットアップ完了！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# エクスプローラーでフォルダを開く
Start-Process explorer $ProjectPath
Write-Host "`nエクスプローラーでプロジェクトフォルダを開きました" -ForegroundColor Green

Read-Host "`n続行するには何かキーを押してください"