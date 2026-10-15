param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][string]$CompilerPath,
    [string]$RuntimeRoot,
    [string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
if (-not $RuntimeRoot) { $RuntimeRoot = Join-Path $PSScriptRoot '..\..\原神库存扫描器\v1.4.5' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '..\..\原神库存扫描器\中文界面预览' }
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$CompilerPath = (Resolve-Path -LiteralPath $CompilerPath).Path
$RuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot).Path
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) { throw '输出目录已经存在；为避免覆盖，请指定新的目录。' }
$buildRoot = Join-Path $OutputDirectory '.build'
$stage = Join-Path $buildRoot 'source'
$utf8 = New-Object Text.UTF8Encoding($false)
New-Item -ItemType Directory -Path $stage -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $SourceRoot 'InventoryKamera') -Destination $stage -Recurse
$project = Join-Path $stage 'InventoryKamera'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'ScannerChinese.cs') -Destination $project
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'MainFormChinese.cs') -Destination (Join-Path $project 'ui\main')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'MainFormUpdates.cs') -Destination (Join-Path $project 'ui\main')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'ScannerUpdateNetwork.cs') -Destination $project

function Patch-Source([string]$relative, [scriptblock]$patch) {
    $path = Join-Path $project $relative
    $text = [IO.File]::ReadAllText($path)
    $next = & $patch $text
    [IO.File]::WriteAllText($path, $next, $utf8)
}
function Replace-Required([string]$text, [string]$before, [string]$after) {
    if (-not $text.Contains($before)) { throw ('源码与固定 1.4.5 基准不一致：' + $before) }
    return $text.Replace($before, $after)
}

