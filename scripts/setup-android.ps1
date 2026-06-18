# Detect Android Studio JDK + SDK and build Veyra debug APK.
param(
  [switch]$InstallOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Find-JavaHome {
  $candidates = @(
    $env:JAVA_HOME,
    "C:\Program Files\Android\Android Studio\jbr",
    "C:\Program Files\Android\Android Studio\jre",
    "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr"
  ) | Where-Object { $_ -and (Test-Path "$_\bin\java.exe") }
  return $candidates | Select-Object -First 1
}

function Find-AndroidSdk {
  if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }
  if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }
  $default = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $default) { return $default }
  return $null
}

$javaHome = Find-JavaHome
$sdk = Find-AndroidSdk

if (-not $javaHome) {
  Write-Host "JAVA_HOME not found. Install Android Studio (includes JDK 17)." -ForegroundColor Red
  Write-Host "https://developer.android.com/studio"
  exit 1
}

if (-not $sdk) {
  Write-Host "Android SDK not found. Open Android Studio -> SDK Manager and install SDK 34." -ForegroundColor Red
  exit 1
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:PATH = "$javaHome\bin;$sdk\platform-tools;$sdk\cmdline-tools\latest\bin;$env:PATH"

Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"

if ($InstallOnly) { exit 0 }

$node = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs"
if (Test-Path $node) { $env:PATH = "$node;$env:PATH" }

Push-Location $repoRoot
try {
  npm run mobile:apk
  $apk = Join-Path $repoRoot "apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk"
  if (Test-Path $apk) {
    Write-Host "APK ready: $apk" -ForegroundColor Green
  } else {
    Write-Host "Gradle finished but APK not found at expected path." -ForegroundColor Yellow
    exit 1
  }
} finally {
  Pop-Location
}