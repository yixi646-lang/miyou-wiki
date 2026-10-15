Option Explicit
Dim fs, shell, root, node, item, candidate, command, code
Set fs = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fs.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
node = fs.BuildPath(root, "runtime\node.exe")
If Not fs.FileExists(node) Then
  node = ""
  For Each item In Split(shell.ExpandEnvironmentStrings("%PATH%"), ";")
    If Len(item) > 0 Then
      candidate = fs.BuildPath(Replace(item, Chr(34), ""), "node.exe")
      If fs.FileExists(candidate) Then
        node = candidate
        Exit For
      End If
    End If
  Next
End If
If node = "" Then
  MsgBox "Node.js 24 or later is required to run Wiki.", 16, "Wiki"
  WScript.Quit 1
End If
command = Chr(34) & node & Chr(34) & " --disable-warning=ExperimentalWarning " & Chr(34) & fs.BuildPath(root, "scripts\desktop-launch.mjs") & Chr(34)
If WScript.Arguments.Count > 0 Then
  If WScript.Arguments(0) = "--no-open" Then command = command & " --no-open"
End If
code = shell.Run(command, 0, True)
If code <> 0 Then MsgBox "Wiki failed to start. See data\logs\startup.log for details.", 16, "Wiki"
WScript.Quit code
