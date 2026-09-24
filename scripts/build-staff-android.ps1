param(
  [Parameter(Mandatory=$true)][string]$Keystore,
  [Parameter(Mandatory=$true)][string]$PasswordFile,
  [string]$JdkPath,
  [string]$SdkPath
)
$ErrorActionPreference='Stop'
$sourceProject=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../android-twa')).Path
# Native Android/Java tools can misread Arabic paths on Windows. Stage only
# build inputs in a fresh ASCII directory; never copy local keys or caches.
$project=Join-Path $env:TEMP ('mta-team-build-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $project | Out-Null
foreach($name in @('build.gradle','settings.gradle','gradle.properties','gradlew','gradlew.bat','app/build.gradle','staff/build.gradle')) {
  $target=Join-Path $project $name; New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  Copy-Item -LiteralPath (Join-Path $sourceProject $name) -Destination $target
}
foreach($folder in @('gradle','app/src','staff/src')) {
  $from=Join-Path $sourceProject $folder
  foreach($file in Get-ChildItem -LiteralPath $from -Recurse -File) {
    $relative=$file.FullName.Substring($sourceProject.Length+1); $target=Join-Path $project $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $target
  }
}
$toolsConfig=Join-Path $env:USERPROFILE '.bubblewrap/config.json'
if((!$JdkPath -or !$SdkPath) -and (Test-Path -LiteralPath $toolsConfig)) {
  $config=Get-Content -LiteralPath $toolsConfig -Raw | ConvertFrom-Json
  if(!$JdkPath){$JdkPath=$config.jdkPath}; if(!$SdkPath){$SdkPath=$config.androidSdkPath}
}
if(!(Test-Path -LiteralPath (Join-Path $JdkPath 'bin/java.exe'))){throw 'A working JDK 17 or newer is required.'}
if(!(Test-Path -LiteralPath $Keystore) -or !(Test-Path -LiteralPath $PasswordFile)){throw 'Signing key or password file not found.'}
$buildTools=Get-ChildItem -LiteralPath (Join-Path $SdkPath 'build-tools') -Directory | Sort-Object {[version]$_.Name} -Descending | Select-Object -First 1
if(!$buildTools){throw 'Android SDK build tools not found.'}
$previousJava=$env:JAVA_HOME; $previousSdk=$env:ANDROID_HOME; $previousPassword=$env:MTA_ANDROID_SIGN_PASSWORD
try {
  $env:JAVA_HOME=$JdkPath; $env:ANDROID_HOME=$SdkPath
  Push-Location $project
  try { & ./gradlew.bat :staff:assembleRelease --no-daemon '-Djavax.net.ssl.trustStoreType=Windows-ROOT' '-Djavax.net.ssl.trustStore=NONE'; if($LASTEXITCODE -ne 0){throw 'Android compilation failed.'} } finally { Pop-Location }
  $unsigned=Join-Path $project 'staff/build/outputs/apk/release/staff-release-unsigned.apk'
  $aligned=Join-Path $project 'staff/build/outputs/apk/release/staff-release-aligned.apk'
  $output=Join-Path $project 'MTA-Team-1.0.0.apk'
  & (Join-Path $buildTools.FullName 'zipalign.exe') -f -p 4 $unsigned $aligned
  if($LASTEXITCODE -ne 0){throw 'APK alignment failed.'}
  $stagedKey=Join-Path $project 'signing.keystore'
  Copy-Item -LiteralPath $Keystore -Destination $stagedKey
  $env:MTA_ANDROID_SIGN_PASSWORD=[IO.File]::ReadAllText((Resolve-Path -LiteralPath $PasswordFile)).Trim()
  & (Join-Path $buildTools.FullName 'apksigner.bat') sign --ks $stagedKey --ks-key-alias mtagency --ks-pass env:MTA_ANDROID_SIGN_PASSWORD --key-pass env:MTA_ANDROID_SIGN_PASSWORD --out $output $aligned
  if($LASTEXITCODE -ne 0){throw 'APK signing failed.'}
  & (Join-Path $buildTools.FullName 'apksigner.bat') verify --verbose --print-certs $output
  if($LASTEXITCODE -ne 0){throw 'APK signature verification failed.'}
  $destination=Join-Path $sourceProject 'MTA-Team-1.0.0.apk'
  Copy-Item -LiteralPath $output -Destination $destination -Force
  Write-Output ('Signed team installer: '+$destination)
} finally {
  if($stagedKey -and (Test-Path -LiteralPath $stagedKey)){Remove-Item -LiteralPath $stagedKey}
  $env:JAVA_HOME=$previousJava; $env:ANDROID_HOME=$previousSdk; $env:MTA_ANDROID_SIGN_PASSWORD=$previousPassword
}
