@echo off
chcp 65001 >nul
setlocal
set "WIKI_NODE=%~dp0runtime\node.exe"
if not exist "%WIKI_NODE%" set "WIKI_NODE=D:\soft\nodejs\node.exe"
if not exist "%WIKI_NODE%" set "WIKI_NODE=node"
echo 将恢复到上次功能升级前的发布状态，个人收藏、计划和评估账号保留。
echo 请先关闭 Wiki 页面，并等待后台服务退出。
set /p "WIKI_CONFIRM=输入 YES 确认回退："
if /i not "%WIKI_CONFIRM%"=="YES" exit /b 1
"%WIKI_NODE%" --disable-warning=ExperimentalWarning "%~dp0scripts\release-wiki.mjs" rollback --confirm
set "WIKI_RESULT=%errorlevel%"
pause
exit /b %WIKI_RESULT%
