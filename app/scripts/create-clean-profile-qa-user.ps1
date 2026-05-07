[CmdletBinding()]
param(
  [string]$UserName = "BibleAIQA",
  [string]$PackagePath = "C:\Users\Public\BibleAI-manual-qa-package",
  [string]$OutputPath = "C:\Users\Public\BibleAI-QA-USER.txt",
  [string]$RepoAppPath = ""
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
  $principal = [Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "This script must be run from an elevated PowerShell prompt."
  }
}

function New-RandomPassword {
  $chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#$%&*+-=?"
  $bytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  $password = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
  if ($password -notmatch "[A-Z]") { $password = "A$password" }
  if ($password -notmatch "[a-z]") { $password = "a$password" }
  if ($password -notmatch "[0-9]") { $password = "7$password" }
  if ($password -notmatch "[!#\$%&\*\+\-\=\?]") { $password = "!$password" }
  return $password
}

Assert-Admin

if (-not $RepoAppPath.Trim()) {
  $RepoAppPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
}

if (-not (Test-Path -LiteralPath $PackagePath)) {
  throw "Manual QA package not found: $PackagePath"
}

$existingUser = Get-LocalUser -Name $UserName -ErrorAction SilentlyContinue
$password = New-RandomPassword
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force

if ($existingUser) {
  Set-LocalUser -Name $UserName -Password $securePassword -PasswordNeverExpires $true
  Enable-LocalUser -Name $UserName
} else {
  New-LocalUser `
    -Name $UserName `
    -Password $securePassword `
    -FullName "Bible AI Release QA" `
    -Description "Bible AI release QA" `
    -PasswordNeverExpires
}

$content = @"
Bible AI clean-profile QA user

User name: .\$UserName
Password: $password

QA package:
$PackagePath

Steps:
1. Sign out of the current Windows account.
2. Sign in as .\$UserName with the password above.
3. Open the QA package folder.
4. Install one installer from the installers folder.
5. Complete README.md.
6. Run:
   powershell -ExecutionPolicy Bypass -File .\RUN-MANUAL-QA.ps1 -Operator "Release QA" -MarkChecklistPassed
7. Copy manual-release-gates.json back to:
   $RepoAppPath\release\manual-release-gates.json

Cleanup after QA:
Open an elevated PowerShell in the original account and run:
Remove-LocalUser -Name $UserName

Do not paste provider keys or credential values into this file or into manual-release-gates.json.
"@

$directory = Split-Path -Parent $OutputPath
if ($directory) {
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
}
Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8

Write-Host "Prepared clean-profile QA user: .\$UserName"
Write-Host "Login details written to: $OutputPath"
