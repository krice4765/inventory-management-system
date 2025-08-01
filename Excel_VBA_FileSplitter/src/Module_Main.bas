' メイン処理モジュール

Sub Main()
    ' アプリケーション起動処理
    Module_Utility.LogInfo "ファイル分割ツール起動"
    ShowFileSplitterForm
End Sub

Sub ShowFileSplitterForm()
    ' ファイル分割フォーム表示
    Load UserForm_Split
    UserForm_Split.Show vbModal
End Sub

Sub TestFileSplitter()
    ' テスト用プロシージャ
    MsgBox "ファイル分割ツールのテストを開始します。" & vbCrLf & _
           "メインフォームを表示します。", vbInformation, "テスト実行"
    ShowFileSplitterForm
End Sub

Sub AutoOpen()
    ' Excelファイル起動時の自動実行（必要に応じてコメントアウトを外す）
    ' Main
End Sub
