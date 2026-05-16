$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class Win32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@

$targetPids = New-Object 'System.Collections.Generic.HashSet[uint32]'

for ($attempt = 1; $attempt -le 40; $attempt++) {
  $chromeProcs = Get-Process chrome -ErrorAction SilentlyContinue

  foreach ($proc in $chromeProcs) {
    [void]$targetPids.Add([uint32]$proc.Id)
  }

  if ($targetPids.Count -gt 0) {
    $script:found = $false

    $callback = [Win32+EnumWindowsProc]{
      param([IntPtr]$hWnd, [IntPtr]$lParam)

      if (-not [Win32]::IsWindowVisible($hWnd)) {
        return $true
      }

      [uint32]$windowPid = 0
      [void][Win32]::GetWindowThreadProcessId($hWnd, [ref]$windowPid)

      if ($targetPids.Contains($windowPid)) {
        [void][Win32]::ShowWindowAsync($hWnd, 2)
        $script:found = $true
      }

      return $true
    }

    [void][Win32]::EnumWindows($callback, [IntPtr]::Zero)

    if ($script:found) {
      exit 0
    }
  }

  Start-Sleep -Milliseconds 500
}

exit 0
