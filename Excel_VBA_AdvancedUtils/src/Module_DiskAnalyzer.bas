Option Explicit

Sub AnalyzeDiskMain(targetFolder As String)
    Debug.Print "====================================="
    Debug.Print "ディスク使用量分析開始"
    Debug.Print "対象フォルダ: " & targetFolder
    Debug.Print "====================================="
    
    Dim csvContent As String
    csvContent = "フォルダパス,サイズ(バイト),サイズ(表示用)" & vbCrLf
    
    Debug.Print "フォルダ名                           サイズ"
    Debug.Print "------------------------------------------------"
    
    AnalyzeFolderRecursive targetFolder, csvContent, 0
    
    Dim outputFile As String
    outputFile = GetOutputPath() & "\disk_usage_report.csv"
    WriteTextToFile outputFile, csvContent
    
    Debug.Print "================================================"
    Debug.Print "分析完了 - CSVレポート: " & outputFile
    Debug.Print "====================================="
End Sub

Private Sub AnalyzeFolderRecursive(folderPath As String, ByRef csvContent As String, level As Integer)
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    On Error GoTo ErrorHandler
    
    Dim folder As Object
    Set folder = fso.GetFolder(folderPath)
    
    Dim folderSize As Double
    folderSize = GetFolderSize(folder)
    
    Dim indent As String
    indent = String(level * 2, " ")
    
    Debug.Print indent & folder.Name & " (" & FormatBytes(folderSize) & ")"
    csvContent = csvContent & """" & folder.Path & """," & folderSize & ",""" & FormatBytes(folderSize) & """" & vbCrLf
    
    If level < 2 Then
        Dim subFolder As Object
        For Each subFolder In folder.SubFolders
            AnalyzeFolderRecursive subFolder.Path, csvContent, level + 1
        Next subFolder
    End If
    
    Exit Sub
    
ErrorHandler:
    Debug.Print "分析エラー: " & folderPath & " (" & Err.Description & ")"
End Sub

Private Function GetFolderSize(folder As Object) As Double
    Dim totalSize As Double
    totalSize = 0
    
    On Error Resume Next
    
    Dim file As Object
    For Each file In folder.Files
        totalSize = totalSize + file.Size
    Next file
    
    Dim subFolder As Object
    For Each subFolder In folder.SubFolders
        totalSize = totalSize + GetFolderSize(subFolder)
    Next subFolder
    
    On Error GoTo 0
    GetFolderSize = totalSize
End Function
