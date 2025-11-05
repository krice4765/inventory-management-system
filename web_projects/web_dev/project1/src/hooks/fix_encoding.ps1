$content = Get-Content "useAuth.test.ts" -Raw -Encoding UTF8

# Fix line 152 - corrupted Japanese
$content = $content -replace "ログインしました。.", "ログインしました！"

# Fix line 182 - corrupted Japanese  
$content = $content -replace "ログアウトしました。.", "ログアウトしました。"

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("useAuth.test.ts", $content, $utf8NoBom)
