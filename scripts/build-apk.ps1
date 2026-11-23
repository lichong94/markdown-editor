# 一键构建 Android 签名 APK
# 用法: powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1
$ErrorActionPreference = "Stop"
$root = "C:\Users\Administrator\Doubao\chats\2026-10-22\new-chat-1\markdown-editor"

Set-Location $root

Write-Host "[1/4] build:mobile"
npm run build:mobile
if ($LASTEXITCODE -ne 0) { throw "build:mobile failed" }

Write-Host "[2/4] cap sync android"
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }

$pluginsFile = Join-Path $root "android\app\src\main\assets\capacitor.plugins.json"
$content = Get-Content -LiteralPath $pluginsFile -Raw -Encoding utf8
if ($content -notmatch "SafeStoragePlugin") {
  Write-Host "[3/4] restore SafeStoragePlugin entry in capacitor.plugins.json"
  $content = $content.TrimEnd()
  if ($content.EndsWith("]")) {
    $content = $content.Substring(0, $content.Length - 1).TrimEnd()
  }
  $entry = '    { "pkg": "markdown-editor-local", "classpath": "com.local.markdowneditor.SafeStoragePlugin" }'
  $content = $content + "," + [Environment]::NewLine + $entry + [Environment]::NewLine + "]"
  [IO.File]::WriteAllText($pluginsFile, $content, [Text.UTF8Encoding]::new($false))
} else {
  Write-Host "[3/4] SafeStoragePlugin entry already present"
}

Write-Host "[4/4] gradlew assembleRelease"
$env:JAVA_HOME = "C:\Android\Setup\jdk21\jdk-21.0.12.1+1"
$env:ANDROID_HOME = "C:\Android\Sdk"
$env:ANDROID_SDK_ROOT = "C:\Android\Sdk"
Set-Location (Join-Path $root "android")
.\gradlew.bat assembleRelease --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { throw "gradle build failed" }

Write-Host "APK ready: $root\android\app\build\outputs\apk\release\app-release.apk"
