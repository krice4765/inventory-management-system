' ユーティリティ関数モジュール

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
    ' 拡張子なしのファイル名を取得
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
    ' ファイル拡張子を取得
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
    ' エラーログ出力
    Debug.Print Format(Now, "yyyy/mm/dd hh:mm:ss") & " - ERROR: " & message
End Sub

Public Sub LogInfo(message As String)
    ' 情報ログ出力
    Debug.Print Format(Now, "yyyy/mm/dd hh:mm:ss") & " - INFO: " & message
End Sub

Public Function FormatFileSize(sizeInBytes As Double) As String
    ' ファイルサイズを読みやすい形式でフォーマット
    If sizeInBytes >= 1073741824 Then ' 1GB
        FormatFileSize = Format(sizeInBytes / 1073741824, "0.00") & " GB"
    ElseIf sizeInBytes >= 1048576 Then ' 1MB
        FormatFileSize = Format(sizeInBytes / 1048576, "0.00") & " MB"
    ElseIf sizeInBytes >= 1024 Then ' 1KB
        FormatFileSize = Format(sizeInBytes / 1024, "0.00") & " KB"
    Else
        FormatFileSize = sizeInBytes & " バイト"
    End If
End Function
