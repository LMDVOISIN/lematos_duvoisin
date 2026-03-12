$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot 'logs'
$logPath = Join-Path $logDir 'seo-refresh-queue.log'

if (-not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

$npmCandidates = @(@(
  (Join-Path ${env:ProgramFiles} 'nodejs\npm.cmd'),
  (Join-Path ${env:ProgramFiles(x86)} 'nodejs\npm.cmd')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

if ($npmCandidates.Count -eq 0) {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npmCommand) {
    $npmCandidates = @($npmCommand.Source)
  }
}

if ($npmCandidates.Count -eq 0) {
  throw 'npm.cmd introuvable. Verifiez l installation de Node.js sur cette machine.'
}

$npmPath = $npmCandidates[0]

function Write-LogLine {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$timestamp] $Message"

  for ($attempt = 1; $attempt -le 10; $attempt++) {
    try {
      $line | Out-File -LiteralPath $logPath -Append -Encoding utf8
      return
    }
    catch {
      if ($attempt -eq 10) {
        throw
      }

      Start-Sleep -Milliseconds 250
    }
  }
}

Push-Location -LiteralPath $projectRoot

$exitCode = 1

try {
  Write-LogLine "START seo refresh queue"
  & $npmPath run deploy:server:seo-refresh:if-pending 2>&1 | Out-File -LiteralPath $logPath -Append -Encoding utf8
  $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }
  Write-LogLine "EXIT $exitCode"
}
catch {
  Write-LogLine "ERROR $($_.Exception.Message)"
  throw
}
finally {
  Pop-Location
}

exit $exitCode
