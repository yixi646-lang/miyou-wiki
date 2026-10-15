using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace InventoryKamera
{
    public partial class MainForm
    {
        private Control chineseSettingsPane;
        private Button chineseStopButton;
        private TabControl chineseTabs;
        private TableLayoutPanel chineseBody;
        private TableLayoutPanel chineseRightHost;
        private Panel chineseRightPane;
        private TabPage chineseNarrowSettings;
        private float chineseDpiScale = 1f;
        private bool chineseResponsiveLayout;
        private bool chineseRightLayout;
        private readonly Color chineseAccent = Color.FromArgb(45, 104, 181);

        private Label ChineseLabel(string text, bool bold = false)
        {
            return new Label { Text = text, AutoSize = true, Margin = new Padding(0, 2, 0, 2),
                ForeColor = Color.FromArgb(42, 51, 65), Font = new Font("Microsoft YaHei UI", bold ? 10.5f : 9f, bold ? FontStyle.Bold : FontStyle.Regular) };
        }

        private TableLayoutPanel ChineseStack(params Control[] controls)
        {
            var panel = new TableLayoutPanel { AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, Dock = DockStyle.Top, ColumnCount = 1, Margin = Padding.Empty, Padding = Padding.Empty };
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            foreach (var control in controls)
            {
                panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
                panel.Controls.Add(control, 0, panel.RowCount++);
            }
            return panel;
        }

        private Control ChineseCard(string title, params Control[] controls)
        {
            var card = ChineseStack(string.IsNullOrEmpty(title) ? controls : new[] { ChineseLabel(title, true) }.Concat(controls).ToArray());
            card.BackColor = Color.White;
            card.Padding = new Padding(10, 6, 10, 8);
            card.Margin = new Padding(0, 0, 0, 8);
            return card;
        }

        private Control ChineseFields(params object[] fields)
        {
            var rows = new Control[fields.Length / 2];
            for (var i = 0; i < fields.Length; i += 2)
            {
                var field = (Control)fields[i + 1];
                // A bounded row avoids WinForms AutoSize/Dock.Fill height feedback at high DPI.
                var row = new Panel { Dock = DockStyle.Top, Height = 30, Margin = Padding.Empty };
                var label = ChineseLabel((string)fields[i]);
                label.AutoSize = false;
                label.Dock = DockStyle.None;
                label.TextAlign = ContentAlignment.MiddleLeft;
                field.Dock = DockStyle.None;
                field.Anchor = AnchorStyles.Top | AnchorStyles.Right;
                field.Width = 100;
                row.Controls.Add(label);
                row.Controls.Add(field);
                field.BringToFront();
                row.SizeChanged += (sender, args) => {
                    field.Location = new Point(Math.Max(0, row.ClientSize.Width - field.Width), Math.Max(0, (row.Height - field.Height) / 2));
                    label.Bounds = new Rectangle(0, 0, Math.Max(0, field.Left - 6), row.Height);
                };
                rows[i / 2] = row;
            }
            return ChineseStack(rows);
        }

        private FlowLayoutPanel ChineseFlow(params Control[] controls)
        {
            var flow = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = false, WrapContents = true, Height = 32, Margin = Padding.Empty };
            foreach (var control in controls)
            {
                control.Margin = new Padding(0, 3, 10, 3);
                flow.Controls.Add(control);
            }
            var sizing = false;
            EventHandler resize = (sender, args) =>
            {
                if (sizing || flow.ClientSize.Width <= 0) return;
                sizing = true;
                try {
                    var height = Math.Max(28, flow.GetPreferredSize(new Size(flow.ClientSize.Width, 0)).Height);
                    if (flow.Height != height) flow.Height = height;
                } finally { sizing = false; }
            };
            flow.SizeChanged += resize;
            flow.Layout += (sender, args) => resize(sender, args);
            return flow;
        }

        private void ChineseButton(Button button, bool primary = false)
        {
            button.AutoSize = true;
            button.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            button.MinimumSize = new Size(100, 30);
            button.Padding = new Padding(8, 2, 8, 2);
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = primary ? chineseAccent : Color.FromArgb(214, 222, 231);
            button.BackColor = primary ? chineseAccent : Color.White;
            button.ForeColor = primary ? Color.White : Color.FromArgb(42, 51, 65);
            button.UseVisualStyleBackColor = false;
        }

        private Control ChineseCounter(string title, Label number, Label separator = null, Label maximum = null)
        {
            var values = new[] { number, separator, maximum }.Where(value => value != null).Cast<Control>().ToArray();
            foreach (var value in values)
            {
                value.AutoSize = true;
                value.Font = new Font("Microsoft YaHei UI", 10.5f, FontStyle.Bold);
                value.ForeColor = chineseAccent;
                value.MinimumSize = Size.Empty;
            }
            var result = new FlowLayoutPanel { AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink,
                WrapContents = false, Margin = Padding.Empty, Padding = Padding.Empty };
            foreach (var value in new[] { ChineseLabel(title, true) }.Concat(values))
            {
                value.Margin = new Padding(0, 4, value is Label && value.Text == title ? 5 : 2, 2);
                result.Controls.Add(value);
            }
            return result;
        }

        private Control ChineseReadout(string title, TextBox text, params PictureBox[] images)
        {
            var photos = ChineseFlow();
            foreach (var image in images)
            {
                image.SizeMode = PictureBoxSizeMode.Zoom;
                image.Size = new Size(images.Length > 2 ? 92 : 150, images.Length > 2 ? 48 : 95);
                image.BackColor = Color.FromArgb(246, 248, 251);
                image.Margin = new Padding(0, 0, 6, 4);
                photos.Controls.Add(image);
            }
            text.Dock = DockStyle.Top;
            text.Multiline = true;
            text.ReadOnly = true;
            text.ScrollBars = ScrollBars.Vertical;
            text.Height = text == CharacterOutput_TextBox || text == ArtifactOutput_TextBox ? 94 : 28;
            text.MaximumSize = new Size(0, text.Height);
            text.BackColor = Color.FromArgb(250, 251, 253);
            text.BorderStyle = BorderStyle.FixedSingle;
            if (images.Length == 1)
            {
                var pair = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = false, Height = 100,
                    ColumnCount = 2, RowCount = 1, Margin = Padding.Empty };
                pair.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 160));
                pair.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
                pair.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
                text.Dock = DockStyle.Fill;
                text.MaximumSize = Size.Empty;
                pair.Controls.Add(photos, 0, 0);
                pair.Controls.Add(text, 1, 0);
                return ChineseCard(title, pair);
            }
            return ChineseCard(title, photos, text);
        }

        private void ConfigureChineseInterface()
        {
            SuspendLayout();
            ScannerChinese.TranslateControls(this);
            // The interface is built at 96-DPI coordinates and scaled once after construction.
            AutoScaleMode = AutoScaleMode.None;
            Text = "原神库存扫描器 · Inventory Kamera 1.4.5 · 中文界面";
            Font = new Font("Microsoft YaHei UI", 9f);
            ResetChineseLayoutConstraints(this);
            BackColor = Color.FromArgb(243, 246, 249);
            ForeColor = Color.FromArgb(42, 51, 65);
            AutoSize = false;
            MinimumSize = MaximumSize = Size.Empty;
            ClientSize = new Size(1080, 760);
            FormBorderStyle = FormBorderStyle.Sizable;
            MaximizeBox = true;
            StartPosition = FormStartPosition.CenterScreen;
            Controls.Clear();

            var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, Margin = Padding.Empty };
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            Controls.Add(root);
            menuStrip1.Dock = DockStyle.Fill;
            menuStrip1.BackColor = Color.White;
            menuStrip1.Font = Font;
            root.Controls.Add(menuStrip1, 0, 0);

            var header = ChineseStack(ChineseLabel("原神库存扫描器", true), ChineseLabel("扫描游戏中的角色与装备，导出 GOOD 文件后可在 Wiki 中预览导入"));
            header.Padding = new Padding(14, 4, 14, 4);
            header.BackColor = Color.White;
            root.Controls.Add(header, 0, 1);

            var body = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(10, 8, 10, 10), Margin = Padding.Empty };
            chineseBody = body;
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 292));
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            body.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.Controls.Add(body, 0, 2);

            chineseSettingsPane = new Panel { Dock = DockStyle.Fill, AutoScroll = true, Margin = new Padding(0, 0, 8, 0), Padding = new Padding(0, 0, 4, 0) };
            var choices = new[] { Weapons_CheckBox, Artifacts_Checkbox, Characters_CheckBox, CharDevItems_CheckBox, Materials_CheckBox };
            foreach (var choice in choices) { choice.AutoSize = true; choice.MinimumSize = new Size(0, 20); }
            EquipWeaponsCheckBox.AutoSize = EquipArtifactsCheckBox.AutoSize = LogScreenshotsCheckBox.AutoSize = true;
            var settings = ChineseStack(
                ChineseCard("扫描范围", ChineseFlow(choices)),
                ChineseCard("装备筛选", ChineseFields("武器最低星级", WeaponRarityControl, "武器最低等级", MinimumWeaponLevelControl,
                    "圣遗物最低星级", ArtifactRarityControl, "圣遗物最低等级", numericUpDown1),
                    ChineseStack(EquipWeaponsCheckBox, EquipArtifactsCheckBox)),
                ChineseCard("扫描数量", ChineseFields("角色数量", NumOfCharToScanControl, "圣遗物页数", SortByObtainedControl), ChineseLabel("填 0 表示扫描全部")),
                ChineseCard("扫描速度", ScannerDelay_TrackBar, ChineseLabel("快速  ←  适中  →  慢速；识别不稳定时可调慢")),
                ChineseCard("自定义名称", ChineseFields("旅行者英文名", travelerNameTextBox, "流浪者英文名", wandererNameTextBox,
                    "可改名角色（女）", textBox1, "可改名角色（男）", textBox2), ChineseLabel("名称须与游戏英文界面一致")),
                ChineseCard("诊断设置", LogScreenshotsCheckBox, ChineseLabel("仅排查识别问题时启用，截图保存到本地")));
            ScannerDelay_TrackBar.Dock = DockStyle.Top;
            ScannerDelay_TrackBar.AutoSize = false;
            ScannerDelay_TrackBar.Height = 30;
            chineseSettingsPane.Controls.Add(settings);
            body.Controls.Add(chineseSettingsPane, 0, 0);

            chineseTabs = new TabControl { Name = "ChineseTabs", Dock = DockStyle.Fill, Font = Font, Padding = new Point(12, 5), Margin = Padding.Empty };
            chineseRightHost = (TableLayoutPanel)ChineseUpdateHost(chineseTabs);
            chineseRightHost.Dock = DockStyle.Top;
            chineseRightPane = new Panel { Dock = DockStyle.Fill, AutoScroll = true, Margin = Padding.Empty };
            chineseRightPane.Controls.Add(chineseRightHost);
            body.Controls.Add(chineseRightPane, 1, 0);
            chineseNarrowSettings = new TabPage("扫描设置") { Name = "ChineseNarrowSettings", BackColor = BackColor, Padding = new Padding(8) };
            var overview = new TabPage("扫描与识别") { BackColor = BackColor, Padding = new Padding(8), AutoScroll = true };
            var logs = new TabPage("运行日志") { BackColor = BackColor, Padding = new Padding(8) };
            chineseTabs.TabPages.AddRange(new[] { overview, logs });

            ProgramStatus_Label.AutoSize = true;
            ProgramStatus_Label.Font = new Font("Microsoft YaHei UI", 13f, FontStyle.Bold);
            ProgramStatus_Label.ForeColor = chineseAccent;
            ProgramStatus_Label.Margin = new Padding(0, 3, 0, 3);
            ChineseButton(StartScan_Button, true);
            StartScan_Button.MinimumSize = new Size(116, 32);
            chineseStopButton = new Button { Text = "停止扫描", Enabled = false };
            ChineseButton(chineseStopButton);
            chineseStopButton.Click += (sender, args) => StopScanFromChineseButton();
            var weaponCount = ChineseCounter("武器", WeaponsScannedCount_Label, WeaponsScannedSlash_Label, WeaponsMax_Labell);
            var artifactCount = ChineseCounter("圣遗物", ArtifactsScanned_Label, ArtifactsScannedSlash_Label, ArtifactsMax_Label);
            var characterCount = ChineseCounter("角色", CharactersScanned_Label);

            OutputPath_TextBox.Dock = DockStyle.None;
            OutputPath_TextBox.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            OutputPath_TextBox.MinimumSize = new Size(100, 0);
            OutputPath_TextBox.Margin = new Padding(0, 3, 6, 3);
            ChineseButton(FileSelectButton);
            var directory = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, ColumnCount = 2, Margin = Padding.Empty };
            directory.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            directory.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            directory.Controls.Add(OutputPath_TextBox, 0, 0);
            directory.Controls.Add(FileSelectButton, 1, 0);
            ChineseButton(button1);
            ChineseButton(ManualExportButton);
            var hint = ChineseLabel("扫描前：游戏语言 English，键盘操作，16:9 / 16:10 画面，打开派蒙菜单。\n扫描时勿操作鼠标或键盘；按 Enter 或“停止扫描”中止，完成后自动导出。");
            hint.Dock = DockStyle.Top;
            overview.Controls.Add(ChineseStack(
                ChineseCard(null, ChineseFlow(ProgramStatus_Label, StartScan_Button, chineseStopButton, weaponCount, artifactCount, characterCount)),
                ChineseCard(null, hint),
                ChineseCard("导出位置", directory, ChineseFlow(button1, ManualExportButton, ChineseLabel("GOOD 使用英文编号，兼容 Wiki 导入"))),
                ChineseReadout("武器 / 圣遗物", ArtifactOutput_TextBox, GearPictureBox),
                ChineseReadout("角色 / 材料", CharacterOutput_TextBox, CharacterName_PictureBox, CharacterLevel_PictureBox,
                    CharacterTalent1_PictureBox, CharacterTalent2_PictureBox, CharacterTalent3_PictureBox),
                ChineseReadout("当前游戏画面", new TextBox { Text = "扫描开始后显示识别画面" }, Navigation_Image),
                ChineseCard("项目与反馈", ChineseFlow(Github_Label, Releases_Label, IssuesPage_Label))));
            ErrorLog_TextBox.Dock = DockStyle.Fill;
            ErrorLog_TextBox.Multiline = true;
            ErrorLog_TextBox.ScrollBars = ScrollBars.Both;
            ErrorLog_TextBox.ReadOnly = true;
            ErrorLog_TextBox.BackColor = Color.White;
            ErrorLog_TextBox.Font = new Font("Microsoft YaHei UI", 9f);
            var openLogs = new Button { Text = "打开日志文件夹", Dock = DockStyle.Bottom };
            ChineseButton(openLogs);
            openLogs.Click += ErrorLog_Label_Click;
            logs.Controls.Add(ErrorLog_TextBox);
            logs.Controls.Add(openLogs);

            equipWeaponToolTip.SetToolTip(EquipWeaponsCheckBox, "导出时保留武器当前装备的角色，不在游戏内切换装备。");
            equipArtifactsToolTip.SetToolTip(EquipArtifactsCheckBox, "导出时保留圣遗物当前装备的角色，不在游戏内切换装备。");
            screenshotsToolTip.SetToolTip(LogScreenshotsCheckBox, "诊断用途：将识别截图写入本地 logging 文件夹。");
            ZeroMeansAllTooltips.SetToolTip(NumOfCharToScanControl, "0 表示扫描全部角色。");
            ZeroMeansAllTooltips.SetToolTip(SortByObtainedControl, "0 表示扫描全部圣遗物页。");
            inventoryToolStripTextBox.ToolTipText = "点击后按下游戏中的背包快捷键";
            characterToolStripTextBox.ToolTipText = "点击后按下游戏中的角色界面快捷键";
            slot1StripTextBox.ToolTipText = "点击后按下选择第一位角色的快捷键";
            keysToolStripMenuItem.DropDownItems.Add(new ToolStripSeparator());
            chineseVersionMenu = new ToolStripMenuItem("检查扫描器版本", null, (sender, args) => CheckForKameraUpdates());
            keysToolStripMenuItem.DropDownItems.Add(chineseVersionMenu);
            InitializeChineseUpdates();
            float dpi;
            using (var graphics = CreateGraphics()) dpi = graphics.DpiX;
            chineseDpiScale = dpi / 96f;
            if (dpi != 96f) Scale(new SizeF(dpi / 96f, dpi / 96f));
            ResumeLayout(true);
            // Reused designer buttons may carry a pending DPI scale; normalize their final sizes.
            foreach (var button in new[] { StartScan_Button, chineseStopButton, FileSelectButton, button1, ManualExportButton,
                openLogs, chineseDataUpdateButton, chineseVersionUpdateButton, chineseUpdateCancelButton, chineseReloadButton, chineseReleaseButton })
            {
                button.MinimumSize = new Size((int)((button == StartScan_Button ? 116 : 100) * dpi / 96f), (int)(30 * dpi / 96f));
                button.Padding = new Padding((int)(8 * dpi / 96f), (int)(2 * dpi / 96f), (int)(8 * dpi / 96f), (int)(2 * dpi / 96f));
            }
            // Apply the window limits after DPI scaling to avoid scaling them twice.
            MinimumSize = new Size((int)(420 * chineseDpiScale), (int)(300 * chineseDpiScale));
            ClientSizeChanged += (sender, args) => AdaptChineseWindow();
            chineseRightPane.ClientSizeChanged += (sender, args) => LayoutChineseRightPane();
            chineseUpdateCard.SizeChanged += (sender, args) => LayoutChineseRightPane();
            Disposed += (sender, args) => chineseNarrowSettings.Dispose();
            AdaptChineseWindow();
        }

        private void AdaptChineseWindow()
        {
            if (chineseResponsiveLayout || chineseBody == null) return;
            chineseResponsiveLayout = true;
            chineseBody.SuspendLayout();
            try
            {
                var narrow = ClientSize.Width < 760 * chineseDpiScale;
                if (narrow && !chineseTabs.TabPages.Contains(chineseNarrowSettings))
                {
                    chineseNarrowSettings.Controls.Add(chineseSettingsPane);
                    chineseTabs.TabPages.Add(chineseNarrowSettings);
                }
                else if (!narrow && chineseTabs.TabPages.Contains(chineseNarrowSettings))
                {
                    if (chineseTabs.SelectedTab == chineseNarrowSettings) chineseTabs.SelectedIndex = 0;
                    chineseBody.Controls.Add(chineseSettingsPane, 0, 0);
                    chineseTabs.TabPages.Remove(chineseNarrowSettings);
                }
                chineseBody.ColumnStyles[0].Width = narrow ? 0 : 292 * chineseDpiScale;
            }
            finally { chineseBody.ResumeLayout(true); chineseResponsiveLayout = false; }
            LayoutChineseRightPane();
        }

        private void LayoutChineseRightPane()
        {
            if (chineseRightLayout || chineseRightPane == null) return;
            chineseRightLayout = true;
            try
            {
                // Keep tabs reachable when the update card takes most of a short window.
                var height = Math.Max(chineseRightPane.ClientSize.Height,
                    chineseUpdateCard.Height + chineseUpdateCard.Margin.Vertical + (int)(180 * chineseDpiScale));
                if (chineseRightHost.Height != height) chineseRightHost.Height = height;
            }
            finally { chineseRightLayout = false; }
        }

        private void ResetChineseLayoutConstraints(Control parent)
        {
            foreach (Control control in parent.Controls)
            {
                control.MinimumSize = control.MaximumSize = Size.Empty;
                control.Dock = DockStyle.None;
                control.Anchor = AnchorStyles.Top | AnchorStyles.Left;
                control.Font = Font;
                if (control is Label) control.AutoSize = true;
                ResetChineseLayoutConstraints(control);
            }
        }

        private void SetChineseScanningState(bool scanning)
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke((MethodInvoker)(() => SetChineseScanningState(scanning))); return; }
            chineseSettingsPane.Enabled = !scanning;
            StartScan_Button.Enabled = !scanning && !chineseUpdateBusy && !ScannerChinese.PreviewOnly;
            chineseStopButton.Enabled = scanning;
            FileSelectButton.Enabled = OutputPath_TextBox.Enabled = !scanning;
            DatabaseUpdateMenuItem.Enabled = !scanning && !chineseUpdateBusy;
            chineseVersionMenu.Enabled = !scanning && !chineseUpdateBusy;
            chineseDataUpdateButton.Enabled = chineseVersionUpdateButton.Enabled = !scanning && !chineseUpdateBusy;
        }

        private void StopScanFromChineseButton()
        {
            if (scannerThread != null && scannerThread.IsAlive)
            {
                scannerThread.Abort();
                UserInterface.SetProgramStatus("Scan stopped");
                Navigation.Reset();
            }
        }
    }
}
