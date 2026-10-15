@echo off
setlocal
chcp 65001 >nul
start "" "%SystemRoot%\System32\wscript.exe" "%~dp0启动百科.vbs"
exit /b
