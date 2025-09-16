# SMTP設定修正 - 緊急対応手順

## 🚨 発見された問題
SupabaseのSMTP設定で **Sender details** が未入力のため、メール送信が機能していません。

## ⚡ 即座の修正手順

### Step 1: Sender Email 設定
```
現在: noreply@yourdomain.com (プレースホルダー)
修正: 実際のメールアドレスに変更

推奨設定:
- noreply@gmail.com (Gmailを使用する場合)
- または、実際に使用しているGmailアドレス
```

### Step 2: Sender Name 設定
```
現在: 空欄
修正: 適切な送信者名を設定

推奨設定:
- "システム管理者"
- "パスワードリセット"
- "仕入れ管理システム"
- または適切な組織名
```

### Step 3: 設定保存
```
1. Sender email と Sender name を入力
2. "Save" ボタンをクリック
3. 警告メッセージが消えることを確認
```

## 🎯 具体的な設定例

### パターン1: Gmail使用の場合
```
Sender email: noreply@gmail.com
Sender name: 仕入れ管理システム
```

### パターン2: 組織メール使用の場合
```
Sender email: system@your-company.com
Sender name: システム管理者
```

## ✅ 設定完了後の確認

1. 警告メッセージ "All fields below must be filled" が消える
2. SMTP設定が正常に保存される
3. パスワードリセット機能のテストを実行

## 🔄 次のアクション

設定修正後、直ちにパスワードリセット機能のテストを実行してください。

---
**緊急度**: CRITICAL
**所要時間**: 2-3分