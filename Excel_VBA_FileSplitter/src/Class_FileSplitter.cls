' ファイル分割処理クラス
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
    
    ' 初期化
    SplitFile = False
    partNumber = 1
    currentPartSize = 0
    totalBytesRead = 0
    
    ' ファイル情報取得
    inputFileSize = FileLen(inputFilePath)
    fileName = Module_Utility.GetFileNameWithoutExtension(inputFilePath)
    fileExtension = Module_Utility.GetFileExtension(inputFilePath)
    
    ' 進捗更新
    UserForm_Progress.UpdateProgress 0, "ファイル分割を開始しています...", Dir(inputFilePath)
    
    ' 入力ファイルオープン
    inputFileNum = FreeFile
    Open inputFilePath For Binary Access Read As #inputFileNum
    
    ' 最初の出力ファイル作成
    outputFilePath = outputFolderPath & "\" & fileName & ".part" & Format(partNumber, "000") & fileExtension
    outputFileNum = FreeFile
    Open outputFilePath For Binary Access Write As #outputFileNum
    
    ' バッファ初期化
    ReDim buffer(BUFFER_SIZE - 1)
    
    ' ファイル分割処理
    Do While Not EOF(inputFileNum)
        ' キャンセル確認
        DoEvents
        If UserForm_Progress.IsCancelRequested() Then
            Close #inputFileNum
            Close #outputFileNum
            SplitFile = False
            Exit Function
        End If
        
        ' データ読み込み
        bytesRead = BUFFER_SIZE
        If (inputFileSize - totalBytesRead) < BUFFER_SIZE Then
            bytesRead = inputFileSize - totalBytesRead
        End If
        
        If bytesRead > 0 Then
            ReDim buffer(bytesRead - 1)
            Get #inputFileNum, , buffer
            
            ' 分割サイズチェック
            If (currentPartSize + bytesRead) > splitSizeBytes And partNumber >= 1 Then
                ' 現在のファイルを閉じて新しいファイルを開始
                Close #outputFileNum
                partNumber = partNumber + 1
                currentPartSize = 0
                
                outputFilePath = outputFolderPath & "\" & fileName & ".part" & Format(partNumber, "000") & fileExtension
                outputFileNum = FreeFile
                Open outputFilePath For Binary Access Write As #outputFileNum
            End If
            
            ' データ書き込み
            Put #outputFileNum, , buffer
            currentPartSize = currentPartSize + bytesRead
            totalBytesRead = totalBytesRead + bytesRead
            
            ' 進捗更新
            progressPercentage = Int((totalBytesRead / inputFileSize) * 100)
            UserForm_Progress.UpdateProgress progressPercentage, _
                "分割中... (パート " & partNumber & ")", _
                Dir(outputFilePath)
        End If
    Loop
    
    ' ファイルクローズ
    Close #inputFileNum
    Close #outputFileNum
    
    ' 完了
    UserForm_Progress.UpdateProgress 100, "分割完了", "合計 " & partNumber & " 個のファイルに分割しました"
    SplitFile = True
    
    Exit Function
    
ErrorHandler:
    ' エラーハンドリング
    If inputFileNum > 0 Then Close #inputFileNum
    If outputFileNum > 0 Then Close #outputFileNum
    
    Module_Utility.LogError "ファイル分割エラー: " & Err.Description
    SplitFile = False
End Function
