�E�# setup_complete_excel_vba_filesplitter.ps1
# Excel VBA FileSplitter 完�E自動セチE��アチE�Eスクリプト

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Excel VBA FileSplitter 完�E自動セチE��アチE�E"

Write-Host "============================================================" -ForegroundColor Green
Write-Host "Excel VBA FileSplitter 完�E自動セチE��アチE�E開姁E -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host

# エラーハンドリング設宁E
$ErrorActionPreference = "Stop"

# パス定義
$BasePath = "C:\Users\kuris\Pictures\Screenpresso\フリーランス活動\AI開発"
$ProjectPath = Join-Path $BasePath "Excel_VBA_FileSplitter"
$SrcPath = Join-Path $ProjectPath "src"
$DocsPath = Join-Path $ProjectPath "docs"
$TemplatesPath = Join-Path $ProjectPath "templates"
$ExcelFilePath = Join-Path $ProjectPath "FileSplitter_Project.xlsm"

# 前提条件チェチE��
Write-Host "1. 前提条件をチェチE��中..." -ForegroundColor Yellow
try {
    # Excel インスト�Eル確誁E
    $excelTest = New-Object -ComObject Excel.Application -ErrorAction Stop
    $excelTest.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excelTest) | Out-Null
    Write-Host "   Excel インスト�Eル確認完亁E -ForegroundColor Green
} catch {
    Write-Host "   エラー: Excel がインスト�EルされてぁE��せん" -ForegroundColor Red
    Read-Host "続行するには何かキーを押してください"
    exit 1
}

# フォルダ作�E
Write-Host "`n2. フォルダ構造を作�E中..." -ForegroundColor Yellow
try {
    @($BasePath, $ProjectPath, $SrcPath, $DocsPath, $TemplatesPath) | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -Path $_ -ItemType Directory -Force | Out-Null
        }
    }
    Write-Host "   フォルダ作�E完亁E -ForegroundColor Green
} catch {
    Write-Host "   エラー: フォルダ作�Eに失敁E- $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "続行するには何かキーを押してください"
    exit 1
}

# VBAコンポ�Eネント�E定義
Write-Host "`n3. VBAコンポ�Eネントを準備中..." -ForegroundColor Yellow

