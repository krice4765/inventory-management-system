Private cancelRequested As Boolean

Private Sub UserForm_Initialize()
    ' 進捗フォーム初期化
    Me.Caption = "ファイル分割処理中..."
    cancelRequested = False
    
    ' ラベル初期設定
    Label_Status.Caption = "準備中..."
    Label_CurrentFile.Caption = ""
    Label_Progress.Caption = "0%"
    
    ' プログレスバー初期化（簡易実装）
    Label_ProgressBar.Width = 0
    Label_ProgressBar.BackColor = RGB(0, 120, 215)
    Label_ProgressBar.Height = 20
    
    ' ボタン設定
    CommandButton_Cancel.Caption = "キャンセル"
End Sub

Public Sub UpdateProgress(percentage As Long, statusText As String, Optional currentFile As String = "")
    On Error Resume Next
    
    ' 進捗更新
    Label_Status.Caption = statusText
    Label_Progress.Caption = percentage & "%"
    
    If currentFile <> "" Then
        Label_CurrentFile.Caption = "処理中: " & currentFile
    End If
    
    ' プログレスバーの更新
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
    Me.Caption = "キャンセル処理中..."
    CommandButton_Cancel.Enabled = False
    Label_Status.Caption = "キャンセル処理中..."
End Sub
