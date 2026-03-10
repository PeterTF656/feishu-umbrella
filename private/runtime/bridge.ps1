param(
    [Parameter(Position=0)]
    [string]$Command = 'help',

    [Parameter(Position=1)]
    [int]$LogLines = 50
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $PSCommandPath
$umbrellaRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$extensionPackageDir = [System.IO.Path]::Combine($umbrellaRoot, 'private', 'cti-extension')
$extensionEntryPath = [System.IO.Path]::Combine($extensionPackageDir, 'dist', 'index.js')
$configSyncScript = [System.IO.Path]::Combine($umbrellaRoot, 'private', 'runtime', 'sync-cti-config.mjs')
$defaultMenuRouteFile = [System.IO.Path]::Combine($umbrellaRoot, 'private', 'config', 'feishu-menu-routes.local.json')
$skillDaemon = [System.IO.Path]::Combine($umbrellaRoot, 'Claude-to-IM-skill', 'scripts', 'daemon.ps1')

function Resolve-RunnerPath {
    param([string]$Target)

    if ([System.IO.Path]::IsPathRooted($Target)) {
        return $Target
    }

    return [System.IO.Path]::GetFullPath((Join-Path $extensionPackageDir $Target))
}

function Ensure-ExtensionBuilt {
    $needsBuild = -not (Test-Path $extensionEntryPath)

    if (-not $needsBuild) {
        $bundleTime = (Get-Item $extensionEntryPath).LastWriteTimeUtc
        $staleSource = Get-ChildItem -Path (Join-Path $extensionPackageDir 'src') -Filter '*.ts' -Recurse |
            Where-Object { $_.LastWriteTimeUtc -gt $bundleTime } |
            Select-Object -First 1
        $needsBuild = $null -ne $staleSource
    }

    if ($needsBuild) {
        Write-Host 'Building private extension...'
        Push-Location $extensionPackageDir
        npm run build
        Pop-Location
    }
}

if ($Command -eq 'start') {
    Ensure-ExtensionBuilt
    node $configSyncScript
}

if (-not $env:CTI_HOME) {
    $env:CTI_HOME = Join-Path $env:USERPROFILE '.claude-to-im'
}

$env:CTI_PRIVATE_EXTENSION_ENTRY = $extensionEntryPath

if ($env:CTI_PRIVATE_MENU_ROUTE_FILE) {
    $env:CTI_PRIVATE_MENU_ROUTE_FILE = Resolve-RunnerPath $env:CTI_PRIVATE_MENU_ROUTE_FILE
} elseif (Test-Path $defaultMenuRouteFile) {
    $env:CTI_PRIVATE_MENU_ROUTE_FILE = $defaultMenuRouteFile
} else {
    Remove-Item Env:CTI_PRIVATE_MENU_ROUTE_FILE -ErrorAction SilentlyContinue
}

& $skillDaemon $Command $LogLines
