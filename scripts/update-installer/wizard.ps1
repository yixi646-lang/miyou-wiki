param([string]$Target = '', [string]$SelfTestTarget = '', [string]$SelfTestReport = '', [string]$SelfTestImage = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$packageRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $packageRoot 'update.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$script:process = $null
$script:phase = ''
$script:checked = $null
$script:actualTarget = ''
$script:node = ''
$script:session = ''
$script:resultPath = ''
$script:statusPath = ''
$script:logPath = ''
$script:selfTesting = -not [string]::IsNullOrWhiteSpace($SelfTestTarget)

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Wiki 更新向导'
$form.ClientSize = New-Object System.Drawing.Size(900, 730)
$form.MinimumSize = New-Object System.Drawing.Size(916, 769)
$form.StartPosition = 'CenterScreen'
$form.AutoScaleMode = 'Font'
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 9)
$form.BackColor = [Drawing.ColorTranslator]::FromHtml('#F5F7FA')

function Label-Control($parent, $text, $x, $y, $width, $height, $size = 9) {
  $control = New-Object System.Windows.Forms.Label
  $control.Text = $text
  $control.SetBounds($x, $y, $width, $height)
  $control.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', $size)
  $control.ForeColor = [Drawing.ColorTranslator]::FromHtml('#27364B')
  $parent.Controls.Add($control)
  return $control
}
function Button-Control($text, $x, $y, $width) {
  $control = New-Object System.Windows.Forms.Button
  $control.Text = $text
  $control.SetBounds($x, $y, $width, 36)
  $control.FlatStyle = 'Flat'
  $control.FlatAppearance.BorderColor = [Drawing.ColorTranslator]::FromHtml('#CCD4DF')
  $control.BackColor = [Drawing.Color]::White
  $control.UseVisualStyleBackColor = $false
  $form.Controls.Add($control)
  return $control
}
$header = New-Object System.Windows.Forms.Panel
$header.SetBounds(0, 0, 900, 90)
$header.Anchor = 'Top,Left,Right'
$header.BackColor = [Drawing.ColorTranslator]::FromHtml('#20334D')
$form.Controls.Add($header)
$title = Label-Control $header '更新你的 Wiki' 24 16 700 33 19
$title.ForeColor = [Drawing.Color]::White
$subtitle = Label-Control $header ("本包：{0} / {1} → {2} / {3}" -f $manifest.from.version, $manifest.from.releaseId, $manifest.to.version, $manifest.to.releaseId) 26 57 800 24 9
$subtitle.ForeColor = [Drawing.ColorTranslator]::FromHtml('#D9E5F5')
[void](Label-Control $form '先关闭 Wiki 和扫描器，再选择以前用来启动 Wiki 的文件夹。不要选择更新包文件夹。' 24 106 850 26)
[void](Label-Control $form '也可以直接选择“启动百科.vbs”；选到只有一份 Wiki 的外层目录时，会自动定位。' 24 134 850 26)
[void](Label-Control $form '1  选择现有 Wiki' 24 173 400 24 10)
$pathBox = New-Object System.Windows.Forms.TextBox
$pathBox.SetBounds(24, 204, 536, 30)
$pathBox.Name = 'WikiFolder'
$form.Controls.Add($pathBox)
$browse = Button-Control '选择文件夹…' 572 201 143
$browseFile = Button-Control '选择启动文件…' 727 201 149
$status = Label-Control $form '尚未选择。可以粘贴路径，或使用右侧按钮。' 24 248 850 54 9
$status.Name = 'DirectoryStatus'
$versions = New-Object System.Windows.Forms.Panel
$versions.SetBounds(24, 310, 852, 75)
$versions.BackColor = [Drawing.Color]::White
$versions.BorderStyle = 'FixedSingle'
$form.Controls.Add($versions)
[void](Label-Control $versions '当前版本' 16 10 160 20 8)
$currentVersion = Label-Control $versions '尚未识别' 16 34 390 29 13
[void](Label-Control $versions '更新到' 436 10 160 20 8)
$targetVersion = Label-Control $versions ("{0} / {1}" -f $manifest.to.version, $manifest.to.releaseId) 436 34 380 29 13
$stage = Label-Control $form '2  检查目录后开始更新' 24 405 850 27 10
$stage.Name = 'UpdateStage'
$progress = New-Object System.Windows.Forms.ProgressBar
$progress.SetBounds(24, 442, 852, 18)
$progress.Name = 'UpdateProgress'
$form.Controls.Add($progress)
$detail = Label-Control $form '更新将保留收藏、材料库存、养成计划与评估账号。' 24 470 850 43 9
[void](Label-Control $form '更新过程与结果' 24 520 400 24 9)
$logs = New-Object System.Windows.Forms.TextBox
$logs.SetBounds(24, 548, 852, 83)
$logs.Multiline = $true
$logs.ReadOnly = $true
$logs.ScrollBars = 'Both'
$logs.WordWrap = $false
$logs.Font = New-Object System.Drawing.Font('Consolas', 8.5)
$logs.BackColor = [Drawing.Color]::White
$logs.Name = 'UpdateLog'
$form.Controls.Add($logs)
$start = Button-Control '开始更新' 24 649 155
$start.BackColor = [Drawing.ColorTranslator]::FromHtml('#275D9B')
$start.ForeColor = [Drawing.Color]::White
$start.Enabled = $false
$start.Name = 'StartUpdate'
$recheck = Button-Control '检查目录' 191 649 112
$notes = Button-Control '查看更新详情' 315 649 132
$openFolder = Button-Control '打开 Wiki 目录' 459 649 137
$openFolder.Enabled = $false
$viewLog = Button-Control '查看日志' 608 649 112
$viewLog.Enabled = $false
$close = Button-Control '关闭' 732 649 144
$foot = Label-Control $form '完成后会明确显示“更新完成”；窗口会保留，直到你点击关闭。' 24 701 850 23 8
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 200

