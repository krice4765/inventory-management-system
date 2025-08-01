Private Sub UserForm_Initialize()
    ' フォーム初期化
    Me.Caption = "ファイル分割ツール v1.0"
    
    ' 分割単位の初期設定
    ComboBox_SplitUnit.Clear
    ComboBox_SplitUnit.AddItem "KB"
    ComboBox_SplitUnit.AddItem "MB"
    ComboBox_SplitUnit.AddItem "GB"
    ComboBox_SplitUnit.ListIndex = 1 ' MBを初期選択
    
    ' 初期値設定
    TextBox_SplitSize.Text = "10"
    
    ' ラベル設定
    Label_FileSelect.Caption = "分割するファイル:"
    Label_SplitSize.Caption = "分割サイズ:"
    Label_OutputFolder.Caption = "出力先フォルダ:"
    
    ' ボタン設定
    CommandButton_SelectFile.Caption = "ファイル選択..."
    CommandButton_SelectOutput.Caption = "出力先選択..."
    CommandButton_Execute.Caption = "分割実行"
    CommandButton_Cancel.Caption = "キャンセル"
End Sub

Private Sub CommandButton_SelectFile_Click()
    Dim fileDialog As FileDialog
    Set fileDialog = Application.FileDialog(msoFileDialogFilePicker)
    
    With fileDialog
        .Title = "分割するファイルを選択してください"
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
        .Title = "出力先フォルダを選択してください"
        
        If .Show = -1 Then
            TextBox_OutputPath.Text = .SelectedItems(1)
        End If
    End With
    
    Set folderDialog = Nothing
End Sub

Private Sub CommandButton_Execute_Click()
    ' 入力検証
    If Trim(TextBox_FilePath.Text) = "" Then
        MsgBox "分割するファイルを選択してください。", vbExclamation, "入力エラー"
        Exit Sub
    End If
    
    If Trim(TextBox_OutputPath.Text) = "" Then
        MsgBox "出力先フォルダを選択してください。", vbExclamation, "入力エラー"
        Exit Sub
    End If
    
    If Not IsNumeric(TextBox_SplitSize.Text) Or Val(TextBox_SplitSize.Text) <= 0 Then
        MsgBox "正しい分割サイズを入力してください。", vbExclamation, "入力エラー"
        Exit Sub
    End If
    
    ' ファイル存在確認
    If Not Module_Utility.ValidateFilePath(TextBox_FilePath.Text) Then
        MsgBox "指定されたファイルが見つかりません。", vbExclamation, "ファイルエラー"
        Exit Sub
    End If
    
    ' フォルダ存在確認
    If Not Module_Utility.ValidateFolderPath(TextBox_OutputPath.Text) Then
        MsgBox "指定された出力先フォルダが見つかりません。", vbExclamation, "フォルダエラー"
        Exit Sub
    End If
    
    ' ファイル分割処理の実行
    Dim splitter As New Class_FileSplitter
    Dim splitSizeBytes As Double
    
    ' サイズをバイトに変換
    splitSizeBytes = Module_Utility.ConvertSizeToBytes(Val(TextBox_SplitSize.Text), ComboBox_SplitUnit.Text)
    
    ' 進捗フォーム表示
    Load UserForm_Progress
    UserForm_Progress.Show vbModeless
    
    ' 分割実行
    Dim result As Boolean
    result = splitter.SplitFile(TextBox_FilePath.Text, TextBox_OutputPath.Text, splitSizeBytes)
    
    ' 進捗フォームを閉じる
    Unload UserForm_Progress
    
    If result Then
        MsgBox "ファイル分割が完了しました。", vbInformation, "完了"
    Else
        MsgBox "ファイル分割中にエラーが発生しました。", vbCritical, "エラー"
    End If
    
    Set splitter = Nothing
End Sub

Private Sub CommandButton_Cancel_Click()
    Unload Me
End Sub