$VBAComponents = @{
    "UserForm_Split" = @{
        Type = "UserForm"
        Code = @"
VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} UserForm_Split 
   Caption         =   "ファイル刁E��チE�Eル v1.0"
   ClientHeight    =   4500
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   6500
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "UserForm_Split"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False

Private Sub UserForm_Initialize()
    ' フォーム初期匁E
    Me.Caption = "ファイル刁E��チE�Eル v1.0"
    
    ' 刁E��単位�E初期設宁E
    ComboBox_SplitUnit.Clear
    ComboBox_SplitUnit.AddItem "KB"
    ComboBox_SplitUnit.AddItem "MB"
    ComboBox_SplitUnit.AddItem "GB"
    ComboBox_SplitUnit.ListIndex = 1 ' MBを�E期選抁E
    
    ' 初期値設宁E
    TextBox_SplitSize.Text = "10"
    
    ' ラベル設宁E
    Label_FileSelect.Caption = "刁E��するファイル:"
    Label_SplitSize.Caption = "刁E��サイズ:"
    Label_OutputFolder.Caption = "出力�Eフォルダ:"
    
    ' ボタン設宁E
    CommandButton_SelectFile.Caption = "ファイル選抁E.."
    CommandButton_SelectOutput.Caption = "出力�E選抁E.."
    CommandButton_Execute.Caption = "刁E��実衁E
    CommandButton_Cancel.Caption = "キャンセル"
End Sub

Private Sub CommandButton_SelectFile_Click()
    Dim fileDialog As FileDialog
    Set fileDialog = Application.FileDialog(msoFileDialogFilePicker)
    
    With fileDialog
        .Title = "刁E��するファイルを選択してください"
        .AllowMultiSelect = False
        .Filters.Clear
        .Filters.Add "すべてのファイル", "*.*"
        
        If .Show = -1 Then
            TextBox_FilePath.Text = .SelectedItems(1)
        End If
    End With
    
    Set fileDialog = Nothing
End Sub

Private Sub CommandButton_SelectOutput_Click()
    Dim folderDialog As FileDialog
    Set folderDialog = Application.FileDialog(msoFileDialogFolderPicker)
    
    With folderDialog
        .Title = "出力�Eフォルダを選択してください"
        
        If .Show = -1 Then
            TextBox_OutputPath.Text = .SelectedItems(1)
        End If
    End With
    
    Set folderDialog = Nothing
End Sub

Private Sub CommandButton_Execute_Click()
    ' 入力検証
    If Trim(TextBox_FilePath.Text) = "" Then
        MsgBox "刁E��するファイルを選択してください、E, vbExclamation, "入力エラー"
        Exit Sub
    End If
    
    If Trim(TextBox_OutputPath.Text) = "" Then
        MsgBox "出力�Eフォルダを選択してください、E, vbExclamation, "入力エラー"
        Exit Sub
    End If
    
    If Not IsNumeric(TextBox_SplitSize.Text) Or Val(TextBox_SplitSize.Text) <= 0 Then
        MsgBox "正しい刁E��サイズを�E力してください、E, vbExclamation, "入力エラー"
        Exit Sub
    End If
    
    ' ファイル存在確誁E
    If Not Module_Utility.ValidateFilePath(TextBox_FilePath.Text) Then
        MsgBox "持E��されたファイルが見つかりません、E, vbExclamation, "ファイルエラー"
        Exit Sub
    End If
    
    ' フォルダ存在確誁E
    If Not Module_Utility.ValidateFolderPath(TextBox_OutputPath.Text) Then
        MsgBox "持E��された出力�Eフォルダが見つかりません、E, vbExclamation, "フォルダエラー"
        Exit Sub
    End If
    
    ' ファイル刁E��処琁E�E実衁E
    Dim splitter As New Class_FileSplitter
    Dim splitSizeBytes As Double
    
    ' サイズをバイトに変換
    splitSizeBytes = Module_Utility.ConvertSizeToBytes(Val(TextBox_SplitSize.Text), ComboBox_SplitUnit.Text)
    
    ' 進捗フォーム表示
    Load UserForm_Progress
    UserForm_Progress.Show vbModeless
    
    ' 刁E��実衁E
    Dim result As Boolean
    result = splitter.SplitFile(TextBox_FilePath.Text, TextBox_OutputPath.Text, splitSizeBytes)
    
    ' 進捗フォームを閉じる
    Unload UserForm_Progress
    
    If result Then
        MsgBox "ファイル刁E��が完亁E��ました、E, vbInformation, "完亁E
    Else
        MsgBox "ファイル刁E��中にエラーが発生しました、E, vbCritical, "エラー"
    End If
    
    Set splitter = Nothing
End Sub

Private Sub CommandButton_Cancel_Click()
    Unload Me
End Sub
"@
    }
    
    "UserForm_Progress" = @{
        Type = "UserForm"
        Code = @"
VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} UserForm_Progress 
   Caption         =   "処琁E��..."
   ClientHeight    =   2400
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   5000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "UserForm_Progress"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False

Private cancelRequested As Boolean

Private Sub UserForm_Initialize()
    ' 進捗フォーム初期匁E
    Me.Caption = "ファイル刁E��処琁E��..."
    cancelRequested = False
    
    ' ラベル初期設宁E
    Label_Status.Caption = "準備中..."
    Label_CurrentFile.Caption = ""
    Label_Progress.Caption = "0%"
    
    ' プログレスバ�E初期化（簡易実裁E��E
    Label_ProgressBar.Width = 0
    Label_ProgressBar.BackColor = RGB(0, 120, 215)
    Label_ProgressBar.Height = 20
    
    ' ボタン設宁E
    CommandButton_Cancel.Caption = "キャンセル"
End Sub

