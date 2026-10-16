param([string]$Target = '')
$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $env:WIKI_CONTENT_MANUAL
$wizard = Join-Path $packageRoot 'installer\wizard.ps1'
if (-not (Test-Path -LiteralPath $wizard -PathType Leaf)) { throw '请完整解压资料更新包，再打开包内的“安装资料更新.vbs”。' }
& $wizard -Target $Target
