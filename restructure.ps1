# restructure.ps1
# Complete automation script to restructure SSI Wallet app folder
# Run from project root: .\restructure.ps1

Write-Host "`n🚀 SSI Wallet - App Restructuring Script" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "app")) {
    Write-Host "❌ Error: 'app' folder not found!" -ForegroundColor Red
    Write-Host "   Please run this script from your project root." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "services")) {
    Write-Host "❌ Error: 'services' folder not found!" -ForegroundColor Red
    Write-Host "   Please run this script from your project root." -ForegroundColor Yellow
    exit 1
}

# Navigate to app directory
Write-Host "📂 Navigating to app directory..." -ForegroundColor Yellow
Set-Location -Path "app"

# ============================================
# STEP 1: Create Route Groups
# ============================================
Write-Host "`n📁 Step 1: Creating route groups..." -ForegroundColor Yellow

$groups = @("(onboarding)", "(main)", "(modals)")
foreach ($group in $groups) {
    if (-not (Test-Path $group)) {
        New-Item -ItemType Directory -Path $group -Force | Out-Null
        Write-Host "  ✓ Created $group" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ $group already exists" -ForegroundColor Yellow
    }
}

Write-Host "✅ Route groups created`n" -ForegroundColor Green

# ============================================
# STEP 2: Backup Current Layout
# ============================================
Write-Host "💾 Step 2: Backing up current _layout.js..." -ForegroundColor Yellow

if (Test-Path "_layout.js") {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item -Path "_layout.js" -Destination "_layout.backup.$timestamp.js" -Force
    Write-Host "  ✓ Backup created: _layout.backup.$timestamp.js" -ForegroundColor Green
} else {
    Write-Host "  ⚠ No _layout.js found to backup" -ForegroundColor Yellow
}

Write-Host "✅ Backup complete`n" -ForegroundColor Green

# ============================================
# STEP 3: Move Main Screens
# ============================================
Write-Host "📦 Step 3: Moving main screens to (main)..." -ForegroundColor Yellow

$mainScreens = @("index.js", "credentials.js", "scan.js")
foreach ($screen in $mainScreens) {
    if (Test-Path $screen) {
        Move-Item -Path $screen -Destination "(main)\$screen" -Force
        Write-Host "  ✓ Moved $screen → (main)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ $screen not found, skipping..." -ForegroundColor Yellow
    }
}

# Move layout to main
if (Test-Path "_layout.js") {
    Move-Item -Path "_layout.js" -Destination "(main)\_layout.js" -Force
    Write-Host "  ✓ Moved _layout.js → (main)" -ForegroundColor Gray
}

Write-Host "✅ Main screens moved`n" -ForegroundColor Green

# ============================================
# STEP 4: Move Modal Screens
# ============================================
Write-Host "📦 Step 4: Moving modal screens to (modals)..." -ForegroundColor Yellow

$modalScreens = @("issue.js", "verify.js", "test.js", "testtsx.js")
foreach ($screen in $modalScreens) {
    if (Test-Path $screen) {
        Move-Item -Path $screen -Destination "(modals)\$screen" -Force
        Write-Host "  ✓ Moved $screen → (modals)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ $screen not found, skipping..." -ForegroundColor Yellow
    }
}

Write-Host "✅ Modal screens moved`n" -ForegroundColor Green

# ============================================
# STEP 5: Create Root Layout
# ============================================
Write-Host "📝 Step 5: Creating new root _layout.js..." -ForegroundColor Yellow

$rootLayout = @"
// app/_layout.js
// Root layout - decides between onboarding or main app

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as secureStorage from '../services/secureStorage';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-get-random-values';

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    checkWalletStatus();
  }, []);

  const checkWalletStatus = async () => {
    try {
      const walletExists = await secureStorage.isWalletInitialized();
      setHasWallet(walletExists);
    } catch (error) {
      console.error('Error checking wallet:', error);
      setHasWallet(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading screen while checking
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading Wallet...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* If no wallet, show onboarding (placeholder for now) */}
      {!hasWallet ? (
        <Stack.Screen name="(onboarding)" />
      ) : (
        <>
          {/* Main app with tabs */}
          <Stack.Screen name="(main)" />
          
          {/* Modal screens */}
          <Stack.Screen 
            name="(modals)/issue" 
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen 
            name="(modals)/verify" 
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen 
            name="(modals)/test" 
            options={{ presentation: 'modal' }}
          />
        </>
      )}
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
});
"@

Set-Content -Path "_layout.js" -Value $rootLayout -Encoding UTF8
Write-Host "  ✓ Created root _layout.js" -ForegroundColor Green
Write-Host "✅ Root layout created`n" -ForegroundColor Green

# ============================================
# STEP 6: Create Onboarding Layout
# ============================================
Write-Host "📝 Step 6: Creating (onboarding)/_layout.js..." -ForegroundColor Yellow

$onboardingLayout = @"
// app/(onboarding)/_layout.js
// Stack navigator for onboarding flow

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0f' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="create-wallet" />
      <Stack.Screen name="import-wallet" />
      <Stack.Screen name="setup-pin" />
    </Stack>
  );
}
"@

Set-Content -Path "(onboarding)\_layout.js" -Value $onboardingLayout -Encoding UTF8
Write-Host "  ✓ Created (onboarding)/_layout.js" -ForegroundColor Green
Write-Host "✅ Onboarding layout created`n" -ForegroundColor Green

# ============================================
# STEP 7: Update Main Layout
# ============================================
Write-Host "📝 Step 7: Updating (main)/_layout.js..." -ForegroundColor Yellow

