$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

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
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}

[StructLayout(LayoutKind.Sequential)]
public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}
"@

$targetPids = New-Object 'System.Collections.Generic.HashSet[uint32]'
$chromeProcs = Get-Process chrome -ErrorAction SilentlyContinue
foreach ($proc in $chromeProcs) {
  [void]$targetPids.Add([uint32]$proc.Id)
}

if ($targetPids.Count -eq 0) { exit 0 }

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$flags = 0x0001 -bor 0x0004 -bor 0x0040
$found = $false

$callback = [Win32+EnumWindowsProc]{
  param([IntPtr]$hWnd, [IntPtr]$lParam)

  if (-not [Win32]::IsWindowVisible($hWnd)) {
    return $true
  }

  [uint32]$windowPid = 0
  [void][Win32]::GetWindowThreadProcessId($hWnd, [ref]$windowPid)

  if (-not $targetPids.Contains($windowPid)) {
    return $true
  }

  $rect = New-Object RECT
  if (-not [Win32]::GetWindowRect($hWnd, [ref]$rect)) {
    return $true
  }

  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -le 0 -or $height -le 0) {
    return $true
  }

  $x = [Math]::Max($screen.Left, [int](($screen.Left + (($screen.Width - $width) / 2))))
  $y = [Math]::Max($screen.Top, [int](($screen.Top + (($screen.Height - $height) / 2))))

  [void][Win32]::ShowWindowAsync($hWnd, 9)
  [void][Win32]::SetWindowPos($hWnd, [IntPtr]::Zero, $x, $y, $width, $height, $flags)
  $script:found = $true
  return $true
}

[void][Win32]::EnumWindows($callback, [IntPtr]::Zero)
if ($found) { exit 0 }
exit 0
