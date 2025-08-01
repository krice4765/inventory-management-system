Option Explicit

Sub OrganizeFilesMain(targetFolder As String)
    Debug.Print "====================================="
    Debug.Print "ファイル整理・分類開始"
    Debug.Print "対象フォルダ: " & targetFolder
    Debug.Print "====================================="
    
    Dim logContent As String
    logContent = "ファイル整理ログ (" & Now & ")" & vbCrLf
    logContent = logContent & String(50, "=") & vbCrLf
    logContent = logContent & "対象フォルダ: " & targetFolder & vbCrLf & vbCrLf
    
    logContent = logContent & "【処理前状況】" & vbCrLf
    logContent = logContent & GetFileSummary(targetFolder) & vbCrLf
    
    OrganizeByExtension targetFolder, logContent
    
    logContent = logContent & vbCrLf & "【処理後状況】" & vbCrLf
    logContent = logContent & GetFileSummary(targetFolder) & vbCrLf
    
    Dim outputFile As String
    outputFile = GetOutputPath() & "\file_organization_log.txt"
    WriteTextToFile outputFile, logContent
    
    Debug.Print "整理完了 - ログ: " & outputFile
    Debug.Print "====================================="
End Sub

Private Sub OrganizeByExtension(folderPath As String, ByRef logContent As String)
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    Dim folder As Object
    Set folder = fso.GetFolder(folderPath)
    
    Dim file As Object
    For Each file In folder.Files
        Dim fileExt As String
        fileExt = LCase(fso.GetExtensionName(file.Name))
        
        Dim categoryFolder As String
        categoryFolder = GetFileCategory(fileExt)
        
        If categoryFolder <> "" Then
            Dim destFolder As String
            destFolder = folderPath & "\" & categoryFolder
            
            If Not fso.FolderExists(destFolder) Then
                fso.CreateFolder destFolder
                Debug.Print "フォルダ作成: " & categoryFolder
                logContent = logContent & "フォルダ作成: " & categoryFolder & vbCrLf
            End If
            
            Dim newPath As String
            newPath = destFolder & "\" & file.Name
            
            On Error Resume Next
            file.Move newPath
            If Err.Number = 0 Then
                Debug.Print "移動: " & file.Name & " -> " & categoryFolder
                logContent = logContent & "移動: " & file.Name & " -> " & categoryFolder & vbCrLf
            Else
                Debug.Print "移動失敗: " & file.Name & " (" & Err.Description & ")"
                logContent = logContent & "移動失敗: " & file.Name & " (" & Err.Description & ")" & vbCrLf
            End If
            On Error GoTo 0
        End If
    Next file
End Sub

Private Function GetFileCategory(extension As String) As String
    Select Case extension
        Case "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"
            GetFileCategory = "Images"
        Case "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"
            GetFileCategory = "Videos"
        Case "mp3", "wav", "flac", "aac", "ogg", "m4a"
            GetFileCategory = "Audio"
        Case "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf"
            GetFileCategory = "Documents"
        Case "zip", "rar", "7z", "tar", "gz", "bz2"
            GetFileCategory = "Archives"
        Case "exe", "msi", "dmg", "pkg", "deb", "rpm"
            GetFileCategory = "Programs"
        Case Else
            GetFileCategory = "Others"
    End Select
End Function

Private Function GetFileSummary(folderPath As String) As String
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    On Error GoTo ErrorHandler
    
    Dim folder As Object
    Set folder = fso.GetFolder(folderPath)
    
    Dim fileCount As Long
    fileCount = folder.Files.Count
    
    Dim totalSize As Double
    totalSize = 0
    
    Dim file As Object
    For Each file In folder.Files
        totalSize = totalSize + file.Size
    Next file
    
    GetFileSummary = "  ファイル数: " & fileCount & " 個" & vbCrLf & _
                    "  総サイズ: " & FormatBytes(totalSize) & vbCrLf
    Exit Function
    
ErrorHandler:
    GetFileSummary = "  エラー: ファイル情報を取得できませんでした" & vbCrLf
End Function
