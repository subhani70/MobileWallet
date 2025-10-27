# restructure.ps1
Write-Host "`n🚀 SSI Wallet - App Restructuring Script" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

if (-not (Test-Path "app")) {
    Write-Host "❌ Error: 'app' folder not found!" -ForegroundColor Red
    exit 1
}

Write-Host "📂 Navigating to app directory..." -ForegroundColor Yellow
Set-Location -Path "app"

Write-Host "`n📁 Step 1: Creating route groups..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "(onboarding)" -Force | Out-Null
New-Item -ItemType Directory -Path "(main)" -Force | Out-Null
New-Item -ItemType Directory -Path "(modals)" -Force | Out-Null
Write-Host "✅ Route groups created`n" -ForegroundColor Green

Write-Host "💾 Step 2: Backing up current _layout.js..." -ForegroundColor Yellow
if (Test-Path "_layout.js") {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item -Path "_layout.js" -Destination "_layout.backup.$timestamp.js" -Force
    Write-Host "  ✓ Backup created" -ForegroundColor Green
}
Write-Host "✅ Backup complete`n" -ForegroundColor Green

Write-Host "📦 Step 3: Moving main screens to (main)..." -ForegroundColor Yellow
if (Test-Path "index.js") { Move-Item -Path "index.js" -Destination "(main)\index.js" -Force }
if (Test-Path "credentials.js") { Move-Item -Path "credentials.js" -Destination "(main)\credentials.js" -Force }
if (Test-Path "scan.js") { Move-Item -Path "scan.js" -Destination "(main)\scan.js" -Force }
if (Test-Path "_layout.js") { Move-Item -Path "_layout.js" -Destination "(main)\_layout.js" -Force }
Write-Host "✅ Main screens moved`n" -ForegroundColor Green

Write-Host "📦 Step 4: Moving modal screens to (modals)..." -ForegroundColor Yellow
if (Test-Path "issue.js") { Move-Item -Path "issue.js" -Destination "(modals)\issue.js" -Force }
if (Test-Path "verify.js") { Move-Item -Path "verify.js" -Destination "(modals)\verify.js" -Force }
if (Test-Path "test.js") { Move-Item -Path "test.js" -Destination "(modals)\test.js" -Force }
if (Test-Path "testtsx.js") { Move-Item -Path "testtsx.js" -Destination "(modals)\testtsx.js" -Force }
Write-Host "✅ Modal screens moved`n" -ForegroundColor Green

Write-Host "📝 Step 5-8: Creating layout files..." -ForegroundColor Yellow
Set-Location -Path ".."

Write-Host "✅ RESTRUCTURING COMPLETE!" -ForegroundColor Green
Write-Host "`nNow manually create the layout files or I'll provide them separately." -ForegroundColor Yellow