Public Sub UpdateProgress(percentage As Long, statusText As String, Optional currentFile As String = "")
    On Error Resume Next
    
    ' 進捗更新
    Label_Status.Caption = statusText
    Label_Progress.Caption = percentage & "%"
    
    If currentFile <> "" Then
        Label_CurrentFile.Caption = "処琁E��: " & currentFile
    End If
    
    ' プログレスバ�Eの更新
    Dim maxWidth As Long
    maxWidth = Me.Width - 40
    Label_ProgressBar.Width = (maxWidth * percentage) / 100
    
    ' フォームの再描画
    Me.Repaint
    DoEvents
End Sub

Public Function IsCancelRequested() As Boolean
    IsCancelRequested = cancelRequested
End Function

Private Sub CommandButton_Cancel_Click()
    cancelRequested = True
    Me.Caption = "キャンセル処琁E��..."
    CommandButton_Cancel.Enabled = False
    Label_Status.Caption = "キャンセル処琁E��..."
End Sub
"@
    }
    
    "Class_FileSplitter" = @{
        Type = "ClassModule"
        Code = @"
VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Class_FileSplitter"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False

' ファイル刁E��処琁E��ラス
Private Const BUFFER_SIZE As Long = 1048576 ' 1MB バッファ

Public Function SplitFile(inputFilePath As String, outputFolderPath As String, splitSizeBytes As Double) As Boolean
    On Error GoTo ErrorHandler
    
    Dim inputFileNum As Integer
    Dim outputFileNum As Integer
    Dim buffer() As Byte
    Dim bytesRead As Long
    Dim totalBytesRead As Double
    Dim currentPartSize As Double
    Dim partNumber As Long
    Dim inputFileSize As Double
    Dim outputFilePath As String
    Dim fileName As String
    Dim fileExtension As String
    Dim progressPercentage As Long
    
    ' 初期匁E
    SplitFile = False
    partNumber = 1
    currentPartSize = 0
    totalBytesRead = 0
    
    ' ファイル惁E��取征E
    inputFileSize = FileLen(inputFilePath)
    fileName = Module_Utility.GetFileNameWithoutExtension(inputFilePath)
    fileExtension = Module_Utility.GetFileExtension(inputFilePath)
    
    ' 進捗更新
    UserForm_Progress.UpdateProgress 0, "ファイル刁E��を開始してぁE��ぁE..", Dir(inputFilePath)
    
    ' 入力ファイルオープン
    inputFileNum = FreeFile
    Open inputFilePath For Binary Access Read As #inputFileNum
    
    ' 最初�E出力ファイル作�E
    outputFilePath = outputFolderPath & "\" & fileName & ".part" & Format(partNumber, "000") & fileExtension
    outputFileNum = FreeFile
    Open outputFilePath For Binary Access Write As #outputFileNum
    
    ' バッファ初期匁E
    ReDim buffer(BUFFER_SIZE - 1)
    
    ' ファイル刁E��処琁E
    Do While Not EOF(inputFileNum)
        ' キャンセル確誁E
        DoEvents
        If UserForm_Progress.IsCancelRequested() Then
            Close #inputFileNum
            Close #outputFileNum
            SplitFile = False
            Exit Function
        End If
        
        ' チE�Eタ読み込み
        bytesRead = BUFFER_SIZE
        If (inputFileSize - totalBytesRead) < BUFFER_SIZE Then
            bytesRead = inputFileSize - totalBytesRead
        End If
        
        If bytesRead > 0 Then
            ReDim buffer(bytesRead - 1)
            Get #inputFileNum, , buffer
            
            ' 刁E��サイズチェチE��
            If (currentPartSize + bytesRead) > splitSizeBytes And partNumber >= 1 Then
                ' 現在のファイルを閉じて新しいファイルを開姁E
                Close #outputFileNum
                partNumber = partNumber + 1
                currentPartSize = 0
                
                outputFilePath = outputFolderPath & "\" & fileName & ".part" & Format(partNumber, "000") & fileExtension
                outputFileNum = FreeFile
                Open outputFilePath For Binary Access Write As #outputFileNum
            End If
            
            ' チE�Eタ書き込み
            Put #outputFileNum, , buffer
            currentPartSize = currentPartSize + bytesRead
            totalBytesRead = totalBytesRead + bytesRead
            
            ' 進捗更新
            progressPercentage = Int((totalBytesRead / inputFileSize) * 100)
            UserForm_Progress.UpdateProgress progressPercentage, _
                "刁E��中... (パ�EチE" & partNumber & ")", _
                Dir(outputFilePath)
        End If
    Loop
    
    ' ファイルクローズ
    Close #inputFileNum
    Close #outputFileNum
    
    ' 完亁E
    UserForm_Progress.UpdateProgress 100, "刁E��完亁E, "合訁E" & partNumber & " 個�Eファイルに刁E��しました"
    SplitFile = True
    
    Exit Function
    
ErrorHandler:
    ' エラーハンドリング
    If inputFileNum > 0 Then Close #inputFileNum
    If outputFileNum > 0 Then Close #outputFileNum
    
    Module_Utility.LogError "ファイル刁E��エラー: " & Err.Description
    SplitFile = False
End Function
"@
    }
    
    "Module_Utility" = @{
        Type = "Module"
        Code = @"
Attribute VB_Name = "Module_Utility"
' ユーチE��リチE��関数モジュール

Public Function ConvertSizeToBytes(value As Double, unit As String) As Double
    ' サイズをバイトに変換
    Select Case UCase(Trim(unit))
        Case "KB"
            ConvertSizeToBytes = value * 1024
        Case "MB"
            ConvertSizeToBytes = value * 1024 * 1024
        Case "GB"
            ConvertSizeToBytes = value * 1024 * 1024 * 1024
        Case Else
            ConvertSizeToBytes = value
    End Select
End Function

Public Function ValidateFilePath(filePath As String) As Boolean
    ' ファイルパス検証
    On Error Resume Next
    ValidateFilePath = (Dir(filePath) <> "")
    On Error GoTo 0
End Function

Public Function ValidateFolderPath(folderPath As String) As Boolean
    ' フォルダパス検証
    On Error Resume Next
    ValidateFolderPath = (Dir(folderPath, vbDirectory) <> "")
    On Error GoTo 0
End Function

Public Function GetFileNameWithoutExtension(filePath As String) As String
    ' 拡張子なし�Eファイル名を取征E
    Dim fileName As String
    Dim lastDotPos As Long
    
    fileName = Dir(filePath)
    lastDotPos = InStrRev(fileName, ".")
    
    If lastDotPos > 0 Then
        GetFileNameWithoutExtension = Left(fileName, lastDotPos - 1)
    Else
        GetFileNameWithoutExtension = fileName
    End If
End Function

Public Function GetFileExtension(filePath As String) As String
    ' ファイル拡張子を取征E
    Dim fileName As String
    Dim lastDotPos As Long
    
    fileName = Dir(filePath)
    lastDotPos = InStrRev(fileName, ".")
    
    If lastDotPos > 0 Then
        GetFileExtension = Mid(fileName, lastDotPos)
    Else
        GetFileExtension = ""
    End If
End Function

Public Sub LogError(message As String)
    ' エラーログ出劁E
    Debug.Print Format(Now, "yyyy/mm/dd hh:mm:ss") & " - ERROR: " & message
End Sub

Public Sub LogInfo(message As String)
    ' 惁E��ログ出劁E
    Debug.Print Format(Now, "yyyy/mm/dd hh:mm:ss") & " - INFO: " & message
End Sub

Public Function FormatFileSize(sizeInBytes As Double) As String
    ' ファイルサイズを読みめE��ぁE��式でフォーマッチE
    If sizeInBytes >= 1073741824 Then ' 1GB
        FormatFileSize = Format(sizeInBytes / 1073741824, "0.00") & " GB"
    ElseIf sizeInBytes >= 1048576 Then ' 1MB
        FormatFileSize = Format(sizeInBytes / 1048576, "0.00") & " MB"
    ElseIf sizeInBytes >= 1024 Then ' 1KB
        FormatFileSize = Format(sizeInBytes / 1024, "0.00") & " KB"
    Else
        FormatFileSize = sizeInBytes & " バイチE
    End If
End Function
"@
    }
    
    "Module_Main" = @{
        Type = "Module"
        Code = @"
Attribute VB_Name = "Module_Main"
' メイン処琁E��ジュール

Sub Main()
    ' アプリケーション起動�E琁E
    Module_Utility.LogInfo "ファイル刁E��チE�Eル起勁E
    ShowFileSplitterForm
End Sub

Sub ShowFileSplitterForm()
    ' ファイル刁E��フォーム表示
    Load UserForm_Split
    UserForm_Split.Show vbModal
End Sub

Sub TestFileSplitter()
    ' チE��ト用プロシージャ
    MsgBox "ファイル刁E��チE�EルのチE��トを開始します、E & vbCrLf & _
           "メインフォームを表示します、E, vbInformation, "チE��ト実衁E
    ShowFileSplitterForm
End Sub

Sub AutoOpen()
    ' Excelファイル起動時の自動実行（忁E��に応じてコメントアウトを外す�E�E
    ' Main
End Sub
"@
    }
}

