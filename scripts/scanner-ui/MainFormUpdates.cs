using System;
using System.Diagnostics;
using System.Drawing;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace InventoryKamera
{
    public partial class MainForm
    {
        private bool chineseUpdateBusy;
        private bool chineseCloseAfterUpdate;
        private int chineseUpdateGeneration;
        private CancellationTokenSource chineseUpdateCancellation;
        private readonly Stopwatch chineseUpdateWatch = new Stopwatch();
        private System.Windows.Forms.Timer chineseUpdateTimer;
        private Label chineseUpdateTitle, chineseUpdateDetail, chineseUpdateElapsed;
        private ProgressBar chineseUpdateBar;
        private Button chineseDataUpdateButton, chineseVersionUpdateButton, chineseUpdateCancelButton, chineseReloadButton, chineseReleaseButton;
        private ToolStripMenuItem chineseVersionMenu;
        private string chineseReleaseUrl;
        private Control chineseUpdateCard;

        private Control ChineseUpdateHost(Control tabs)
        {
            chineseUpdateTitle = ChineseLabel("游戏识别资料 · 手动更新", true);
            chineseUpdateTitle.Name = "ChineseUpdateTitle";
            chineseUpdateDetail = ChineseLabel("");
            chineseUpdateDetail.Visible = false;
            chineseUpdateDetail.Name = "ChineseUpdateDetail";
            chineseUpdateDetail.Dock = DockStyle.Top;
            chineseUpdateElapsed = ChineseLabel("");
            chineseDataUpdateButton = new Button { Text = "更新游戏资料" };
            chineseVersionUpdateButton = new Button { Text = "检查程序版本" };
            chineseUpdateCancelButton = new Button { Text = "取消更新", Visible = false };
            chineseReloadButton = new Button { Text = "重新下载资料", Visible = false };
            chineseReleaseButton = new Button { Text = "打开新版下载页", Visible = false };
            foreach (var button in new[] { chineseDataUpdateButton, chineseVersionUpdateButton, chineseUpdateCancelButton, chineseReloadButton, chineseReleaseButton })
                ChineseButton(button);
            chineseUpdateBar = new ProgressBar { Name = "ChineseUpdateProgress", Dock = DockStyle.Top, Height = 8,
                Style = ProgressBarStyle.Marquee, MarqueeAnimationSpeed = 30, Visible = false, Margin = new Padding(0, 2, 0, 2) };
            var reminder = ChineseLabel("游戏版本更新后，扫描前请先更新识别资料；资料更新不会影响中文界面。");
            reminder.Dock = DockStyle.Top;
            var card = ChineseStack(
                ChineseFlow(chineseUpdateTitle, chineseDataUpdateButton, chineseVersionUpdateButton, chineseUpdateCancelButton, chineseReloadButton, chineseReleaseButton, chineseUpdateElapsed),
                chineseUpdateBar, chineseUpdateDetail, reminder);
            chineseUpdateCard = card;
            card.Padding = new Padding(10, 5, 10, 6);
            card.BackColor = Color.White;
            card.Margin = new Padding(0, 0, 0, 6);
            card.SizeChanged += (sender, args) => {
                var width = Math.Max(100, card.ClientSize.Width - card.Padding.Horizontal);
                chineseUpdateDetail.MaximumSize = reminder.MaximumSize = new Size(width, 0);
            };
            var host = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, Margin = Padding.Empty };
            host.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            host.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            host.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            host.Controls.Add(card, 0, 0);
            host.Controls.Add(tabs, 0, 1);
            return host;
        }

        private void InitializeChineseUpdates()
        {
            chineseUpdateTitle.Text = "游戏识别资料 · 当前 " + databaseManager.LocalVersion;
            chineseDataUpdateButton.Click += (sender, args) => StartChineseGameUpdate(false);
            chineseVersionUpdateButton.Click += (sender, args) => StartChineseVersionCheck();
            chineseReloadButton.Click += (sender, args) => StartChineseGameUpdate(true);
            chineseUpdateCancelButton.Click += (sender, args) => CancelChineseUpdate();
            chineseReleaseButton.Click += (sender, args) => {
                if (!string.IsNullOrEmpty(chineseReleaseUrl)) Process.Start(new ProcessStartInfo(chineseReleaseUrl) { UseShellExecute = true });
            };
            chineseUpdateTimer = new System.Windows.Forms.Timer { Interval = 250 };
            chineseUpdateTimer.Tick += (sender, args) => chineseUpdateElapsed.Text = "耗时 " + (int)chineseUpdateWatch.Elapsed.TotalSeconds + " 秒";
            Disposed += (sender, args) => chineseUpdateTimer.Dispose();
        }

        private async void StartChineseGameUpdate(bool force)
        {
            await RunChineseUpdateAsync("游戏资料更新", (progress, token) => ScannerUpdateNetwork.UpdateGameData(progress, token, force));
        }

        private async void StartChineseVersionCheck()
        {
            await RunChineseUpdateAsync("程序版本检查", ScannerUpdateNetwork.CheckScannerVersion);
        }

        private async Task RunChineseUpdateAsync(string title, Func<IProgress<ScannerUpdateProgress>, CancellationToken, ScannerUpdateResult> work)
        {
            if (chineseUpdateBusy || running || (scannerThread != null && scannerThread.IsAlive)) return;
            chineseUpdateBusy = true;
            var generation = ++chineseUpdateGeneration;
            chineseUpdateCancellation = new CancellationTokenSource();
            chineseUpdateTitle.Text = title + "：正在准备";
            chineseUpdateTitle.ForeColor = chineseAccent;
            chineseUpdateDetail.Text = "正在后台处理，可继续查看识别详情和日志";
            chineseUpdateDetail.Visible = true;
            chineseUpdateElapsed.Text = "耗时 0 秒";
            chineseUpdateBar.Style = ProgressBarStyle.Marquee;
            chineseUpdateBar.Visible = true;
            chineseReloadButton.Visible = chineseReleaseButton.Visible = false;
            chineseUpdateCancelButton.Visible = chineseUpdateCancelButton.Enabled = true;
            chineseDataUpdateButton.Enabled = chineseVersionUpdateButton.Enabled = false;
            SetChineseScanningState(false);
            chineseUpdateWatch.Restart();
            chineseUpdateTimer.Start();
            var progress = new Progress<ScannerUpdateProgress>(value => {
                if (!chineseUpdateBusy || generation != chineseUpdateGeneration || IsDisposed || chineseUpdateCancellation.IsCancellationRequested) return;
                chineseUpdateTitle.Text = title + "：" + value.Stage;
                chineseUpdateDetail.Text = value.Detail;
                chineseUpdateBar.Style = value.Total > 0 ? ProgressBarStyle.Continuous : ProgressBarStyle.Marquee;
                if (value.Total > 0) { chineseUpdateBar.Maximum = value.Total; chineseUpdateBar.Value = Math.Min(value.Total, Math.Max(0, value.Completed)); }
            });
            try
            {
                var result = await Task.Run(() => work(progress, chineseUpdateCancellation.Token));
                chineseUpdateTitle.Text = result.Summary;
                chineseUpdateTitle.ForeColor = Color.FromArgb(35, 121, 76);
                chineseUpdateDetail.Text = result.Detail;
                chineseReloadButton.Visible = result.CanReload;
                chineseReleaseUrl = result.ReleaseUrl;
                chineseReleaseButton.Visible = !string.IsNullOrEmpty(result.ReleaseUrl);
                if (result.GameVersion != null) databaseManager = new DatabaseManager();
            }
            catch (OperationCanceledException)
            {
                chineseUpdateTitle.Text = title + "：已取消";
                chineseUpdateDetail.Text = "继续使用原有本地识别资料，可随时重试";
            }
            catch (Exception ex)
            {
                Logger.Warn(ex, "Scanner update failed");
                UserInterface.AddError(title + "失败：" + ex.Message);
                chineseUpdateTitle.Text = title + "：未完成";
                chineseUpdateTitle.ForeColor = Color.FromArgb(174, 58, 45);
                chineseUpdateDetail.Text = ex.Message + "；可重试或在运行日志中查看详情";
            }
            finally
            {
                chineseUpdateTimer.Stop();
                chineseUpdateWatch.Stop();
                chineseUpdateElapsed.Text = "耗时 " + (int)chineseUpdateWatch.Elapsed.TotalSeconds + " 秒";
                chineseUpdateBusy = false;
                chineseUpdateCancellation.Dispose();
                chineseUpdateCancellation = null;
                chineseUpdateBar.Visible = chineseUpdateCancelButton.Visible = false;
                chineseDataUpdateButton.Enabled = chineseVersionUpdateButton.Enabled = true;
                SetChineseScanningState(false);
                if (chineseCloseAfterUpdate) BeginInvoke((MethodInvoker)Close);
            }
        }

        private void CancelChineseUpdate()
        {
            if (!chineseUpdateBusy) return;
            chineseUpdateCancellation.Cancel();
            chineseUpdateCancelButton.Enabled = false;
            chineseUpdateTitle.Text = "正在取消更新";
            chineseUpdateDetail.Text = "正在结束后台任务，请稍候";
        }

        private bool WaitForChineseUpdateOnClose()
        {
            if (!chineseUpdateBusy) return false;
            chineseCloseAfterUpdate = true;
            CancelChineseUpdate();
            return true;
        }
    }
}
