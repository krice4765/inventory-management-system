Option Explicit

Sub DetectDuplicatesMain(targetFolder As String)
    Debug.Print "====================================="
    Debug.Print "重複ファイル検出開始"
    Debug.Print "対象フォルダ: " & targetFolder
    Debug.Print "====================================="
    
    Dim fileDict As Object
    Set fileDict = CreateDictionary()
    
    Dim duplicates As Object
    Set duplicates = CreateDictionary()
    
    ScanForDuplicates targetFolder, fileDict, duplicates
    
    Dim reportContent As String
    reportContent = "重複ファイル検出レポート (" & Now & ")" & vbCrLf
    reportContent = reportContent & String(50, "=") & vbCrLf
    reportContent = reportContent & "対象フォルダ: " & targetFolder & vbCrLf & vbCrLf
    
    If duplicates.Count = 0 Then
        Debug.Print "重複ファイルは見つかりませんでした。"
        reportContent = reportContent & "重複ファイルは見つかりませんでした。"
    Else
        Debug.Print "重複ファイルが見つかりました (" & duplicates.Count & "グループ):"
        reportContent = reportContent & "重複ファイルが見つかりました (" & duplicates.Count & "グループ):" & vbCrLf
        
        Dim key As Variant
        For Each key In duplicates.Keys
            Debug.Print vbCrLf & "グループ " & key & ":"
            reportContent = reportContent & vbCrLf & "グループ " & key & ":" & vbCrLf
            
            Dim fileList As Variant
            fileList = Split(duplicates(key), "|")
            
            Dim i As Integer
            For i = 0 To UBound(fileList)
                Debug.Print "  - " & fileList(i)
                reportContent = reportContent & "  - " & fileList(i) & vbCrLf
            Next i
        Next key
        
        Dim confirmDelete As VbMsgBoxResult
        confirmDelete = MsgBox("重複ファイルを削除しますか？（最初の1つを残して削除）", vbYesNo + vbQuestion, "削除確認")
        
        If confirmDelete = vbYes Then
            DeleteDuplicateFiles duplicates, reportContent
        End If
    End If
    
    Dim outputFile As String
    outputFile = GetOutputPath() & "\duplicate_files_report.txt"
    WriteTextToFile outputFile, reportContent
    
    Debug.Print "レポート保存完了: " & outputFile
    Debug.Print "====================================="
End Sub

Private Sub ScanForDuplicates(folderPath As String, fileDict As Object, duplicates As Object)
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    Dim folder As Object
    Set folder = fso.GetFolder(folderPath)
    
    Dim file As Object
    For Each file In folder.Files
        Dim fileHash As String
        fileHash = GetSimpleFileHash(file.Path)
        
        If fileHash <> "" Then
            If fileDict.Exists(fileHash) Then
                If duplicates.Exists(fileHash) Then
                    duplicates(fileHash) = duplicates(fileHash) & "|" & file.Path
                Else
                    duplicates.Add fileHash, fileDict(fileHash) & "|" & file.Path
                End If
                Debug.Print "重複発見: " & file.Name
            Else
                fileDict.Add fileHash, file.Path
            End If
        End If
    Next file
    
    Dim subFolder As Object
    For Each subFolder In folder.SubFolders
        ScanForDuplicates subFolder.Path, fileDict, duplicates
    Next subFolder
End Sub

Private Sub DeleteDuplicateFiles(duplicates As Object, ByRef reportContent As String)
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    Debug.Print vbCrLf & "重複ファイル削除開始..."
    reportContent = reportContent & vbCrLf & "重複ファイル削除開始..." & vbCrLf
    
    Dim key As Variant
    For Each key In duplicates.Keys
        Dim fileList As Variant
        fileList = Split(duplicates(key), "|")
        
        Dim i As Integer
        For i = 1 To UBound(fileList)
            On Error Resume Next
            fso.DeleteFile fileList(i), True
            If Err.Number = 0 Then
                Debug.Print "削除完了: " & fileList(i)
                reportContent = reportContent & "削除完了: " & fileList(i) & vbCrLf
            Else
                Debug.Print "削除失敗: " & fileList(i) & " (" & Err.Description & ")"
                reportContent = reportContent & "削除失敗: " & fileList(i) & " (" & Err.Description & ")" & vbCrLf
            End If
            On Error GoTo 0
        Next i
    Next key
    
    Debug.Print "重複ファイル削除完了"
    reportContent = reportContent & "重複ファイル削除完了" & vbCrLf
End Sub
