Option Explicit

Function BrowseForFolder(Optional ByVal title As String = "フォルダを選択") As String
    Dim shell As Object
    Set shell = CreateObject("Shell.Application")
    
    Dim folder As Object
    Set folder = shell.BrowseForFolder(0, title, 0)
    
    If Not folder Is Nothing Then
        BrowseForFolder = folder.Self.Path
    Else
        BrowseForFolder = ""
    End If
End Function

Function GetOutputPath() As String
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    Dim outputPath As String
    outputPath = ThisWorkbook.Path & "\output"
    
    If Not fso.FolderExists(outputPath) Then
        fso.CreateFolder outputPath
    End If
    
    GetOutputPath = outputPath
End Function

Function FormatBytes(bytes As Double) As String
    If bytes >= 1073741824 Then
        FormatBytes = Format(bytes / 1073741824, "0.00") & " GB"
    ElseIf bytes >= 1048576 Then
        FormatBytes = Format(bytes / 1048576, "0.00") & " MB"
    ElseIf bytes >= 1024 Then
        FormatBytes = Format(bytes / 1024, "0.00") & " KB"
    Else
        FormatBytes = bytes & " bytes"
    End If
End Function

Sub WriteTextToFile(filePath As String, content As String)
    Dim fileNum As Integer
    fileNum = FreeFile
    
    On Error GoTo ErrorHandler
    Open filePath For Output As #fileNum
    Print #fileNum, content
    Close #fileNum
    Exit Sub
    
ErrorHandler:
    Debug.Print "ファイル書き込みエラー: " & Err.Description
    If fileNum <> 0 Then Close #fileNum
End Function

Function GetSimpleFileHash(filePath As String) As String
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    On Error GoTo ErrorHandler
    If fso.FileExists(filePath) Then
        Dim file As Object
        Set file = fso.GetFile(filePath)
        GetSimpleFileHash = CStr(file.Size) & "_" & CStr(file.DateLastModified)
    Else
        GetSimpleFileHash = ""
    End If
    Exit Function
    
ErrorHandler:
    Debug.Print "ハッシュ計算エラー: " & Err.Description
    GetSimpleFileHash = ""
End Function

Function CreateDictionary() As Object
    Set CreateDictionary = CreateObject("Scripting.Dictionary")
End Function