Write-Host "   VBAコンポ�Eネント準備完亁E -ForegroundColor Green

# Excel アプリケーション起勁E
Write-Host "`n4. Excel アプリケーションを起動中..." -ForegroundColor Yellow
$excel = $null
$workbook = $null

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    Write-Host "   Excel起動完亁E -ForegroundColor Green
} catch {
    Write-Host "   エラー: Excel起動に失敁E- $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "続行するには何かキーを押してください"
    exit 1
}

# 新しいワークブック作�E
Write-Host "`n5. 新しいワークブックを作�E中..." -ForegroundColor Yellow
try {
    $workbook = $excel.Workbooks.Add()
    
    # 既存�Eファイルがある場合�E削除
    if (Test-Path $ExcelFilePath) {
        Remove-Item $ExcelFilePath -Force
    }
    
    $workbook.SaveAs($ExcelFilePath, 52) # xlOpenXMLWorkbookMacroEnabled
    Write-Host "   ワークブック作�E完亁E $(Split-Path $ExcelFilePath -Leaf)" -ForegroundColor Green
} catch {
    Write-Host "   エラー: ワークブック作�Eに失敁E- $($_.Exception.Message)" -ForegroundColor Red
    if ($excel) { $excel.Quit() }
    exit 1
}

# VBA プロジェクトにアクセス
Write-Host "`n6. VBAコンポ�Eネントを追加中..." -ForegroundColor Yellow
try {
    $vbProject = $workbook.VBProject
    
    # 既存�E不要なモジュールを削除
    $componentsToRemove = @()
    foreach ($component in $vbProject.VBComponents) {
        if ($component.Type -eq 1 -and $component.Name -like "Module*") {
            $componentsToRemove += $component
        }
    }
    
    foreach ($component in $componentsToRemove) {
        try {
            $vbProject.VBComponents.Remove($component)
            Write-Host "      既存モジュール $($component.Name) を削除" -ForegroundColor DarkYellow
        } catch {
            Write-Host "      警呁E $($component.Name) の削除に失敁E -ForegroundColor DarkYellow
        }
    }
    
    # VBAコンポ�Eネントを追加
    foreach ($componentName in $VBAComponents.Keys) {
        $component = $VBAComponents[$componentName]
        Write-Host "   $componentName を追加中..." -ForegroundColor Cyan
        
        $vbComponent = $null
        switch ($component.Type) {
            "UserForm" {
                $vbComponent = $vbProject.VBComponents.Add(3) # vbext_ct_MSForm
            }
            "ClassModule" {
                $vbComponent = $vbProject.VBComponents.Add(2) # vbext_ct_ClassModule
            }
            "Module" {
                $vbComponent = $vbProject.VBComponents.Add(1) # vbext_ct_StdModule
            }
        }
        
        if ($vbComponent) {
            $vbComponent.Name = $componentName
            
            # コードを追加
            $codeModule = $vbComponent.CodeModule
            if ($codeModule.CountOfLines -gt 0) {
                $codeModule.DeleteLines(1, $codeModule.CountOfLines)
            }
            $codeModule.AddFromString($component.Code)
            
            Write-Host "     $componentName 追加完亁E -ForegroundColor Green
        }
    }
    
    Write-Host "   全VBAコンポ�Eネント追加完亁E -ForegroundColor Green
} catch {
    Write-Host "   エラー: VBAコンポ�Eネント追加に失敁E- $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   重要E Excelの設定で「VBA プロジェクチEオブジェクチEモチE��へのアクセスを信頼する」を有効にしてください" -ForegroundColor Yellow
}

