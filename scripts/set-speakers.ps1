param(
  [switch]$ListAudioDevices
)

$ErrorActionPreference = 'Stop'

function Write-Log {
  param([string]$Message)
  Write-Host $Message
}

function Write-ErrorAndExit {
  param(
    [string]$Message,
    [int]$ExitCode = 1
  )

  Write-Host $Message
  exit $ExitCode
}

function Get-SpeakerDeviceName {
  $name = $env:SPEAKER_DEVICE_NAME
  if ([string]::IsNullOrWhiteSpace($name)) {
    return 'Altavoces'
  }

  return $name.Trim()
}

function Ensure-AudioDeviceCmdletsInstalled {
  $module = Get-Module -ListAvailable -Name AudioDeviceCmdlets | Select-Object -First 1
  if (-not $module) {
    Write-ErrorAndExit @'
El módulo AudioDeviceCmdlets no está instalado.
Instalalo con:
Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser
'@
  }
}

function Import-AudioDeviceCmdlets {
  Import-Module AudioDeviceCmdlets -ErrorAction Stop
}

function List-AudioDevices {
  $devices = @(Get-AudioDevice -List)
  if ($devices.Count -eq 0) {
    Write-Log 'No se encontraron dispositivos de audio.'
    return
  }

  Write-Log 'Dispositivos de audio disponibles:'
  foreach ($device in $devices) {
    Write-Log ("{0} - {1}" -f $device.Index, $device.Name)
  }
}

function Find-SpeakerDevice {
  param([string]$SearchName)

  $devices = @(Get-AudioDevice -List)
  return $devices | Where-Object {
    $_.Name -and $_.Name.ToString().IndexOf($SearchName, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  } | Select-Object -First 1
}

Ensure-AudioDeviceCmdletsInstalled
Import-AudioDeviceCmdlets

if ($ListAudioDevices) {
  List-AudioDevices
  exit 0
}

$speakerDeviceName = Get-SpeakerDeviceName
Write-Log ("Buscando dispositivo de audio que contenga: {0}" -f $speakerDeviceName)

$device = Find-SpeakerDevice -SearchName $speakerDeviceName

if (-not $device) {
  Write-Log ("No encontré dispositivo de audio que contenga: {0}" -f $speakerDeviceName)
  List-AudioDevices
  exit 1
}

try {
  Set-AudioDevice -Index $device.Index
  Set-AudioDevice -PlaybackMute $false
  Set-AudioDevice -PlaybackVolume 100
  Write-Log ("Salida de audio configurada en: {0}" -f $device.Name)
  Write-Log 'Volumen configurado al 100%'
  exit 0
}
catch {
  Write-ErrorAndExit ("No se pudo configurar el dispositivo de audio: {0}" -f $_.Exception.Message)
}

