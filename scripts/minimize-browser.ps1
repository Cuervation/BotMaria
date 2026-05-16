$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@

for ($attempt = 1; $attempt -le 20; $attempt++) {
  $procs = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }

  if ($procs) {
    foreach ($proc in $procs) {
      [Win32]::ShowWindowAsync($proc.MainWindowHandle, 2) | Out-Null
    }
    exit 0
  }

  Start-Sleep -Milliseconds 500
}

exit 0