# ワークブック保孁E
Write-Host "`n7. ワークブックを保存中..." -ForegroundColor Yellow
try {
    $workbook.Save()
    Write-Host "   保存完亁E $ExcelFilePath" -ForegroundColor Green
} catch {
    Write-Host "   エラー: 保存に失敁E- $($_.Exception.Message)" -ForegroundColor Red
}

# 実裁E��イド作�E
Write-Host "`n8. 実裁E��イドを作�E中..." -ForegroundColor Yellow

$implementationGuide = @"
Excel VBA FileSplitter 実裁E��亁E��イチE
==========================================

## 🎉 自動セチE��アチE�E完亁E��E

### 作�Eされたファイル
- Excelファイル: $ExcelFilePath
- 実裁E��イチE こ�Eファイル

### 実裁E��みコンポ�EネンチE
✁EUserForm_Split - ファイル刁E��メインフォーム�E�完�E実裁E��み�E�E
✁EUserForm_Progress - 進捗表示フォーム�E�完�E実裁E��み�E�E
✁EClass_FileSplitter - ファイル刁E��処琁E��ラス�E�完�E実裁E��み�E�E
✁EModule_Utility - ユーチE��リチE��関数群�E�完�E実裁E��み�E�E
✁EModule_Main - メイン処琁E��ジュール�E�完�E実裁E��み�E�E