Patch-Source 'ui\main\MainForm.cs' {
    param($text)
    $text = Replace-Required $text 'Text = $"Inventory Kamera V{version}";' 'Text = $"Inventory Kamera V{version}"; ConfigureChineseInterface();'
    $text = Replace-Required $text 'ProgramStatus_Label.Text = "";' 'ProgramStatus_Label.Text = "准备就绪";'
    $text = Replace-Required $text 'if (scannerThread.IsAlive)' 'if (scannerThread != null && scannerThread.IsAlive)'
    $text = Replace-Required $text 'running = true;' 'running = true; SetChineseScanningState(true);'
    $text = Replace-Required $text 'running = false;' 'running = false;'
    $text = Replace-Required $text 'OpenOptimizerDialog(good);' '// Scan completion is shown in the status bar; GO export remains a manual action.'
    $text = Replace-Required $text 'ManualExportButton.Invoke((MethodInvoker)delegate' 'BeginInvoke((MethodInvoker)(() => SetChineseScanningState(false))); ManualExportButton.Invoke((MethodInvoker)delegate'
    $text = Replace-Required $text 'SaveSettings();' 'if (WaitForChineseUpdateOnClose()) { e.Cancel = true; return; } SaveSettings();'
    $shownPattern = 'private void MainForm_Shown\(object sender, EventArgs e\)\s*\{\s*CheckForKameraUpdates\(\);\s*CheckForGenshinUpdates\(\);\s*\}'
    if ([regex]::Matches($text, $shownPattern).Count -ne 1) { throw '启动更新检查补丁与固定源码不匹配' }
    $shownBody = @'
        private void MainForm_Shown(object sender, EventArgs e)
        {
            if (ScannerChinese.PreviewOnly)
            {
                ProgramStatus_Label.Text = "界面预览 · 未执行扫描";
                StartScan_Button.Enabled = false;
            }
            // Start with the bundled local data. Network updates are explicitly user initiated.
        }
'@
    $text = [regex]::Replace($text, $shownPattern, $shownBody)
    $updateMethods = @(
        @('(?s)private void DatabaseUpdateMenuItem_Click\(object sender, EventArgs e\).*?(?=\s*#region Unicode Helper Functions)', 'private void DatabaseUpdateMenuItem_Click(object sender, EventArgs e) { StartChineseGameUpdate(false); }'),
        @('(?s)private async void CheckForKameraUpdates\(\).*?(?=\s*private void CheckForGenshinUpdates)', 'private void CheckForKameraUpdates() { StartChineseVersionCheck(); }'),
        @('(?s)private void CheckForGenshinUpdates\(\).*?(?=\s*private void Export_Button_Click)', 'private void CheckForGenshinUpdates() { StartChineseGameUpdate(false); }')
    )
    foreach ($patch in $updateMethods) {
        if ([regex]::Matches($text, $patch[0]).Count -ne 1) { throw '后台更新入口与固定源码不匹配' }
        $text = [regex]::Replace($text, $patch[0], $patch[1] + "`r`n")
    }
    $translations = @{
        ' already exists as a character''s name.\n' = ' 已与现有角色名称重复。\n'
        'This may affect equipping items to characters and is not fully supported yet.' = '这可能影响导出的装备归属，请使用不重复的英文名称。'
        'Please set an output directory' = '请先选择导出文件夹'
        ' is not a valid directory' = ' 不是有效的导出文件夹'
        'Scan complete! Would you like to upload the database to Genshin Optimizer?' = '扫描完成，GOOD 文件已导出。是否复制结果并打开 Genshin Optimizer？'
        'Scan Complete' = '扫描完成'
        'Content copied to your clipboard! Paste the content into the textbox when prompted.' = '结果已复制到剪贴板。请在 Genshin Optimizer 的导入框中粘贴。'
        'Data Copied' = '结果已复制'
        'Unable to update game data. Please check the log for more details' = '游戏识别资料更新失败，请查看运行日志。'
        'Update failed' = '更新失败'
        'Update status' = '更新结果'
        'Update success' = '更新成功'
        'Update for game version ' = '游戏识别资料 '
        ' successful.' = ' 更新成功。'
        'No update necessary! You are already using the latest game data (' = '当前游戏识别资料已是最新版本（'
        ')." +' = '）。" +'
        ' Would you like to force an update?' = ' 是否仍要重新下载资料？'
        'Already Up to Date' = '资料已是最新'
        'A new version of Inventory Kamera is available.\n\n' = '发现新的扫描器版本。\n\n'
        'Current Version: ' = '当前版本：'
        'Latest Version: ' = '新版本：'
        'Would you like to download the update?' = '是否打开下载页面？官方版本不会自动替换本地中文界面。'
        'Inventory Kamera Update' = '扫描器版本更新'
        'A new version for Genshin Impact has been found. Would you like to update Kamera''s lookup tables? (Recommended)' = '发现新版本游戏识别资料，是否更新？建议在扫描前更新。'
        'Game Version Update' = '游戏识别资料更新'
        'Update skipped. Please know that skipping this update will likely result in incorrect scans.\n' = '本次未更新识别资料，新增角色或装备可能无法准确识别。\n'
        '\nYou may check for updates again on restarting this application or by using the update manager found' = '\n可在“设置 → 更新游戏识别资料”中重新检查'
        ' under ''options''' = '。'
        'Update declined' = '已跳过更新'
        'Could not check for updates. Consider trying again in an hour or so.' = '暂时无法检查游戏识别资料更新。请确认网络连接，稍后从设置中重试。'
    }
    foreach ($pair in $translations.GetEnumerator()) { $text = $text.Replace($pair.Key, $pair.Value) }
    return $text
}
Patch-Source 'ui\UserInterface.cs' {
    param($text)
    $text = Replace-Required $text 'programStatus_Label.Text = status;' 'programStatus_Label.Text = ScannerChinese.Status(status);'
    $text = Replace-Required $text 'textBox.AppendText(text.Replace' 'textBox.AppendText(ScannerChinese.Readout(text).Replace'
    $text = Replace-Required $text 'UpdateTextBox($"{error.Replace' 'UpdateTextBox($"{ScannerChinese.ExplainError(error).Replace'
    $text = [regex]::Replace($text, '(\b\w+(?:\[\d+\])?)\.Invoke\(', 'UiInvoke($1, ')
    $helper = @'
        // Hidden tab controls marshal through their main form even before their own handle exists.
        private static void UiInvoke(Control control, MethodInvoker action)
        {
            var owner = control.FindForm() ?? control;
            if (owner.IsDisposed || owner.Disposing) return;
            if (owner.InvokeRequired) owner.Invoke(action); else action();
        }

'@
    $text = Replace-Required $text 'private static void UpdateElements(' ($helper + 'private static void UpdateElements(')
    return $text
}
Patch-Source 'ui\ExecutablesForm.cs' {
    param($text)
    $text = Replace-Required $text 'InitializeComponent();' 'InitializeComponent(); ScannerChinese.TranslateControls(this); Font = new System.Drawing.Font("Microsoft YaHei UI", 9f);'
    return $text
}
Patch-Source 'Properties\JsonUserSettingsProvider.cs' {
    param($text)
    $text = [regex]::Replace($text, 'public static string SettingsDirectory => Path.Combine\(\s*Environment.GetFolderPath\(Environment.SpecialFolder.LocalApplicationData\),\s*Path.GetFileNameWithoutExtension\(Application.ExecutablePath\)\);', 'public static string SettingsDirectory => ScannerChinese.SettingsDirectory;')
    if (-not $text.Contains('SettingsDirectory => ScannerChinese.SettingsDirectory')) { throw '设置目录隔离补丁失败' }
    return $text
}
Patch-Source 'Program.cs' {
    param($text)
    $text = Replace-Required $text 'ConfigureLogging();' 'ScannerChinese.ConfigureNetworking(); ConfigureLogging();'
    return $text.Replace('Inventory Kamera has encountered an error it was not meant to handle.', '扫描器发生异常。').Replace(' Please check the application''s log and/or upload it to GitHub when reporting your issue. Thanks!', ' 请查看本地运行日志，反馈时可附上错误信息。').Replace('Application Crashed', '扫描器发生异常')
}
Patch-Source 'Properties\AssemblyInfo.cs' {
    param($text)
    return $text.Replace('AssemblyVersion("1.4.5.*")', 'AssemblyVersion("1.4.5.20986")') + "`r`n[assembly: AssemblyInformationalVersion(`"1.4.5-wiki-zh-ui.5`") ]`r`n[assembly: System.Runtime.Versioning.TargetFramework(`".NETFramework,Version=v4.7.2`", FrameworkDisplayName = `".NET Framework 4.7.2`")]`r`n"
}

