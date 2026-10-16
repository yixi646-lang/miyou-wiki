$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = '选择现有 Wiki 文件夹'
    if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
    $wikiTarget = [IO.Path]::GetFullPath($picker.SelectedPath)
    $runtime = Join-Path $wikiTarget 'runtime\node.exe'
    $installer = Join-Path $wikiTarget 'scripts\install-content.mjs'
    if (!(Test-Path -LiteralPath $runtime) -or !(Test-Path -LiteralPath $installer)) { throw '所选目录尚不支持资料更新，请先安装带资料更新功能的 Wiki。' }
    $answer = [System.Windows.Forms.MessageBox]::Show('请确认已关闭所有 Wiki 页面。现在安装资料更新？个人资料会保留。', '资料更新', 'YesNo', 'Question')
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { exit 0 }
    $packageDirectory = Split-Path -Parent $env:WIKI_CONTENT_MANUAL
    & $runtime '--disable-warning=ExperimentalWarning' $installer $wikiTarget $packageDirectory
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
