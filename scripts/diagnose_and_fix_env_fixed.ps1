# Environment Variable Diagnosis and Fix Script
# PowerShell encoding fixed version

Write-Host "Step 2: Environment Variable Diagnosis and Fix" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# 1. Check existing environment variable files
Write-Host "Checking environment variable files:" -ForegroundColor Green
if (Test-Path ".env.local") {
    Write-Host "Found .env.local" -ForegroundColor Green
    Get-Content ".env.local"
} elseif (Test-Path ".env") {
    Write-Host "Only .env exists" -ForegroundColor Yellow  
    Get-Content ".env"
} else {
    Write-Host "No environment variable files - creation needed" -ForegroundColor Red
}

Write-Host ""

# 2. Create environment variable file if missing
if (!(Test-Path ".env.local")) {
    Write-Host "Creating .env.local file..." -ForegroundColor Yellow
    
    $envContent = @"
VITE_SUPABASE_URL=https://tleequspizctgoosostd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MjMxNjQsImV4cCI6MjA0MTA5OTE2NH0.gqxPgbIJ3Nx-OgPJG5HQ_KnNh0rH1MpkYe6tV1s7t5A
"@
    
    $envContent | Out-File -FilePath ".env.local" -Encoding utf8 -Force
    Write-Host ".env.local created successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "Complete rebuild (ensuring environment variable embedding)" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# 1. Cleanup
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force dist/ -ErrorAction SilentlyContinue

# 2. Production build
Write-Host "Running production build..." -ForegroundColor Yellow
npm run build

# 3. Create _redirects file (ensure SPA support)
Write-Host "Setting up SPA configuration..." -ForegroundColor Yellow
"/* /index.html 200" | Out-File -FilePath "dist\_redirects" -Encoding utf8 -NoNewline

# 4. Verify environment variable embedding
Write-Host "Verifying environment variable embedding..." -ForegroundColor Yellow
$jsFiles = Get-ChildItem "dist/assets/*.js" -ErrorAction SilentlyContinue
if ($jsFiles) {
    $hasSupabaseUrl = Select-String "tleequspizctgoosostd" $jsFiles[0].FullName -Quiet
    if ($hasSupabaseUrl) {
        Write-Host "Environment variable build embedding successful" -ForegroundColor Green
    } else {
        Write-Host "Environment variable build embedding failed - check .env.local" -ForegroundColor Red
    }
} else {
    Write-Host "JS files not found - build may have failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "Environment variable diagnosis and fix completed!" -ForegroundColor Green
Write-Host "Next step: Deploy to Netlify" -ForegroundColor Cyan