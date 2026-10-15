using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace InventoryKamera
{
    internal static class ScannerChinese
    {
        internal static bool PreviewOnly => Environment.GetCommandLineArgs().Contains("--ui-preview");
        internal static void ConfigureNetworking()
        {
            AppContext.SetSwitch("Switch.System.Net.DontEnableSchUseStrongCrypto", false);
            AppContext.SetSwitch("Switch.System.Net.DontEnableSystemDefaultTlsVersions", false);
        }
        internal static string SettingsDirectory
        {
            get
            {
                var isolated = Environment.GetEnvironmentVariable("WIKI_SCANNER_SETTINGS_DIR");
                return string.IsNullOrWhiteSpace(isolated)
                    ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), Path.GetFileNameWithoutExtension(Application.ExecutablePath))
                    : Path.GetFullPath(isolated);
            }
        }

        private static readonly Dictionary<string, string> Texts = new Dictionary<string, string>
        {
            {"Scan Genshin", "开始扫描"}, {"Press 'ENTER' to cancel", "扫描中按 Enter 可立即停止"},
            {"Weapon/Artifact:", "武器 / 圣遗物"}, {"Character:", "角色"}, {"Output", "识别信息"},
            {"Weapons: ", "武器"}, {"Artifacts: ", "圣遗物"}, {"Characters: ", "角色"},
            {"Scanning Status", "准备就绪"}, {"Github Mainpage", "项目主页"}, {"Latest_Releases", "原版下载"},
            {"Error Log:  ( scroll/click me)", "运行日志"}, {"Got Errors? Report Here:", "问题反馈"},
            {"Issue Page", "反馈页面"}, {"Navigation:", "当前游戏画面"}, {"Select", "选择文件夹"},
            {"Scanner Delay", "扫描速度"}, {"Scan Items", "扫描范围"}, {"Fast", "快速"},
            {"Slower", "适中"}, {"Slow", "慢速"}, {"File Location:", "导出文件夹"}, {"Language:", "游戏语言"},
            {"File", "文件"}, {"Quit", "退出"}, {"Options", "设置"}, {"Inventory Key", "背包快捷键"},
            {"Character Screen Key", "角色界面快捷键"}, {"Character Slot 1 Key", "第一位角色快捷键"},
            {"Update Lookup Tables", "更新游戏识别资料"}, {"Open Export Folder", "打开导出文件夹"},
            {"Update Executables", "选择游戏进程"}, {"Minimum Weapon Rarity", "最低武器星级"},
            {"Minimum Artifact Rarity", "最低圣遗物星级"}, {"Minimum Weapon Level", "最低武器等级"},
            {"Minimum Artifact Level", "最低圣遗物等级"}, {"Open Genshin Optimizer", "复制并打开 GO"},
            {"Traveler's Name:", "旅行者英文名"}, {"Wanderer's Name:", "流浪者英文名"},
            {"Equip Weapons", "保留武器装备关系"}, {"Equip Artifacts", "保留圣遗物装备关系"},
            {"Log All Screenshots", "保存全部识别截图"}, {"Num of Artifact Page to Scan", "圣遗物扫描页数"},
            {"Number of Character To Scan", "角色扫描数量"}, {"Materials", "材料"},
            {"Char Development Items", "角色培养材料"}, {"Characters", "角色"}, {"Artifacts", "圣遗物"},
            {"Weapons", "武器"}, {"Manequin's (f) Name:", "可改名角色（女）"},
            {"Manequin's (m) Name:", "可改名角色（男）"}, {"Add Selected", "添加所选进程"},
            {"Remove Selected", "移除所选进程"}, {"Done", "完成"}, {"Available Processes", "正在运行的进程"},
            {"Genshin Executables", "允许识别的游戏进程"}, {"Executable Chooser", "选择游戏进程"}
        };

        internal static void TranslateControls(Control parent)
        {
            if (!(parent is TextBoxBase) && !(parent is NumericUpDown) && Texts.TryGetValue(parent.Text, out var text)) parent.Text = text;
            foreach (Control control in parent.Controls) TranslateControls(control);
            if (parent is ToolStrip strip) foreach (ToolStripItem item in strip.Items) TranslateMenu(item);
        }

        private static void TranslateMenu(ToolStripItem item)
        {
            if (Texts.TryGetValue(item.Text, out var text)) item.Text = text;
            if (item is ToolStripDropDownItem dropdown) foreach (ToolStripItem child in dropdown.DropDownItems) TranslateMenu(child);
        }

        internal static string Status(string status)
        {
            switch (status.ToLowerInvariant())
            {
                case "scanning": return "正在扫描";
                case "finished": return "扫描完成 · 已导出";
                case "scan stopped": return "扫描已停止";
                case "scan aborted": return "扫描中断 · 请查看运行日志";
                default: return status;
            }
        }

        internal static string Readout(string text)
        {
            var prefixes = new Dictionary<string, string>
            {
                {"Traveler name:", "旅行者名称："}, {"Name:", "名称："}, {"Element:", "元素："},
                {"Level:", "等级："}, {"Constellation:", "命之座："}, {"Count:", "数量："},
                {"Mora:", "摩拉："}, {"Weapon:", "武器："}, {"Artifact:", "圣遗物："},
                {"Set:", "套装："}, {"Slot:", "部位："}, {"Rarity:", "星级："}, {"Equipped:", "装备于："},
                {"Locked:", "锁定："}, {"Main Stat:", "主词条："}, {"Sub Stats:", "副词条："}
            };
            foreach (var pair in prefixes) text = Regex.Replace(text, "(?m)^" + Regex.Escape(pair.Key), pair.Value);
            return Regex.Replace(text, @"(?m)^Talent (\d+):", "天赋 $1：");
        }

        internal static string ExplainError(string error)
        {
            string explanation = null;
            if (error.Contains("Cannot find Genshin Impact process")) explanation = "未找到原神进程。请先进入游戏，或在“设置 → 选择游戏进程”中检查进程名称。";
            else if (error.Contains("could not be focused")) explanation = "无法切换到游戏窗口。请确认游戏窗口可见，且没有其他窗口遮挡。";
            else if (error.Contains("unsupported resolution")) explanation = "当前游戏分辨率不受支持，请使用 16:9 或 16:10 的游戏窗口。";
            else if (error.Contains("Window size and screenshot size mismatch")) explanation = "游戏窗口与截图尺寸不一致。请尝试窗口模式，并检查 Windows 显示设置。";
            else if (error.Contains("Data file") || error.Contains("characters.json")) explanation = "游戏识别资料缺失或异常。请在“设置 → 更新游戏识别资料”中更新后重试。";
            return explanation == null ? error : explanation + Environment.NewLine + "原始信息：" + Environment.NewLine + error;
        }
    }
}
