param(
  [switch]$SkipDb,
  [switch]$SkipFunctions,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Write-Step($message) {
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Read-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw ".env introuvable: $Path"
  }

  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1)
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

function Get-ProjectRef($envMap) {
  if ($envMap.ContainsKey('SUPABASE_PROJECT_REF') -and $envMap['SUPABASE_PROJECT_REF']) {
    return $envMap['SUPABASE_PROJECT_REF']
  }

  $urlCandidates = @(
    $envMap['SUPABASE_URL'],
    $envMap['VITE_SUPABASE_URL'],
    $envMap['NEXT_PUBLIC_SUPABASE_URL']
  ) | Where-Object { $_ }

  foreach ($url in $urlCandidates) {
    try {
      $u = [Uri]$url
      if ($u.Host -match '^([^.]+)\.supabase\.co$') {
        return $Matches[1]
      }
    } catch {
      continue
    }
  }

  return $null
}

function Get-RedactedCommandDisplay([string[]]$CmdArgs) {
  $safe = @()
  for ($i = 0; $i -lt $CmdArgs.Count; $i++) {
    $arg = $CmdArgs[$i]

    if ($arg -eq '--db-url' -and ($i + 1) -lt $CmdArgs.Count) {
      $safe += '--db-url'
      $safe += '<redacted-db-url>'
      $i++
      continue
    }

    if ($arg -match '^(RESEND_API_KEY|RESEND_WEBHOOK_SECRET|STRIPE_SECRET_KEY|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD)=') {
      $key = $arg.Split('=')[0]
      $safe += "$key=<redacted>"
      continue
    }

    $safe += $arg
  }

  return "npx " + ($safe -join ' ')
}

function Invoke-Checked([string[]]$CmdArgs) {
  $cmdDisplay = Get-RedactedCommandDisplay $CmdArgs
  Write-Host "   $cmdDisplay" -ForegroundColor DarkGray
  if ($DryRun) { return }
  & npx @CmdArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Commande échouée: $cmdDisplay"
  }
}

function Test-RemoteDbUrl([string]$dbUrl) {
  if (-not $dbUrl) { return $false }
  try {
    $u = [Uri]$dbUrl
    if (-not $u.Host) { return $false }
    if ($u.Host -in @('postgres', 'db', 'localhost', '127.0.0.1')) { return $false }
    return $true
  } catch {
    return $false
  }
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Step "Lecture du .env"
$envMap = Read-DotEnv (Join-Path $root '.env')
$projectRef = Get-ProjectRef $envMap

if (-not $projectRef) {
  throw "Impossible de déterminer le project ref (SUPABASE_PROJECT_REF / SUPABASE_URL / VITE_SUPABASE_URL)."
}

Write-Host "   Project ref: $projectRef"

$supabaseAccessToken = $envMap['SUPABASE_ACCESS_TOKEN']
$databaseUrl = $envMap['DATABASE_URL']
$supabaseDbPassword = $envMap['SUPABASE_DB_PASSWORD']
$resendApiKey = $envMap['RESEND_API_KEY']
$resendWebhookSecret = $envMap['RESEND_WEBHOOK_SECRET']
$resendFromEmail = $envMap['RESEND_FROM_EMAIL']
$stripeSecretKey = $envMap['STRIPE_SECRET_KEY']

if (-not $SkipDb) {
  Write-Step "Déploiement des migrations DB"
  if (Test-RemoteDbUrl $databaseUrl) {
    Invoke-Checked @('supabase', 'db', 'push', '--db-url', $databaseUrl, '--include-all', '--workdir', '.')
  } elseif ($supabaseAccessToken -and $supabaseDbPassword) {
    $env:SUPABASE_ACCESS_TOKEN = $supabaseAccessToken
    Invoke-Checked @('supabase', 'link', '--project-ref', $projectRef, '-p', $supabaseDbPassword, '--workdir', '.', '--yes')
    Invoke-Checked @('supabase', 'db', 'push', '--linked', '-p', $supabaseDbPassword, '--include-all', '--workdir', '.')
  } else {
    Write-Warning "Migrations DB non poussées: DATABASE_URL semble locale/interne, et SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD manquent."
  }
}

if (-not $SkipFunctions) {
  Write-Step "Déploiement des secrets et Edge Functions"

  if (-not $supabaseAccessToken) {
    Write-Warning "Functions non déployées: SUPABASE_ACCESS_TOKEN absent dans .env."
  } else {
    if (-not $resendApiKey) { throw "RESEND_API_KEY manquant dans .env." }
    if (-not $resendWebhookSecret) { throw "RESEND_WEBHOOK_SECRET manquant dans .env." }

    $env:SUPABASE_ACCESS_TOKEN = $supabaseAccessToken

    $secretArgs = @(
      'supabase', 'secrets', 'set',
      '--project-ref', $projectRef,
      "RESEND_API_KEY=$resendApiKey",
      "RESEND_WEBHOOK_SECRET=$resendWebhookSecret"
    )
    if ($resendFromEmail) {
      $secretArgs += "RESEND_FROM_EMAIL=$resendFromEmail"
    } else {
      Write-Warning "RESEND_FROM_EMAIL absent: la function send-email utilisera le fallback onboarding@resend.dev."
    }
    if ($stripeSecretKey) {
      $secretArgs += "STRIPE_SECRET_KEY=$stripeSecretKey"
    } else {
      Write-Warning "STRIPE_SECRET_KEY absent: la function create-stripe-checkout-session ne sera pas deployee."
    }
    Invoke-Checked $secretArgs

    # send-email: JWT vérifié (appelée depuis l'app)
    Invoke-Checked @('supabase', 'functions', 'deploy', 'send-email', '--project-ref', $projectRef, '--use-api', '--workdir', '.')

    # resend-webhook: Resend appelle sans JWT Supabase
    Invoke-Checked @('supabase', 'functions', 'deploy', 'resend-webhook', '--project-ref', $projectRef, '--no-verify-jwt', '--use-api', '--workdir', '.')

    if ($stripeSecretKey) {
      # create-stripe-checkout-session: appelee depuis l'app (JWT verifie)
      Invoke-Checked @('supabase', 'functions', 'deploy', 'create-stripe-checkout-session', '--project-ref', $projectRef, '--use-api', '--workdir', '.')

      # manage-reservation-deposit-strategy-b: sync checkout + rotation/capture/release cautions
      Invoke-Checked @('supabase', 'functions', 'deploy', 'manage-reservation-deposit-strategy-b', '--project-ref', $projectRef, '--use-api', '--workdir', '.')
    }

    Write-Host ""
    Write-Host "Webhook Resend à configurer:" -ForegroundColor Green
    Write-Host "https://$projectRef.supabase.co/functions/v1/resend-webhook" -ForegroundColor Green
  }
}

Write-Step "Terminé"