Patch-Source 'data\DatabaseManager.cs' {
    param($text)
    $text = Replace-Required $text 'public DatabaseManager()' 'public DatabaseManager(string listsDirectory = null)'
    $text = Replace-Required $text 'Directory.CreateDirectory(ListsDir);' 'if (listsDirectory != null) ListsDir = listsDirectory; Directory.CreateDirectory(ListsDir);'
    $versionPattern = '(?s)private Version CheckRemoteVersion\(\).*?(?=\s*public Dictionary<string, JObject> LoadCharacters)'
    $versionBody = @'
        private Version CheckRemoteVersion()
        {
            var commits = JsonConvert.DeserializeObject<List<JObject>>(ScannerUpdateNetwork.Download(commitsAPIURL));
            foreach (var commit in commits)
            {
                var match = Regex.Match(commit["title"].ToString(), @"(\d+\.\d+\.\d+)");
                if (match.Success) return new Version(match.Groups[1].Value);
            }
            return null;
        }

'@
    $downloadPattern = '(?s)private string LoadJsonFromURLAsync\(string url\).*?(?=\s*private UpdateStatus UpdateList)'
    foreach ($pattern in @($versionPattern, $downloadPattern)) {
        if ([regex]::Matches($text, $pattern).Count -ne 1) { throw '资料更新网络补丁与固定源码不匹配' }
    }
    $text = [regex]::Replace($text, $versionPattern, $versionBody)
    $text = [regex]::Replace($text, $downloadPattern, 'private string LoadJsonFromURLAsync(string url) { return ScannerUpdateNetwork.Download(url); }' + "`r`n")
    $text = Replace-Required $text 'Logger.Info("Finished updating {0} ({1})", list, status);' 'Logger.Info("Finished updating {0} ({1})", list, status); ScannerUpdateNetwork.ListFinished(list, status);'
    $original = [IO.File]::ReadAllText((Join-Path $SourceRoot 'InventoryKamera\data\DatabaseManager.cs'))
    $conversionStart = 'private UpdateStatus UpdateList('
    $before = $original.Substring($original.IndexOf($conversionStart))
    $after = $text.Substring($text.IndexOf($conversionStart)).Replace(' ScannerUpdateNetwork.ListFinished(list, status);', '')
    if ($before -cne $after) { throw '游戏识别资料转换逻辑发生了意外改动' }
    return $text
}

