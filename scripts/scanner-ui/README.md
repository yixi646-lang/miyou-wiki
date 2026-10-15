# 中文库存扫描器

基于 [Inventory Kamera v1.4.5](https://github.com/taiwenlee/Inventory_Kamera/tree/427b868362e1b01926c0e10d27f67c331307e96f) 修改，固定提交为 427b868362e1b01926c0e10d27f67c331307e96f，中文构建标记为 wiki-zh-ui.5。

本目录保存中文界面、资料更新与完成提示的修改源码，以及 build.ps1 构建脚本；扫描识别及 GOOD 导出保持该固定上游流程。

构建时下载上述提交的源码，准备 .NET Framework 编译器和上游运行依赖，然后向 build.ps1 指定 SourceRoot、CompilerPath、RuntimeRoot 与一个尚不存在的 OutputDirectory。完整运行依赖和识别资料可从项目便携版获取。脚本在临时副本应用补丁，不直接改写上游源码。

上游及修改源码遵循随附 LICENSE.InventoryKamera.txt 中的 MIT 许可。