# Read existing main layout
$mainLayoutPath = "(main)\_layout.js"
if (Test-Path $mainLayoutPath) {
    $mainLayoutContent = Get-Content -Path $mainLayoutPath -Raw
    
    # Check if it needs the import statement
    if ($mainLayoutContent -notmatch "react-native-get-random-values") {
        $mainLayoutContent = $mainLayoutContent -replace "(import.*?;)", "`$1`nimport 'react-native-get-random-values';"
        Set-Content -Path $mainLayoutPath -Value $mainLayoutContent -Encoding UTF8
        Write-Host "  ✓ Added required import to (main)/_layout.js" -ForegroundColor Green
    }
    
    # Check if it's using the right export name
    if ($mainLayoutContent -notmatch "export default function MainLayout") {
        $mainLayoutContent = $mainLayoutContent -replace "export default function \w+Layout", "export default function MainLayout"
        Set-Content -Path $mainLayoutPath -Value $mainLayoutContent -Encoding UTF8
    }
    
    Write-Host "  ✓ Updated (main)/_layout.js" -ForegroundColor Green
} else {
    Write-Host "  ⚠ (main)/_layout.js not found!" -ForegroundColor Yellow
}

Write-Host "✅ Main layout updated`n" -ForegroundColor Green

# ============================================
# STEP 8: Create Modals Layout
# ============================================
Write-Host "📝 Step 8: Creating (modals)/_layout.js..." -ForegroundColor Yellow

$modalsLayout = @"
// app/(modals)/_layout.js
// Stack navigator for modals

import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0f' },
      }}
    >
      <Stack.Screen name="issue" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="test" />
    </Stack>
  );
}
"@

Set-Content -Path "(modals)\_layout.js" -Value $modalsLayout -Encoding UTF8
Write-Host "  ✓ Created (modals)/_layout.js" -ForegroundColor Green
Write-Host "✅ Modals layout created`n" -ForegroundColor Green

# ============================================
# STEP 9: Update Import Paths
# ============================================
Write-Host "🔄 Step 9: Updating import paths..." -ForegroundColor Yellow

$filesToUpdate = @()
$filesToUpdate += Get-ChildItem -Path "(main)" -Filter "*.js" -File
$filesToUpdate += Get-ChildItem -Path "(modals)" -Filter "*.js" -File

$updatedCount = 0
foreach ($file in $filesToUpdate) {
    if ($file.Name -notlike "_layout.js") {
        $content = Get-Content -Path $file.FullName -Raw
        $originalContent = $content
        
        # Update imports: ../services → ../../services
        $content = $content -replace "from\s+['\`"]\.\.\/services\/", "from '../../services/"
        
        # Update imports: ../utils → ../../utils
        $content = $content -replace "from\s+['\`"]\.\.\/utils\/", "from '../../utils/"
        
        # Update imports: ../config → ../../config
        $content = $content -replace "from\s+['\`"]\.\.\/config\/", "from '../../config/"
        
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -Encoding UTF8
            Write-Host "  ✓ Updated imports in $($file.Name)" -ForegroundColor Gray
            $updatedCount++
        }
    }
}

if ($updatedCount -gt 0) {
    Write-Host "✅ Updated imports in $updatedCount file(s)`n" -ForegroundColor Green
} else {
    Write-Host "✅ No import updates needed`n" -ForegroundColor Green
}

# ============================================
# STEP 10: Display Final Structure
# ============================================
Write-Host "📂 Step 10: Final structure:" -ForegroundColor Yellow
Write-Host ""

function Show-Tree {
    param([string]$Path, [string]$Indent = "")
    
    $items = Get-ChildItem -Path $Path | Sort-Object { $_.PSIsContainer }, Name
    
    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            Write-Host "$Indent📁 $($item.Name)" -ForegroundColor Blue
            Show-Tree -Path $item.FullName -Indent "  $Indent"
        } else {
            Write-Host "$Indent📄 $($item.Name)" -ForegroundColor Gray
        }
    }
}

Show-Tree -Path "."

# ============================================
# COMPLETION
# ============================================
Write-Host "`n✅ RESTRUCTURING COMPLETE!" -ForegroundColor Green
Write-Host "=========================================`n" -ForegroundColor Cyan

Write-Host "📋 Summary:" -ForegroundColor Yellow
Write-Host "  ✓ Created 3 route groups: (onboarding), (main), (modals)" -ForegroundColor White
Write-Host "  ✓ Moved all screens to appropriate groups" -ForegroundColor White
Write-Host "  ✓ Created/updated all layout files" -ForegroundColor White
Write-Host "  ✓ Updated import paths" -ForegroundColor White
Write-Host "  ✓ Backed up original _layout.js" -ForegroundColor White

Write-Host "`n⚠️  IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Run: npm start (or expo start)" -ForegroundColor White
Write-Host "  2. Test that tabs navigation works" -ForegroundColor White
Write-Host "  3. Check for any import errors in console" -ForegroundColor White
Write-Host "  4. Add your mock screens to (onboarding) group" -ForegroundColor White

Write-Host "`n🎯 To add onboarding screens later:" -ForegroundColor Cyan
Write-Host "  cd app\(onboarding)" -ForegroundColor White
Write-Host "  # Add: welcome.js, create-wallet.js, import-wallet.js" -ForegroundColor White

Write-Host "`n📝 If you encounter issues:" -ForegroundColor Yellow
Write-Host "  - Check console for import path errors" -ForegroundColor White
Write-Host "  - Restore backup if needed: _layout.backup.*.js" -ForegroundColor White
Write-Host "  - Verify all files moved correctly" -ForegroundColor White

Write-Host "`n🚀 Happy coding!" -ForegroundColor Green
Write-Host ""

# Navigate back to project root
Set-Location -Path ".."
"@

Set-Content -Path "restructure.ps1" -Value $script -Encoding UTF8
Write-Host "✅ Created restructure.ps1 script" -ForegroundColor Green
