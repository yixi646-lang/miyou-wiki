@echo off
setlocal
start "" "%SystemRoot%\System32\wscript.exe" "%~dp0installer\launch.vbs" %*
exit /b
