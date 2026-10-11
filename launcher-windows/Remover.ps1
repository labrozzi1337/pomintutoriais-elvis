$ErrorActionPreference = 'Stop'
$chaveLauncher = 'HKCU:\Software\Classes\estudiotutoriais'
$destinoLauncher = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'EstudioTutoriaisLauncher'))
$baseLauncher = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\') + '\'
if (!$destinoLauncher.StartsWith($baseLauncher, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($destinoLauncher) -ne 'EstudioTutoriaisLauncher') { throw 'Destino inválido.' }
if (Test-Path -LiteralPath $chaveLauncher) { Remove-Item -LiteralPath $chaveLauncher -Recurse }
foreach ($arquivoLauncher in @('Launcher.exe', 'dispositivo.bin')) {
  $alvoLauncher = Join-Path $destinoLauncher $arquivoLauncher
  if (Test-Path -LiteralPath $alvoLauncher) { Remove-Item -LiteralPath $alvoLauncher }
}
Write-Host 'Integração Windows removida. O Recordly e os projetos foram preservados.'