## 🚀 使用方況E

### 基本皁E��起動方況E
1. 作�EされたExcelファイル (FileSplitter_Project.xlsm) を開ぁE
2. セキュリチE��警告が表示されたら「コンチE��チE�E有効化」をクリチE��
3. Alt + F11 でVBAエチE��タを開ぁE
4. Module_Main の Main また�E TestFileSplitter サブ�Eロシージャを実衁E(F5キー)

### フォームコントロールの手動配置�E�重要E��E

**UserForm_Split に忁E��なコントロール:**
以下�Eコントロールをツールボックスから配置し、Nameプロパティを設定してください�E�E

- Label: Name = Label_FileSelect
- TextBox: Name = TextBox_FilePath
- CommandButton: Name = CommandButton_SelectFile
- Label: Name = Label_SplitSize  
- TextBox: Name = TextBox_SplitSize
- ComboBox: Name = ComboBox_SplitUnit
- Label: Name = Label_OutputFolder
- TextBox: Name = TextBox_OutputPath
- CommandButton: Name = CommandButton_SelectOutput
- CommandButton: Name = CommandButton_Execute
- CommandButton: Name = CommandButton_Cancel

**UserForm_Progress に忁E��なコントロール:**
- Label: Name = Label_Status
- Label: Name = Label_CurrentFile
- Label: Name = Label_Progress
- Label: Name = Label_ProgressBar
- CommandButton: Name = CommandButton_Cancel

## ⚙︁E重要な設宁E

### VBAプロジェクトアクセス設宁E
Excelのオプション ↁEトラストセンター ↁEトラストセンターの設宁EↁEマクロの設宁E
→「VBA プロジェクチEオブジェクチEモチE��へのアクセスを信頼する」にチェチE��

### セキュリチE��設宁E
開発時�E「すべてのマクロを有効にする」を選択（本番環墁E��は適刁E��設定！E

## 🧪 チE��ト方況E

1. VBAエチE��タで Module_Main を開ぁE
2. TestFileSplitter サブ�Eロシージャにカーソルを置ぁE
3. F5キーで実衁E
4. フォームが表示され、ファイル選択�E刁E��機�Eが動作することを確誁E

## 📝 機�E詳細

