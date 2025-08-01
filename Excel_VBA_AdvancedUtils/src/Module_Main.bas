Option Explicit

Sub ShowMenu()
    Debug.Print "====================================="
    Debug.Print "AdvancedUtils v2.0 - CUI版メニュー"
    Debug.Print "====================================="
    Debug.Print "1. 重複ファイル検出・削除 - Call DetectDuplicates()"
    Debug.Print "2. ディスク使用量分析    - Call AnalyzeDisk()"
    Debug.Print "3. ファイル整理・分類    - Call OrganizeFiles()"
    Debug.Print "4. システム情報表示      - Call ShowSystemInfo()"
    Debug.Print "5. 設定フォーム表示      - Call ShowSettingsForm()"
    Debug.Print "====================================="
    Debug.Print "使用方法: 上記のCall文をコピーして実行"
    Debug.Print "出力先: " & GetOutputPath()
    Debug.Print "====================================="
End Sub

Sub DetectDuplicates()
    Dim targetPath As String
    targetPath = BrowseForFolder("重複ファイル検出対象フォルダを選択")
    
    If targetPath = "" Then
        Debug.Print "処理がキャンセルされました"
        Exit Sub
    End If
    
    Module_DuplicateDetector.DetectDuplicatesMain targetPath
End Sub

Sub AnalyzeDisk()
    Dim targetPath As String
    targetPath = BrowseForFolder("ディスク分析対象フォルダを選択")
    
    If targetPath = "" Then
        Debug.Print "処理がキャンセルされました"
        Exit Sub
    End If
    
    Module_DiskAnalyzer.AnalyzeDiskMain targetPath
End Sub

Sub OrganizeFiles()
    Dim targetPath As String
    targetPath = BrowseForFolder("ファイル整理対象フォルダを選択")
    
    If targetPath = "" Then
        Debug.Print "処理がキャンセルされました"
        Exit Sub
    End If
    
    Module_FileOrganizer.OrganizeFilesMain targetPath
End Sub

Sub ShowSystemInfo()
    Module_SystemInfo.ShowSystemInfoMain
End Sub

Sub ShowSettingsForm()
    UserForm_Simple.Show
End Sub

Sub Menu()
    ShowMenu
End Sub

Sub Help()
    Debug.Print "====================================="
    Debug.Print "AdvancedUtils ヘルプ"
    Debug.Print "====================================="
    Debug.Print "基本コマンド:"
    Debug.Print "  ShowMenu()        - メニュー表示"
    Debug.Print "  DetectDuplicates() - 重複ファイル検出"
    Debug.Print "  AnalyzeDisk()     - ディスク分析"
    Debug.Print "  OrganizeFiles()   - ファイル整理"
    Debug.Print "  ShowSystemInfo()  - システム情報"
    Debug.Print ""
    Debug.Print "出力先: " & GetOutputPath()
    Debug.Print "====================================="
End Sub
