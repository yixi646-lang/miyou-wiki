Option Explicit
Dim fs, shell, script, command, code
Set fs = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
script = fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName), "wizard.ps1")
command = "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & script & Chr(34)
If WScript.Arguments.Count > 0 Then command = command & " -Target " & Chr(34) & WScript.Arguments(0) & Chr(34)
code = shell.Run(command, 0, True)
If code <> 0 Then MsgBox "The update wizard could not start. Extract the whole ZIP and try again.", 16, "Wiki update"
WScript.Quit code
