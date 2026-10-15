using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Threading;
using Newtonsoft.Json.Linq;

namespace InventoryKamera
{
    internal sealed class ScannerUpdateProgress
    {
        internal string Stage, Detail;
        internal int Completed, Total;
    }

    internal sealed class ScannerUpdateResult
    {
        internal string Summary, Detail, ReleaseUrl;
        internal bool CanReload;
        internal Version GameVersion;
    }

    // Only network transport and update progress live here; upstream list conversion stays intact.
    internal static class ScannerUpdateNetwork
    {
        private static readonly string[] Files = { "weapons.json", "artifacts.json", "characters.json", "materials.json", "version.txt" };
        private static IProgress<ScannerUpdateProgress> activeProgress;
        private static CancellationToken activeCancellation;
        private static int finishedLists;

        internal static string Download(string url)
        {
            var token = activeCancellation;
            token.ThrowIfCancellationRequested();
            var filename = Path.GetFileName(new Uri(url).AbsolutePath);
            var label = filename == "commits" ? "版本记录" : filename == "releases" ? "程序版本记录" :
                filename == "TextMapEN.json" ? "英文名称表" : filename == "TextMap_MediumEN.json" ? "补充名称表" : filename;
            activeProgress?.Report(new ScannerUpdateProgress { Stage = "正在下载", Detail = label + " · 正在连接服务器" });
            using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(token))
            using (var client = new HttpClient())
            {
                timeout.CancelAfter(TimeSpan.FromSeconds(60));
                client.DefaultRequestHeaders.UserAgent.ParseAdd("InventoryKamera-Wiki-Chinese/1.4.5");
                try
                {
                    using (var response = client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, timeout.Token).GetAwaiter().GetResult())
                    {
                        if (!response.IsSuccessStatusCode)
                            throw new HttpRequestException("服务器返回 HTTP " + (int)response.StatusCode +
                                (response.StatusCode == System.Net.HttpStatusCode.Forbidden || (int)response.StatusCode == 429 ? "（访问受限或请求过于频繁）" : ""));
                        var total = response.Content.Headers.ContentLength;
                        using (var input = response.Content.ReadAsStreamAsync().GetAwaiter().GetResult())
                        using (var output = new MemoryStream())
                        {
                            var buffer = new byte[65536];
                            var watch = Stopwatch.StartNew();
                            int count;
                            while ((count = input.ReadAsync(buffer, 0, buffer.Length, timeout.Token).GetAwaiter().GetResult()) > 0)
                            {
                                output.Write(buffer, 0, count);
                                if (watch.ElapsedMilliseconds < 200) continue;
                                watch.Restart();
                                activeProgress?.Report(new ScannerUpdateProgress { Stage = "正在下载", Detail = label + " · 已接收 " +
                                    (output.Length / 1048576d).ToString("0.0") + " MB" + (total.HasValue ? " / " + (total.Value / 1048576d).ToString("0.0") + " MB" : ""),
                                    Completed = total.HasValue && total.Value > 0 ? (int)Math.Min(1000, output.Length * 1000 / total.Value) : 0,
                                    Total = total.HasValue && total.Value > 0 ? 1000 : 0 });
                            }
                            token.ThrowIfCancellationRequested();
                            return Encoding.UTF8.GetString(output.ToArray()).TrimStart('\uFEFF');
                        }
                    }
                }
                catch (OperationCanceledException) when (!token.IsCancellationRequested)
                {
                    throw new TimeoutException("连接或下载超时（60秒），请检查网络后重试");
                }
            }
        }

        internal static void ListFinished(ListType list, UpdateStatus status)
        {
            var count = Interlocked.Increment(ref finishedLists);
            var label = list == ListType.Weapons ? "武器" : list == ListType.Artifacts ? "圣遗物" : list == ListType.Characters ? "角色" : "材料";
            activeProgress?.Report(new ScannerUpdateProgress { Stage = "正在整理识别资料", Detail = label +
                (status == UpdateStatus.Fail ? "整理失败" : "已整理") + " · " + count + " / 4 类", Completed = count, Total = 4 });
        }

        internal static ScannerUpdateResult UpdateGameData(IProgress<ScannerUpdateProgress> progress, CancellationToken token, bool force)
        {
            var target = Path.GetFullPath("inventorylists");
            var work = Path.Combine(Path.GetTempPath(), "InventoryKamera-zh-update-" + Guid.NewGuid().ToString("N"));
            var stage = Path.Combine(work, "lists");
            Directory.CreateDirectory(stage);
            activeProgress = progress;
            activeCancellation = token;
            finishedLists = 0;
            try
            {
                foreach (var file in Files)
                {
                    var original = Path.Combine(target, file);
                    if (File.Exists(original)) File.Copy(original, Path.Combine(stage, file));
                }
                var manager = new DatabaseManager(stage + Path.DirectorySeparatorChar);
                progress.Report(new ScannerUpdateProgress { Stage = "正在检查版本", Detail = "本地识别资料 " + manager.LocalVersion + " · 正在读取远程版本" });
                var available = manager.UpdateAvailable();
                token.ThrowIfCancellationRequested();
                if (!available && !force)
                    return new ScannerUpdateResult { Summary = "识别资料已是最新 · " + manager.LocalVersion,
                        Detail = "检查完成，无需更新；也可手动重新下载资料", CanReload = true };
                progress.Report(new ScannerUpdateProgress { Stage = "正在更新资料", Detail = "本地 " + manager.LocalVersion + " → 远程 " + manager.RemoteVersion });
                var status = manager.UpdateGameData(force);
                token.ThrowIfCancellationRequested();
                if (status == UpdateStatus.Fail) throw new InvalidOperationException("资料下载或整理失败，原有本地资料已保留");
                foreach (var file in Files.Take(4))
                {
                    var value = JObject.Parse(File.ReadAllText(Path.Combine(stage, file)));
                    if (!value.HasValues) throw new InvalidDataException("下载的识别资料为空：" + file);
                }
                progress.Report(new ScannerUpdateProgress { Stage = "正在保存资料", Detail = "四类识别资料整理完成，正在应用到本地", Completed = 4, Total = 4 });
                Commit(target, stage, work, token);
                return new ScannerUpdateResult { Summary = "游戏识别资料更新完成 · " + manager.LocalVersion,
                    Detail = "武器、圣遗物、角色与材料资料已保存，中文界面保持可用", GameVersion = manager.LocalVersion };
            }
            finally
            {
                activeProgress = null;
                activeCancellation = CancellationToken.None;
                try { Directory.Delete(work, true); } catch (IOException) { }
            }
        }

        private static void Commit(string target, string stage, string work, CancellationToken token)
        {
            var backup = Path.Combine(work, "previous");
            Directory.CreateDirectory(backup);
            var existed = Files.Where(file => File.Exists(Path.Combine(target, file))).ToArray();
            foreach (var file in existed) File.Copy(Path.Combine(target, file), Path.Combine(backup, file));
            token.ThrowIfCancellationRequested();
            // Commit is short and non-cancellable; roll back all files together on an I/O failure.
            try
            {
                Directory.CreateDirectory(target);
                foreach (var file in Files) File.Copy(Path.Combine(stage, file), Path.Combine(target, file), true);
            }
            catch
            {
                foreach (var file in Files)
                    if (existed.Contains(file)) File.Copy(Path.Combine(backup, file), Path.Combine(target, file), true);
                    else if (File.Exists(Path.Combine(target, file))) File.Delete(Path.Combine(target, file));
                throw;
            }
        }

        internal static ScannerUpdateResult CheckScannerVersion(IProgress<ScannerUpdateProgress> progress, CancellationToken token)
        {
            activeProgress = progress;
            activeCancellation = token;
            try
            {
                var releases = JArray.Parse(Download("https://api.github.com/repos/taiwenlee/Inventory_Kamera/releases?per_page=20"));
                var latest = releases.OfType<JObject>().FirstOrDefault(release => release.Value<bool?>("draft") != true &&
                    release.Value<bool?>("prerelease") != true && Version.TryParse(((string)release["tag_name"] ?? "").TrimStart('v', 'V'), out var parsed));
                if (latest == null) throw new InvalidDataException("未找到有效的正式版本记录");
                var version = new Version(((string)latest["tag_name"]).TrimStart('v', 'V'));
                var current = new Version(Assembly.GetExecutingAssembly().GetName().Version.ToString(3));
                token.ThrowIfCancellationRequested();
                if (version > current)
                    return new ScannerUpdateResult { Summary = "发现新的扫描器版本 · " + version,
                        Detail = "当前 " + current + "；官方程序需单独下载，更换后需重新应用汉化", ReleaseUrl = (string)latest["html_url"] };
                return new ScannerUpdateResult { Summary = "扫描器已是最新正式版本 · " + current, Detail = "版本检查完成" };
            }
            finally { activeProgress = null; activeCancellation = CancellationToken.None; }
        }
    }
}