# Recognition, game navigation and GOOD serialization remain byte-identical; only the updater is excepted.
foreach ($folder in @('game', 'scraping', 'data')) {
    Get-ChildItem -LiteralPath (Join-Path $SourceRoot ('InventoryKamera\' + $folder)) -Filter '*.cs' -Recurse | ForEach-Object {
        $relative = $_.FullName.Substring((Join-Path $SourceRoot 'InventoryKamera').Length + 1)
        # Only the updater's transport, isolated output path and progress callbacks are patched.
        if ($relative -eq 'data\DatabaseManager.cs') { return }
        $before = [IO.File]::ReadAllBytes($_.FullName)
        $after = [IO.File]::ReadAllBytes((Join-Path $project $relative))
        if ([Convert]::ToBase64String($before) -cne [Convert]::ToBase64String($after)) { throw ('扫描逻辑发生了未授权改动：' + $relative) }
    }
}

$assembly = [Reflection.Assembly]::LoadFile((Join-Path $RuntimeRoot 'InventoryKamera.exe'))
$resourceArgs = @()
foreach ($name in $assembly.GetManifestResourceNames()) {
    $path = Join-Path $buildRoot $name
    $stream = $assembly.GetManifestResourceStream($name)
    $file = [IO.File]::Create($path)
    try { $stream.CopyTo($file) } finally { $file.Dispose(); $stream.Dispose() }
    $resourceArgs += ('/resource:' + $path + ',' + $name)
}
$framework = [Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$systemNames = @('mscorlib', 'System', 'System.Core', 'System.Drawing', 'System.Windows.Forms', 'System.Configuration', 'System.Net.Http', 'System.Xml', 'System.Xml.Linq', 'System.Data', 'System.Runtime.Serialization', 'System.Numerics', 'Microsoft.CSharp', 'WindowsBase', 'PresentationCore', 'PresentationFramework', 'System.Xaml', 'netstandard')
$references = @()
foreach ($name in $systemNames) {
    $path = Join-Path $framework ($name + '.dll')
    if (-not (Test-Path -LiteralPath $path)) { $path = Join-Path $framework ('WPF\' + $name + '.dll') }
    if (-not (Test-Path -LiteralPath $path)) { $path = Join-Path $framework ('Facades\' + $name + '.dll') }
    if (-not (Test-Path -LiteralPath $path)) {
        $gac = Join-Path 'C:\Windows\Microsoft.NET\assembly\GAC_MSIL' $name
        $path = Get-ChildItem -LiteralPath $gac -Filter ($name + '.dll') -Recurse | Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $path) { throw ('缺少系统程序集：' + $name) }
    $references += ('/reference:' + $path)
}
Get-ChildItem -LiteralPath $RuntimeRoot -Filter '*.dll' | ForEach-Object { $references += ('/reference:' + $_.FullName) }
$sources = @(Get-ChildItem -LiteralPath $project -Filter '*.cs' -Recurse | Select-Object -ExpandProperty FullName)
$executable = Join-Path $OutputDirectory 'InventoryKamera.zh.exe'
$compilerArgs = @('/nologo', '/noconfig', '/nostdlib+', '/target:winexe', '/platform:anycpu', '/langversion:latest', '/optimize+', '/define:TRACE', ('/out:' + $executable), ('/win32manifest:' + (Join-Path $project 'app.manifest')), ('/win32icon:' + (Join-Path $project 'Item_Special_Kamera.ico'))) + $references + $resourceArgs + $sources
& $CompilerPath @compilerArgs
if ($LASTEXITCODE -ne 0) { throw '中文界面编译失败' }
Get-ChildItem -LiteralPath $RuntimeRoot -Filter '*.dll' | Copy-Item -Destination $OutputDirectory
Get-ChildItem -LiteralPath $RuntimeRoot -Filter '*.dll.config' | Copy-Item -Destination $OutputDirectory
foreach ($folder in @('tessdata', 'x64', 'x86', 'inventorylists')) { Copy-Item -LiteralPath (Join-Path $RuntimeRoot $folder) -Destination $OutputDirectory -Recurse }
Copy-Item -LiteralPath (Join-Path $RuntimeRoot 'InventoryKamera.exe.config') -Destination ($executable + '.config')
Copy-Item -LiteralPath (Join-Path $SourceRoot 'LICENSE') -Destination (Join-Path $OutputDirectory 'LICENSE.InventoryKamera.txt')
$launch = @'
Set fs = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fs.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
shell.Run Chr(34) & fs.BuildPath(root, "InventoryKamera.zh.exe") & Chr(34), 1, False
'@
[IO.File]::WriteAllText((Join-Path $OutputDirectory '启动中文扫描器.vbs'), $launch, $utf8)
@{source='https://github.com/taiwenlee/Inventory_Kamera'; tag='v1.4.5'; commit='427b868362e1b01926c0e10d27f67c331307e96f'; scope='中文紧凑界面、后台资料更新及进度、可缩小窗口；扫描完成不自动弹窗；扫描、导航和GOOD源码保持原样'; build='wiki-zh-ui.5'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory '界面修改来源.json') -Encoding UTF8
Write-Output ('Built: ' + $executable)
