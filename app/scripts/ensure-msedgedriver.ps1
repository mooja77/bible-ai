[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($env:OS -ne "Windows_NT") {
    throw "Microsoft EdgeDriver setup is supported only on Windows."
}

$appRoot = Split-Path -Parent $PSScriptRoot
$driverDirectory = Join-Path $appRoot ".drivers"
$driverPath = Join-Path $driverDirectory "msedgedriver.exe"
$edgeCandidates = @(
    @(
        ${env:ProgramFiles(x86)},
        $env:ProgramFiles,
        $env:LOCALAPPDATA
    ) |
        Where-Object { $_ } |
        ForEach-Object { Join-Path $_ "Microsoft\Edge\Application\msedge.exe" } |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf }
)

if ($edgeCandidates.Count -eq 0) {
    throw "Microsoft Edge is not installed in a supported location."
}

$edgePath = $edgeCandidates[0]
$edgeVersion = (Get-Item -LiteralPath $edgePath).VersionInfo.ProductVersion
if (-not $edgeVersion -or $edgeVersion -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    throw "Could not determine an exact four-part Microsoft Edge version from $edgePath."
}

function Test-MicrosoftSignedDriver {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedVersion
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }

    $actualVersion = (Get-Item -LiteralPath $Path).VersionInfo.ProductVersion
    if ($actualVersion -ne $ExpectedVersion) {
        return $false
    }

    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    return (
        $signature.Status -eq [System.Management.Automation.SignatureStatus]::Valid -and
        $null -ne $signature.SignerCertificate -and
        $signature.SignerCertificate.Subject -match 'Microsoft Corporation'
    )
}

if (Test-MicrosoftSignedDriver -Path $driverPath -ExpectedVersion $edgeVersion) {
    Write-Host "Using verified Microsoft EdgeDriver $edgeVersion at $driverPath"
    exit 0
}

New-Item -ItemType Directory -Path $driverDirectory -Force | Out-Null
$temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\')
$temporaryDirectory = Join-Path $temporaryRoot ("bible-ai-edgedriver-" + [guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $temporaryDirectory "edgedriver_win64.zip"
$extractPath = Join-Path $temporaryDirectory "extracted"

try {
    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    $downloadUrl = "https://msedgedriver.microsoft.com/$edgeVersion/edgedriver_win64.zip"
    Write-Host "Downloading Microsoft EdgeDriver $edgeVersion from the official Microsoft endpoint..."
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing

    if ((Get-Item -LiteralPath $zipPath).Length -le 0) {
        throw "Downloaded EdgeDriver archive is empty."
    }

    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath
    $downloadedDriver = Join-Path $extractPath "msedgedriver.exe"
    if (-not (Test-MicrosoftSignedDriver -Path $downloadedDriver -ExpectedVersion $edgeVersion)) {
        throw "Downloaded EdgeDriver failed the exact-version or Microsoft Authenticode signature check."
    }

    Move-Item -LiteralPath $downloadedDriver -Destination $driverPath -Force
    if (-not (Test-MicrosoftSignedDriver -Path $driverPath -ExpectedVersion $edgeVersion)) {
        throw "Installed EdgeDriver failed post-install verification."
    }
    Write-Host "Installed verified Microsoft EdgeDriver $edgeVersion at $driverPath"
}
finally {
    $resolvedTemporary = [System.IO.Path]::GetFullPath($temporaryDirectory)
    $temporaryParent = Split-Path -Parent $resolvedTemporary
    $temporaryName = Split-Path -Leaf $resolvedTemporary
    if (
        $temporaryParent -eq $temporaryRoot -and
        $temporaryName.StartsWith("bible-ai-edgedriver-", [System.StringComparison]::Ordinal) -and
        (Test-Path -LiteralPath $resolvedTemporary)
    ) {
        Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force
    }
}
