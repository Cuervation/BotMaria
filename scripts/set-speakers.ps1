$ErrorActionPreference = "Stop"

$deviceName = $env:SPEAKER_DEVICE_NAME
if ([string]::IsNullOrWhiteSpace($deviceName)) {
  $deviceName = "Altavoces"
}

$forceVolume = $env:FORCE_SYSTEM_VOLUME
if ([string]::IsNullOrWhiteSpace($forceVolume)) {
  $forceVolume = "true"
}

$module = Get-Module -ListAvailable -Name AudioDeviceCmdlets | Select-Object -First 1
if (-not $module) {
  Write-Host "El módulo AudioDeviceCmdlets no está instalado."
  Write-Host "Instalalo con:"
  Write-Host "Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser"
  exit 1
}

Import-Module AudioDeviceCmdlets

$allDevices = Get-AudioDevice -List
$playbackDevices = $allDevices | Where-Object {
  ($_.Type -eq "Playback") -or ($_.Type -eq $null)
}

$device = $playbackDevices | Where-Object {
  $_.Name -like "*$deviceName*"
} | Select-Object -First 1

if (-not $device) {
  Write-Host "No encontré dispositivo de audio que contenga: $deviceName"
  Write-Host ""
  Write-Host "Dispositivos disponibles:"
  $allDevices | Select-Object Index, Type, Name | Format-Table -AutoSize | Out-String | Write-Host
  exit 1
}

Set-AudioDevice -Index $device.Index

if ($forceVolume.ToLowerInvariant() -eq "true") {
  Set-AudioDevice -PlaybackMute $false
  Set-AudioDevice -PlaybackVolume 100
  Write-Host "Volumen configurado al 100%"
}

Write-Host "Salida de audio configurada en: $($device.Name)"
exit 0
