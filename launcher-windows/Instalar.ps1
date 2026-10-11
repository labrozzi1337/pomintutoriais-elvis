$ErrorActionPreference = 'Stop'
$candidatosRecordly = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Recordly\Recordly.exe'),
  (Join-Path $env:ProgramFiles 'Recordly\Recordly.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Recordly\Recordly.exe')
)
$executavelRecordly = $candidatosRecordly | Where-Object {
  if (!(Test-Path -LiteralPath $_)) { return $false }
  $pasta = Split-Path -Parent $_
  (Get-Item -LiteralPath $pasta).Attributes -notmatch 'ReparsePoint' -and
    (Get-Item -LiteralPath $_).Attributes -notmatch 'ReparsePoint' -and
    [Diagnostics.FileVersionInfo]::GetVersionInfo($_).ProductName -eq 'Recordly'
} | Select-Object -First 1
if (!$executavelRecordly) { throw 'Recordly não encontrado. Instale-o pelo download oficial e execute este arquivo novamente.' }

$chaveIntegracao = 'HKCU:\Software\Classes\estudiotutoriais'
New-Item -Path $chaveIntegracao -Force | Out-Null
Set-Item -LiteralPath $chaveIntegracao -Value 'URL:Abrir Recordly'
New-ItemProperty -LiteralPath $chaveIntegracao -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-Item -Path "$chaveIntegracao\shell\open\command" -Force | Out-Null
Set-Item -LiteralPath "$chaveIntegracao\shell\open\command" -Value ('"' + $executavelRecordly + '"')
Write-Host 'Integração instalada. Volte ao portal e clique em Abrir Recordly.'