function Show-Blocked([string]$message, [string]$action) {
  $script:checked = $null
  $start.Enabled = $false
  $start.Text = '开始更新'
  $status.ForeColor = [Drawing.ColorTranslator]::FromHtml('#A24916')
  $status.Text = $message + "`r`n" + $action
  $stage.Text = '请按提示重新选择或检查目录'
  $progress.Style = 'Continuous'
  $progress.Value = 0
}
function Quote-Argument([string]$value) { return '"' + $value.Replace('"', '\"') + '"' }
function New-BackendProcess([string]$phase) {
  $script:phase = $phase
  if (-not $script:session) {
    $script:session = Join-Path (Join-Path $packageRoot '安装日志') ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    [void][IO.Directory]::CreateDirectory($script:session)
  }
  $script:resultPath = Join-Path $script:session ($phase + '-result.json')
  $script:statusPath = Join-Path $script:session ($phase + '-status.json')
  $script:logPath = Join-Path $script:session '安装日志.txt'
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $script:node
  $arguments = @('--disable-warning=ExperimentalWarning', (Join-Path $PSScriptRoot 'run.mjs'), $script:actualTarget, ('--result=' + $script:resultPath), ('--status=' + $script:statusPath))
  if ($phase -eq 'inspect') { $arguments += '--inspect' }
  $info.Arguments = ($arguments | ForEach-Object { Quote-Argument $_ }) -join ' '
  $info.WorkingDirectory = $packageRoot
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.WindowStyle = 'Hidden'
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.StandardOutputEncoding = New-Object Text.UTF8Encoding
  $info.StandardErrorEncoding = New-Object Text.UTF8Encoding
  $script:process = New-Object System.Diagnostics.Process
  $script:process.StartInfo = $info
  try { [void]$script:process.Start() } catch { $script:process.Dispose(); $script:process = $null; throw }
  $script:stdout = $script:process.StandardOutput.ReadToEndAsync()
  $script:stderr = $script:process.StandardError.ReadToEndAsync()
  $browse.Enabled = $false; $browseFile.Enabled = $false; $recheck.Enabled = $false; $pathBox.ReadOnly = $true; $start.Enabled = $false
  $progress.Style = 'Marquee'
  $stage.Text = $(if ($phase -eq 'inspect') { '正在检查目录与版本…' } else { '正在更新，请保持此窗口打开…' })
  $timer.Start()
}
function Begin-Check {
  try {
    $script:checked = $null; $start.Text = '开始更新'; $start.Enabled = $false
    $selected = $pathBox.Text.Trim().Trim('"')
    if ([string]::IsNullOrWhiteSpace($selected)) { Show-Blocked '请先选择你原有的 Wiki。' '点击“选择文件夹”或“选择启动文件”，也可以粘贴文件夹路径。'; return }
    if (Test-Path -LiteralPath $selected -PathType Leaf) {
      if ([IO.Path]::GetExtension($selected) -eq '.zip') { Show-Blocked '当前选择的是 ZIP 压缩包。' '请先完整解压，再选择解压后包含“启动百科.vbs”的 Wiki 文件夹。'; return }
      $selected = Split-Path -Parent $selected
    }
    if (-not (Test-Path -LiteralPath $selected -PathType Container)) { Show-Blocked '这个文件夹不存在。' '请检查路径，或重新点击选择按钮。'; return }
    $selected = (Get-Item -LiteralPath $selected).FullName
    if (-not (Test-Path -LiteralPath (Join-Path $selected 'release.json'))) {
      $candidates = @(Get-ChildItem -LiteralPath $selected -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'release.json') })
      if ($candidates.Count -eq 1) { $selected = $candidates[0].FullName }
      elseif ($candidates.Count -gt 1) { Show-Blocked '这个目录内有多份 Wiki。' '请选择平时使用的那一份，或直接选择它的“启动百科.vbs”。'; return }
    }
    $script:actualTarget = $selected
    $pathBox.Text = $selected
    $script:node = ''
    foreach ($candidate in @((Join-Path $selected 'runtime\node.exe'), (Join-Path $selected '.release-manager\runtime\node.exe'))) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { $script:node = $candidate; break }
    }
    if (-not $script:node) { $command = Get-Command node.exe -ErrorAction SilentlyContinue; if ($command) { $script:node = $command.Source } }
    if (-not $script:node) { Show-Blocked '该目录没有便携运行时，本机也未找到 Node.js。' '请选择完整分享版中的 Wiki 文件夹（内有 runtime），不要选择更新包；缺文件时重新完整解压分享版。'; return }
    New-BackendProcess 'inspect'
  } catch { Show-Blocked $_.Exception.Message '重新完整解压更新包到可写目录，再检查目标 Wiki。' }
}
function Complete-SelfTest($result) {
  if (-not $script:selfTesting) { return }
  $form.Refresh()
  if ($SelfTestImage) {
    $image = New-Object Drawing.Bitmap($form.Width, $form.Height)
    try { $form.DrawToBitmap($image, (New-Object Drawing.Rectangle(0, 0, $form.Width, $form.Height))); $image.Save($SelfTestImage, [Drawing.Imaging.ImageFormat]::Png) } finally { $image.Dispose() }
  }
  if ($SelfTestReport) { [IO.File]::WriteAllText($SelfTestReport, (@{ result=$result; statusText=$status.Text; stage=$stage.Text; progress=$progress.Value; path=$script:actualTarget; startText=$start.Text; log=$logs.Text } | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false))) }
  $form.Close()
}
function Present-Result($result) {
  $script:checked = $result
  if ($result.current) { $currentVersion.Text = "{0} / {1}" -f $result.current.version, $result.current.releaseId } else { $currentVersion.Text = '未识别到有效版本' }
  $progress.Style = 'Continuous'
  $recheck.Text = '重新检查'
  $openFolder.Enabled = Test-Path -LiteralPath $script:actualTarget -PathType Container
  if ($result.status -eq 'ready') {
    $status.ForeColor = [Drawing.ColorTranslator]::FromHtml('#186840')
    $status.Text = $result.message + "`r`n" + $result.action
    $detail.Text = "本次：更新 {0} 个文件，删除 {1} 个公共文件，百科资料变化 {2} 条。" -f $result.files, $result.deleted, $result.entries
    $stage.Text = '目录检查通过，点击“开始更新”'
    $progress.Value = 0
    $start.Enabled = $true
    if ($script:selfTesting) { $start.PerformClick() }
  } elseif ($result.status -in @('success', 'current')) {
    $status.ForeColor = [Drawing.ColorTranslator]::FromHtml('#186840')
    $status.Text = $result.message
    if ($result.warning) { $status.Text += "`r`n" + $result.warning }
    $stage.Text = $(if ($result.status -eq 'success') { '更新完成 ✓' } else { '已经是目标版本，无需更新 ✓' })
    $progress.Value = 100
    if ($result.status -eq 'success') {
      $detail.Text = "已完成 {0} 个文件操作、合并 {1} 条资料；个人收藏、库存、计划和评估账号保留。" -f $result.files, $result.entries
      if ($result.conflicts) { $detail.Text += "`r`n本地编辑冲突：$($result.conflicts) 条，记录：$($result.conflictFile)" }
    } else { $detail.Text = $result.action }
    $start.Text = '启动 Wiki'
    $start.Enabled = Test-Path -LiteralPath (Join-Path $script:actualTarget '启动百科.vbs')
    $foot.Text = '版本与目录已显示在上方。可以启动 Wiki，或点击“关闭”结束向导。'
    Complete-SelfTest $result
  } else {
    Show-Blocked $result.message $result.action
    $stage.Text = $(if ($result.status -eq 'error') { '更新未完成，请查看原因' } else { '目录检查未通过，尚未开始更新' })
    Complete-SelfTest $result
  }
}
$timer.Add_Tick({
  try {
    if (Test-Path -LiteralPath $script:statusPath) {
      try {
        $event = Get-Content -LiteralPath $script:statusPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $progress.Style = 'Continuous'
        $progress.Value = [Math]::Max(0, [Math]::Min(100, [int]$event.percent))
        $stage.Text = $event.stage
        $detail.Text = $event.detail
        $logs.Text = $event.log -join "`r`n"
        $logs.SelectionStart = $logs.TextLength; $logs.ScrollToCaret()
      } catch { }
    }
    if ($script:process -and $script:process.HasExited) {
      $timer.Stop()
      $stdoutText = $script:stdout.GetAwaiter().GetResult()
      $stderrText = $script:stderr.GetAwaiter().GetResult()
      $script:process.Dispose(); $script:process = $null
      [IO.File]::WriteAllText($script:logPath, $stdoutText + "`r`n" + $stderrText, (New-Object Text.UTF8Encoding($false)))
      $viewLog.Enabled = $true
      $browse.Enabled = $true; $browseFile.Enabled = $true; $recheck.Enabled = $true; $pathBox.ReadOnly = $false
      if (Test-Path -LiteralPath $script:resultPath) { $result = Get-Content -LiteralPath $script:resultPath -Raw -Encoding UTF8 | ConvertFrom-Json }
      else { $result = @{ status='error'; message='更新程序没有返回完成结果。' + $stderrText; action='点击“查看日志”了解错误；请重新完整解压更新包，使用完整分享版目录。' } }
      Present-Result $result
    }
  } catch { $timer.Stop(); Show-Blocked $_.Exception.Message '可查看本包安装日志，处理后重新打开向导。'; Complete-SelfTest @{status='error';message=$_.Exception.Message} }
})
$pathBox.Add_TextChanged({ if (-not $script:process) { $script:checked = $null; $start.Enabled = $false; $start.Text = '开始更新'; $currentVersion.Text = '待检查'; $status.Text = '路径已改变，请点击“检查目录”。'; $status.ForeColor = [Drawing.ColorTranslator]::FromHtml('#27364B') } })
$browse.Add_Click({
  $dialog = New-Object Windows.Forms.FolderBrowserDialog
  $dialog.Description = '选择包含“启动百科.vbs”、data、runtime 的原有 Wiki 文件夹。不要选择更新包。'
  $dialog.ShowNewFolderButton = $false
  $initialPath = $pathBox.Text.Trim().Trim('"')
  if (-not [string]::IsNullOrWhiteSpace($initialPath) -and (Test-Path -LiteralPath $initialPath -PathType Container)) { $dialog.SelectedPath = $initialPath }
  try { if ($dialog.ShowDialog($form) -eq 'OK') { $pathBox.Text = $dialog.SelectedPath; Begin-Check } } finally { $dialog.Dispose() }
})
$browseFile.Add_Click({
  $dialog = New-Object Windows.Forms.OpenFileDialog
  $dialog.Title = '选择你平时使用的 Wiki 启动文件'
  $dialog.Filter = 'Wiki 启动文件|启动百科.vbs;启动百科.cmd'
  $dialog.CheckFileExists = $true
  try { if ($dialog.ShowDialog($form) -eq 'OK') { $pathBox.Text = Split-Path -Parent $dialog.FileName; Begin-Check } } finally { $dialog.Dispose() }
})
$recheck.Add_Click({ Begin-Check })
$start.Add_Click({
  if ($script:checked.status -in @('success', 'current')) { Start-Process -FilePath (Join-Path $script:actualTarget '启动百科.vbs'); return }
  if ($script:checked.status -ne 'ready') { return }
  try { New-BackendProcess 'install' } catch { Show-Blocked $_.Exception.Message '请重新检查目录后再试。' }
})
$notes.Add_Click({ $file = Join-Path $packageRoot '版本更新详情.txt'; if (-not (Test-Path -LiteralPath $file)) { $file = Join-Path $packageRoot '更新说明.txt' }; Start-Process -FilePath $file })
$openFolder.Add_Click({ if (Test-Path -LiteralPath $script:actualTarget) { Start-Process -FilePath 'explorer.exe' -ArgumentList (Quote-Argument $script:actualTarget) } })
$viewLog.Add_Click({ if (Test-Path -LiteralPath $script:logPath) { Start-Process -FilePath $script:logPath } })
$close.Add_Click({ $form.Close() })
$form.Add_FormClosing({
  param($sender, $event)
  if ($script:process -and -not $script:process.HasExited) { $event.Cancel = $true; [void][Windows.Forms.MessageBox]::Show($form, '更新程序正在处理，请等待完成结果后再关闭。', '请等待', 'OK', 'Information') }
})
if ($script:selfTesting) { $form.Opacity = 0; $form.ShowInTaskbar = $false; $Target = $SelfTestTarget }
if ($Target) { $pathBox.Text = $Target; $form.Add_Shown({ Begin-Check }) }
try { [void]$form.ShowDialog() }
finally { $timer.Stop(); $timer.Dispose(); if ($script:process) { $script:process.WaitForExit(); $script:process.Dispose() }; $form.Dispose() }
