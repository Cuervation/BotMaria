$ErrorActionPreference = "Stop"

$module = Get-Module -ListAvailable -Name AudioDeviceCmdlets | Select-Object -First 1
if (-not $module) {
  Write-Host "El módulo AudioDeviceCmdlets no está instalado."
  Write-Host "Instalalo con:"
  Write-Host "Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser"
  exit 1
}

Import-Module AudioDeviceCmdlets

Write-Host "Dispositivos de audio disponibles:"
Get-AudioDevice -List | Select-Object Index, Type, Name | Format-Table -AutoSize
