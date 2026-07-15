$ErrorActionPreference = 'Stop'

$appRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $appRoot 'src-tauri\target\release'
$outputRoot = Join-Path $appRoot 'release'
$outputPath = Join-Path $outputRoot 'windows-signing.json'
$installers = @(
  Get-ChildItem -LiteralPath (Join-Path $releaseRoot 'bundle\nsis') -File -Filter '*.exe'
  Get-ChildItem -LiteralPath (Join-Path $releaseRoot 'bundle\msi') -File -Filter '*.msi'
)

if ($installers.Count -ne 2) {
  throw "Expected exactly one NSIS and one MSI installer; found $($installers.Count)."
}

$records = foreach ($installer in $installers) {
  $signature = Get-AuthenticodeSignature -LiteralPath $installer.FullName
  [ordered]@{
    name = $installer.Name
    status = $signature.Status.ToString()
    signer_subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
  }
}

New-Item -ItemType Directory -Force $outputRoot | Out-Null
[ordered]@{
  format_version = 1
  artifacts = @($records)
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $outputPath -Encoding utf8

Write-Output "Windows signing status written: $outputPath"
