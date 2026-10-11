$ErrorActionPreference = 'Stop'
$saidaIntegracao = Join-Path $PSScriptRoot '..\artifacts\launcher'
New-Item -ItemType Directory -Path $saidaIntegracao -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Instalar.ps1'), (Join-Path $PSScriptRoot 'Remover.ps1') -Destination $saidaIntegracao -Force
Compress-Archive -Path (Join-Path $saidaIntegracao 'Instalar.ps1'), (Join-Path $saidaIntegracao 'Remover.ps1') -DestinationPath (Join-Path $saidaIntegracao 'EstudioTutoriais-Launcher.zip') -Force
$publicoIntegracao = Join-Path $PSScriptRoot '..\apps\frontend\public\integracao'
New-Item -ItemType Directory -Path $publicoIntegracao -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $saidaIntegracao 'EstudioTutoriais-Launcher.zip') -Destination $publicoIntegracao -Force
Write-Host 'Pacote de integração gerado. Ele apenas registra o Recordly já instalado.'
