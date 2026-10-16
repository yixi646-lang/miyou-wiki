# 米游离线百科

原神、崩坏：星穹铁道、绝区零的本地资料百科，集成原神角色养成评价、配队伤害计算和圣遗物配装工具。资料、图片与个人数据保存在本机，日常查阅和计算可离线使用。

**[下载最新版本](https://github.com/yixi646-lang/miyou-wiki/releases/latest)** · **[使用说明](Wiki使用说明.txt)** · **[问题反馈与建议](https://github.com/yixi646-lang/miyou-wiki/issues)**

## 主要功能

- **三游戏资料查阅**：角色、武器、套装、技能、养成材料及获取详情，支持搜索、筛选和收藏。
- **历史卡池与版本档案**：查看已收录的卡池记录、UP 统计和重大版本变化，按版本范围整理回坑补课内容。
- **本地立绘展示**：查看角色主立绘、扩展形态和已收录皮肤，可按名称、稀有度及元素／属性筛选。
- **原神养成与配装**：角色词条评价、队伍面板与伤害试算、圣遗物配装搜索、理论词条分配，以及继续强化、重塑和祝圣定义潜力分析。
- **软件与资料更新**：Wiki 内分别检查软件和游戏资料，有更新时提醒，确认后下载、安装并重启；也可手动下载或稍后提醒。资料更新不改变软件版本。
- **账号与装备管理**：GOOD 文件预览导入、多账号切换、武器与圣遗物库存、配装方案及压缩备份。便携版附带中文库存扫描器。

## 下载与启动

便携版适用于 **Windows x64**，附带 Node.js 运行时，无须另外安装 Node.js、Git 或开发依赖。

1. 打开 [Releases](https://github.com/yixi646-lang/miyou-wiki/releases/latest)，首次使用下载名称含 `Windows-x64` 的完整包。
2. 将压缩包解压到独立文件夹，进入其中的 `Wiki` 目录。
3. 双击 **启动百科.vbs**，浏览器会打开本地 Wiki；`启动百科.cmd` 为兼容入口。

关闭这份 Wiki 的全部页面约 15 秒后，后台服务自动退出。每份目录独立保存资料，可整目录移动。

当前版本为 **1.2.2**。后续可从顶栏“更新”选择“软件更新”或“游戏资料”；检查只提醒，下载和安装需要确认，可关闭启动检查。首次提供完整便携包；后续有适用累计更新包时，可在 Wiki 内更新。联网失败也能前往 GitHub 手动下载。详细步骤见 [使用说明](Wiki使用说明.txt)。

GitHub 自动生成的 `Source code` 下载项是源码包，不包含便携版运行时和扫描器程序。

## 从源码运行

需要 **Node.js 24 或更高版本**。仓库包含本地素材、公开初始化资料和已构建的计算核心，日常运行无须安装第三方 Node.js 依赖。

```powershell
git clone https://github.com/yixi646-lang/miyou-wiki.git
cd miyou-wiki
npm start
```

如需手动管理服务，可运行 `npm run serve`，结束时按 Ctrl+C。浏览器以启动输出的本机地址为准。

主要目录：

| 目录 | 内容 |
| --- | --- |
| `public/`、`shared/`、`lib/` | 界面、共用逻辑和本地服务 |
| `modules/character-assessment/` | 原神养成、伤害计算与配装工具 |
| `assets/` | 本地图片与图标 |
| `data/catalog/`、`data/growth/` | 公开初始化资料及养成数据 |
| `data/versions/`、`data/sources/` | 版本档案与来源快照 |
| `scripts/`、`tests/` | 构建维护脚本与测试 |

计算核心的固定版本与重建方法见 [模块说明](modules/character-assessment/README.md)。中文扫描器的修改源码和构建入口位于 [scripts/scanner-ui](scripts/scanner-ui/README.md)，程序与识别资源随便携版提供。

## 数据与计算范围

百科资料保留固定来源快照；启动时只检查维护者发布的新资料，不静默下载或安装。维护者整理后单独发布内容包，用户确认后更新；不自动抓取未经核查的新游戏资料。已收录最高游戏版本、百科内容覆盖及计算核心支持范围分别记录，以界面资料核查与模块说明为准，不代表对应版本的全部内容均已收齐。

原神计算基于固定提交的 Genshin Optimizer 开发版源码。固定动作合计不等同于完整循环 DPS；有限候选的配装搜索不保证全库存最优；强化潜力中的概率和未知初始档位推导属于估计。计算前可调整目标、队伍条件和参与范围。

个人账号、装备、收藏与备份仅保存在运行目录，不会自动上传到 GitHub。仓库和便携版不包含维护者的个人账号、库存、扫描文件及历史备份；反馈时请勿附带未经处理的个人备份。

## 资料维护与发布

整理公共条目和素材后，运行 `node --disable-warning=ExperimentalWarning scripts/content-release.mjs --upload`，生成并上传独立资料包。资料使用 `D` 加UTC时间记录批次，不增加软件版本号；批次之间可以跳过更新。发布范围及手动上传方法见 [版本更新管理指南](docs/版本更新管理指南.md)。

## 反馈

欢迎通过 [Issues](https://github.com/yixi646-lang/miyou-wiki/issues) 提交问题或建议。描述使用版本、操作步骤、预期结果与实际现象即可；涉及计算时补充角色、装备及相关条件，便于复现。

## 来源与第三方许可

本项目为非官方本地工具，与游戏官方无隶属关系。游戏文字、图片和标志的权利归各自权利人所有，资料来源及原始快照在项目中保留。

- [Genshin Optimizer](https://github.com/frzyc/genshin-optimizer)：计算源码使用 MIT 许可，固定提交及其他依赖许可见 [第三方说明](modules/character-assessment/vendor/THIRD_PARTY.md)。
- [Inventory Kamera](https://github.com/taiwenlee/Inventory_Kamera)：中文扫描器基于固定上游源码修改，保留 MIT 许可。
- 便携版中的 Node.js 运行时随附原始许可文件。

各第三方组件按各自许可使用；游戏素材不因第三方代码许可而改变权利归属。
