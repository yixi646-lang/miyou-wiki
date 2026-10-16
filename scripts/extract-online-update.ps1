$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archivePath = [IO.Path]::GetFullPath($env:WIKI_ONLINE_ARCHIVE)
$extractPath = [IO.Path]::GetFullPath($env:WIKI_ONLINE_EXTRACT)
$jobPath = [IO.Path]::GetDirectoryName($archivePath)
if ([IO.Path]::GetDirectoryName($extractPath) -ne $jobPath -or (Test-Path -LiteralPath $extractPath)) { throw '更新解压目标必须是本任务内的新目录。' }
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $names = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $total = 0L
  if ($archive.Entries.Count -gt 20000) { throw '更新包文件数量过多。' }
  foreach ($entry in $archive.Entries) {
    $relative = $entry.FullName.Replace('\', '/').TrimEnd('/')
    if (-not $relative -or $relative.StartsWith('/') -or $relative.Contains(':') -or ($relative.Split('/') | Where-Object { $_ -eq '..' -or $_ -eq '.' -or -not $_ -or $_.TrimEnd(' ', '.') -ne $_ })) { throw '更新包包含非法路径。' }
    $target = [IO.Path]::GetFullPath((Join-Path $extractPath $relative))
    if (-not $target.StartsWith($extractPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '更新文件超出临时目录。' }
    if (-not $names.Add($relative)) { throw '更新包包含重复路径。' }
    if ((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw '更新包不能包含符号链接。' }
    $total += $entry.Length
    if ($total -gt 2GB -or $entry.Length -gt 512MB) { throw '更新包解压体积超过限制。' }
  }
} finally { $archive.Dispose() }
[IO.Compression.ZipFile]::ExtractToDirectory($archivePath, $extractPath)
