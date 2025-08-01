Option Explicit

Sub ShowSystemInfoMain()
    Debug.Print "====================================="
    Debug.Print "システム情報表示"
    Debug.Print "====================================="
    
    Dim infoContent As String
    infoContent = "システム情報レポート (" & Now & ")" & vbCrLf
    infoContent = infoContent & String(50, "=") & vbCrLf
    
    DisplayDriveInfo infoContent
    DisplaySystemSpecs infoContent
    DisplayExcelInfo infoContent
    
    Dim outputFile As String
    outputFile = GetOutputPath() & "\system_info.txt"
    WriteTextToFile outputFile, infoContent
    
    Debug.Print "システム情報保存: " & outputFile
    Debug.Print "====================================="
End Sub

Private Sub DisplayDriveInfo(ByRef infoContent As String)
    Debug.Print vbCrLf & "** ドライブ情報 **"
    infoContent = infoContent & vbCrLf & "** ドライブ情報 **" & vbCrLf
    
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    Dim drive As Object
    For Each drive In fso.Drives
        If drive.IsReady Then
            Dim driveInfo As String
            driveInfo = drive.DriveLetter & ": " & _
                       FormatBytes(drive.FreeSpace) & " / " & _
                       FormatBytes(drive.TotalSize) & " (" & _
                       Format((drive.TotalSize - drive.FreeSpace) / drive.TotalSize, "0.0%") & " 使用中)"
            
            Debug.Print driveInfo
            infoContent = infoContent & driveInfo & vbCrLf
        End If
    Next drive
End Sub

Private Sub DisplaySystemSpecs(ByRef infoContent As String)
    Debug.Print vbCrLf & "** システム仕様 **"
    infoContent = infoContent & vbCrLf & "** システム仕様 **" & vbCrLf
    
    On Error Resume Next
    
    Dim wmi As Object
    Set wmi = GetObject("winmgmts:")
    
    Dim computer As Object
    Set computer = wmi.ExecQuery("SELECT * FROM Win32_ComputerSystem").ItemIndex(0)
    
    If Not computer Is Nothing Then
        Debug.Print "コンピュータ名: " & computer.Name
        Debug.Print "総メモリ: " & FormatBytes(computer.TotalPhysicalMemory)
        infoContent = infoContent & "コンピュータ名: " & computer.Name & vbCrLf
        infoContent = infoContent & "総メモリ: " & FormatBytes(computer.TotalPhysicalMemory) & vbCrLf
    End If
    
    Dim os As Object
    Set os = wmi.ExecQuery("SELECT * FROM Win32_OperatingSystem").ItemIndex(0)
    
    If Not os Is Nothing Then
        Debug.Print "OS: " & os.Caption
        Debug.Print "バージョン: " & os.Version
        infoContent = infoContent & "OS: " & os.Caption & vbCrLf
        infoContent = infoContent & "バージョン: " & os.Version & vbCrLf
    End If
    
    On Error GoTo 0
End Sub

Private Sub DisplayExcelInfo(ByRef infoContent As String)
    Debug.Print vbCrLf & "** Excel情報 **"
    infoContent = infoContent & vbCrLf & "** Excel情報 **" & vbCrLf
    
    Debug.Print "バージョン: " & Application.Version
    Debug.Print "現在のブック: " & ActiveWorkbook.Name
    infoContent = infoContent & "バージョン: " & Application.Version & vbCrLf
    infoContent = infoContent & "現在のブック: " & ActiveWorkbook.Name & vbCrLf
End Sub