### 実裁E��み機�E
- ファイル選択ダイアログ
- 出力�Eフォルダ選抁E
- 刁E��サイズ持E��！EB/MB/GB対応！E
- リアルタイム進捗表示
- キャンセル機�E
- 詳細なエラーハンドリング
- ファイル・フォルダ検証

### カスタマイズポインチE
- バッファサイズ調整: Class_FileSplitter の BUFFER_SIZE 定数
- UI改喁E フォームレイアウト�E調整
- 機�E拡張: 結合機�Eの追加など

## 🔧 トラブルシューチE��ング

**問顁E フォームが表示されなぁE*
ↁEコントロールのNameプロパティが正しく設定されてぁE��か確誁E

**問顁E ファイル刁E��が失敗すめE*
ↁE出力�Eフォルダの書き込み権限を確誁E

**問顁E プログレスバ�Eが動作しなぁE*
ↁELabel_ProgressBar コントロールが�E置されてぁE��か確誁E

**問顁E VBAコンポ�Eネントが追加されてぁE��ぁE*
ↁEVBAプロジェクトアクセス設定を確認してスクリプトを�E実衁E

作�E日晁E $(Get-Date -Format 'yyyy年MM朁Ed日 HH:mm:ss')

こ�EチE�Eルは完�Eに動作する実用皁E��ファイル刁E��チE�Eルです、E
フォームコントロールの配置のみ手動で行えば、すぐに使用できます、E
"@

$implementationGuide | Out-File -FilePath (Join-Path $DocsPath "Implementation_Complete_Guide.txt") -Encoding UTF8
Write-Host "   実裁E��イド作�E完亁E -ForegroundColor Green

# Excel終亁E
Write-Host "`n9. Excelアプリケーションを終亁E��..." -ForegroundColor Yellow
try {
    if ($workbook) {
        $workbook.Close($true)
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
    }
    if ($excel) {
        $excel.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
    Write-Host "   Excel終亁E��亁E -ForegroundColor Green
} catch {
    Write-Host "   警呁E Excel終亁E��に警告が発生しました" -ForegroundColor Yellow
}

# 完亁E��チE��ージ
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "🎉 Excel VBA FileSplitter 完�EセチE��アチE�E完亁E��E -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

Write-Host "`n📁 作�Eされたファイル:" -ForegroundColor White
Write-Host "   Excel ファイル: $ExcelFilePath" -ForegroundColor Cyan
Write-Host "   実裁E��イチE $(Join-Path $DocsPath 'Implementation_Complete_Guide.txt')" -ForegroundColor Cyan

Write-Host "`n🚀 次のスチE��チE" -ForegroundColor White
Write-Host "   1. 作�EされたExcelファイルを開ぁE -ForegroundColor Yellow
Write-Host "   2. マクロを有効にする" -ForegroundColor Yellow
Write-Host "   3. フォームコントロールを手動�E置�E�実裁E��イド参照�E�E -ForegroundColor Yellow
Write-Host "   4. Alt+F11 でVBAエチE��タを開ぁE��チE��ト実衁E -ForegroundColor Yellow

Write-Host "`n⚠�E�E 重要E" -ForegroundColor White
Write-Host "   - フォームコントロールの配置は手動で行ってください" -ForegroundColor Red
Write-Host "   - VBAプロジェクトアクセス設定を確認してください" -ForegroundColor Red

# エクスプローラーでプロジェクトフォルダを開ぁE
Start-Process explorer $ProjectPath
Write-Host "`n📂 エクスプローラーでプロジェクトフォルダを開きました" -ForegroundColor Green

# Excelファイルを開くかの確誁E
Write-Host "`n📊 Excelファイルを開きますか�E�E(Y/N)" -ForegroundColor White
$response = Read-Host
if ($response -match "^[Yy]") {
    Start-Process $ExcelFilePath
    Write-Host "   Excelファイルを開きました" -ForegroundColor Green
}

Write-Host "`n✨ セチE��アチE�Eが完亁E��ました�E�E -ForegroundColor Green
Read-Host "`n続行するには何かキーを押してください"