param(
  [string]$SecretsFile = "secrets.production.json",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$workerRoot = $PSScriptRoot
$wranglerConfigPath = Join-Path $workerRoot "wrangler.toml"
$wranglerExamplePath = Join-Path $workerRoot "wrangler.toml.example"
$secretsPath = Join-Path $repoRoot $SecretsFile
$frontendSourceRoot = Join-Path $repoRoot "frontend\vanilla"
$frontendDistRoot = Join-Path $repoRoot "dist\frontend"

Push-Location $repoRoot

try {
function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Description,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Description"
  & $Command

  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

function Get-RequiredSecrets {
  $config = Get-Content $wranglerConfigPath -Raw
  $match = [regex]::Match($config, '(?ms)^\[secrets\]\s*required\s*=\s*\[(.*?)\]')

  if (-not $match.Success) {
    return @()
  }

  return [regex]::Matches($match.Groups[1].Value, '"([^"]+)"') |
    ForEach-Object { $_.Groups[1].Value }
}

function Get-ConfiguredSecrets {
  $json = pnpm exec wrangler secret list --format json

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read configured Worker secrets."
  }

  if ([string]::IsNullOrWhiteSpace($json)) {
    return @()
  }

  return ($json | ConvertFrom-Json) | ForEach-Object { $_.name }
}

function Get-WranglerIdentity {
  $json = pnpm exec wrangler whoami --json

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read Cloudflare identity."
  }

  return $json | ConvertFrom-Json
}

function Get-D1Config {
  $config = Get-Content $wranglerConfigPath -Raw
  $blockMatch = [regex]::Match(
    $config,
    '(?ms)^\[\[d1_databases\]\](.*?)(?=^\[\[|^\[|\z)'
  )

  if (-not $blockMatch.Success) {
    throw "worker/wrangler.toml does not contain a [[d1_databases]] block."
  }

  $block = $blockMatch.Groups[1].Value
  $bindingMatch = [regex]::Match($block, '(?m)^\s*binding\s*=\s*"([^"]+)"')
  $nameMatch = [regex]::Match($block, '(?m)^\s*database_name\s*=\s*"([^"]+)"')
  $idMatch = [regex]::Match($block, '(?m)^\s*database_id\s*=\s*"([^"]+)"')

  if (-not $bindingMatch.Success -or -not $nameMatch.Success -or -not $idMatch.Success) {
    throw "The D1 config must include binding, database_name, and database_id."
  }

  return [pscustomobject]@{
    Binding = $bindingMatch.Groups[1].Value
    Name = $nameMatch.Groups[1].Value
    Id = $idMatch.Groups[1].Value
  }
}

function Get-D1DatabaseByName {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $json = pnpm exec wrangler d1 list --json

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to list D1 databases."
  }

  return @($json | ConvertFrom-Json) |
    Where-Object { $_.name -eq $Name } |
    Select-Object -First 1
}

function Set-D1DatabaseId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseId
  )

  $config = Get-Content $wranglerConfigPath -Raw
  $updated = [regex]::Replace(
    $config,
    '(?m)^(\s*database_id\s*=\s*")[^"]+(")',
    ('$1' + $DatabaseId + '$2'),
    1
  )

  if ($updated -eq $config) {
    throw "Failed to update database_id in worker/wrangler.toml."
  }

  Set-Content $wranglerConfigPath $updated -NoNewline
}

function Get-SecretValueFromFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  $content = Get-Content $Path -Raw | ConvertFrom-Json
  return $content.$Name
}

function Get-LocalSecrets {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return @{}
  }

  $content = Get-Content $Path -Raw | ConvertFrom-Json
  $secrets = @{}

  foreach ($property in $content.PSObject.Properties) {
    $secrets[$property.Name] = $property.Value
  }

  return $secrets
}

function Save-LocalSecrets {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Secrets,
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $Secrets | ConvertTo-Json | Set-Content $Path
}

function Get-TurnstileWidgetDetails {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AccountId,
    [Parameter(Mandatory = $true)]
    [string]$ApiToken,
    [string]$SiteKey
  )

  $headers = @{
    Authorization = "Bearer $ApiToken"
  }

  try {
    if (-not [string]::IsNullOrWhiteSpace($SiteKey)) {
      $response = Invoke-RestMethod `
        -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/challenges/widgets/$SiteKey" `
        -Headers $headers `
        -Method Get

      if ($response.success -and $response.result) {
        return $response.result
      }

      return $null
    }

    $response = Invoke-RestMethod `
      -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/challenges/widgets" `
      -Headers $headers `
      -Method Get

    if (-not $response.success -or -not $response.result) {
      return $null
    }

    $widgets = @($response.result)
    if ($widgets.Count -ne 1) {
      return $null
    }

    $singleSiteKey = $widgets[0].sitekey
    return Get-TurnstileWidgetDetails `
      -AccountId $AccountId `
      -ApiToken $ApiToken `
      -SiteKey $singleSiteKey
  } catch {
    return $null
  }
}

function New-AdminToken {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }

  return ([BitConverter]::ToString($bytes) -replace "-", "").ToLowerInvariant()
}

function Read-PlainSecret {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt
  )

  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Upload-Secrets {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Secrets
  )

  if ($Secrets.Count -eq 0) {
    return
  }

  $json = $Secrets | ConvertTo-Json -Compress

  Invoke-CheckedCommand "Uploading required secrets" {
    $json | pnpm exec wrangler secret bulk
  }
}

function Invoke-DeployWorker {
  Write-Host ""
  Write-Host "==> Deploying Worker"

  $output = @(& pnpm deploy 2>&1)
  $exitCode = $LASTEXITCODE

  foreach ($line in $output) {
    Write-Host $line
  }

  if ($exitCode -ne 0) {
    throw "Deploying Worker failed with exit code $exitCode."
  }

  return $output
}

function New-FrontendBundle {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkerUrl,
    [Parameter(Mandatory = $true)]
    [string]$TurnstileSiteKey
  )

  if (-not (Test-Path $frontendDistRoot)) {
    New-Item -ItemType Directory -Path $frontendDistRoot | Out-Null
  }

  Copy-Item (Join-Path $frontendSourceRoot "comments.js") (Join-Path $frontendDistRoot "comments.js")
  Copy-Item (Join-Path $frontendSourceRoot "comments.css") (Join-Path $frontendDistRoot "comments.css")

  $config = @"
window.YuuCommentsConfig = {
  apiBase: "$WorkerUrl",
  turnstileSiteKey: "$TurnstileSiteKey"
};
"@
  Set-Content (Join-Path $frontendDistRoot "yuucomments.config.js") $config

  Invoke-CheckedCommand "Checking generated frontend config syntax" {
    node --check (Join-Path $frontendDistRoot "yuucomments.config.js")
  }
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is required but was not found in PATH."
}

if (-not (Test-Path $wranglerConfigPath)) {
  Copy-Item $wranglerExamplePath $wranglerConfigPath
}

Invoke-CheckedCommand "Checking Cloudflare login" {
  pnpm exec wrangler whoami --json | Out-Null
}
$identity = Get-WranglerIdentity

if (-not $SkipInstall) {
  Invoke-CheckedCommand "Installing dependencies" {
    pnpm install --frozen-lockfile
  }
}

$d1Config = Get-D1Config
$database = Get-D1DatabaseByName -Name $d1Config.Name

if (-not $database) {
  Invoke-CheckedCommand "Creating D1 database $($d1Config.Name)" {
    pnpm exec wrangler d1 create $d1Config.Name
  }

  $database = Get-D1DatabaseByName -Name $d1Config.Name

  if (-not $database) {
    throw "D1 database $($d1Config.Name) was created, but its metadata could not be loaded."
  }
}

if ($d1Config.Id -ne $database.uuid) {
  Write-Host ""
  Write-Host "==> Updating wrangler.toml database_id"
  Set-D1DatabaseId -DatabaseId $database.uuid
}

$requiredSecrets = @(Get-RequiredSecrets)
$configuredSecrets = @(Get-ConfiguredSecrets)
$missingSecrets = @($requiredSecrets | Where-Object { $_ -notin $configuredSecrets })
$localSecrets = Get-LocalSecrets -Path $secretsPath
$accountId = @($identity.accounts)[0].id
$apiToken = [Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN")
$publicTurnstileSiteKey = [Environment]::GetEnvironmentVariable("PUBLIC_TURNSTILE_SITE_KEY")

if ([string]::IsNullOrWhiteSpace($publicTurnstileSiteKey)) {
  $publicTurnstileSiteKey = Get-SecretValueFromFile `
    -Name "PUBLIC_TURNSTILE_SITE_KEY" `
    -Path $secretsPath
}

$turnstileWidget = $null
if (-not [string]::IsNullOrWhiteSpace($apiToken) -and -not [string]::IsNullOrWhiteSpace($accountId)) {
  $turnstileWidget = Get-TurnstileWidgetDetails `
    -AccountId $accountId `
    -ApiToken $apiToken `
    -SiteKey $publicTurnstileSiteKey
}

if ($turnstileWidget) {
  if ([string]::IsNullOrWhiteSpace($publicTurnstileSiteKey)) {
    $publicTurnstileSiteKey = $turnstileWidget.sitekey
  }

  if (
    $missingSecrets -contains "TURNSTILE_SECRET_KEY" -and
    [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("TURNSTILE_SECRET_KEY")) -and
    [string]::IsNullOrWhiteSpace((Get-SecretValueFromFile -Name "TURNSTILE_SECRET_KEY" -Path $secretsPath)) -and
    -not [string]::IsNullOrWhiteSpace($turnstileWidget.secret)
  ) {
    $localSecrets["TURNSTILE_SECRET_KEY"] = $turnstileWidget.secret
  }
}

if ([string]::IsNullOrWhiteSpace($publicTurnstileSiteKey)) {
  $publicTurnstileSiteKey = Read-PlainSecret "Enter PUBLIC_TURNSTILE_SITE_KEY"
}

if ([string]::IsNullOrWhiteSpace($publicTurnstileSiteKey)) {
  throw "PUBLIC_TURNSTILE_SITE_KEY cannot be empty."
}

$localSecrets["PUBLIC_TURNSTILE_SITE_KEY"] = $publicTurnstileSiteKey
Save-LocalSecrets -Secrets $localSecrets -Path $secretsPath

if ($missingSecrets.Count -gt 0) {
  $secretsToUpload = @{}

  foreach ($secretName in $missingSecrets) {
    if ($secretName -eq "ADMIN_TOKEN") {
      $secretValue = [Environment]::GetEnvironmentVariable($secretName)

      if ([string]::IsNullOrWhiteSpace($secretValue)) {
        $secretValue = Get-SecretValueFromFile -Name $secretName -Path $secretsPath
      }

      if ([string]::IsNullOrWhiteSpace($secretValue)) {
        $secretValue = New-AdminToken
      }

      $secretsToUpload[$secretName] = $secretValue
      $localSecrets[$secretName] = $secretValue
      continue
    }

    if ($secretName -eq "TURNSTILE_SECRET_KEY") {
      $secretValue = [Environment]::GetEnvironmentVariable($secretName)

      if ([string]::IsNullOrWhiteSpace($secretValue)) {
        $secretValue = Get-SecretValueFromFile -Name $secretName -Path $secretsPath
      }

      if (
        [string]::IsNullOrWhiteSpace($secretValue) -and
        $turnstileWidget -and
        -not [string]::IsNullOrWhiteSpace($turnstileWidget.secret)
      ) {
        $secretValue = $turnstileWidget.secret
      }

      if ([string]::IsNullOrWhiteSpace($secretValue)) {
        $secretValue = Read-PlainSecret "Enter TURNSTILE_SECRET_KEY"
      }

      if ([string]::IsNullOrWhiteSpace($secretValue)) {
        throw "TURNSTILE_SECRET_KEY cannot be empty."
      }

      $secretsToUpload[$secretName] = $secretValue
      $localSecrets[$secretName] = $secretValue
      continue
    }

    $secretValue = [Environment]::GetEnvironmentVariable($secretName)

    if ([string]::IsNullOrWhiteSpace($secretValue)) {
      $secretValue = Get-SecretValueFromFile -Name $secretName -Path $secretsPath
    }

    if ([string]::IsNullOrWhiteSpace($secretValue)) {
      $secretValue = Read-PlainSecret "Enter $secretName"
    }

    if ([string]::IsNullOrWhiteSpace($secretValue)) {
      throw "$secretName cannot be empty."
    }

    $secretsToUpload[$secretName] = $secretValue
    $localSecrets[$secretName] = $secretValue
  }

  Save-LocalSecrets -Secrets $localSecrets -Path $secretsPath
  Upload-Secrets -Secrets $secretsToUpload
}

Invoke-CheckedCommand "Running TypeScript checks" {
  pnpm typecheck
}

Invoke-CheckedCommand "Applying remote D1 migrations" {
  pnpm db:migrate:remote
}

$deployOutput = Invoke-DeployWorker
$deployText = $deployOutput -join "`n"
$workerUrlMatch = [regex]::Match($deployText, 'https://[^\s]+')
$workerUrl = if ($workerUrlMatch.Success) { $workerUrlMatch.Value.TrimEnd(".") } else { $null }

if (-not $workerUrl) {
  throw "Worker API URL could not be detected; frontend bundle was not generated."
}

New-FrontendBundle -WorkerUrl $workerUrl -TurnstileSiteKey $publicTurnstileSiteKey

Write-Host ""
Write-Host "Backend deployment completed."
Write-Host "Worker API URL: $workerUrl"
Write-Host "PUBLIC_TURNSTILE_SITE_KEY: $publicTurnstileSiteKey"

if ($localSecrets.ContainsKey("ADMIN_TOKEN")) {
  Write-Host "ADMIN_TOKEN: $($localSecrets["ADMIN_TOKEN"])"
} else {
  Write-Host "ADMIN_TOKEN: already configured remotely; value is not available locally."
}
Write-Host ""
Write-Host "Minimal frontend embed:"
Write-Host '<div id="yuucomments" data-page-key="/posts/example/"></div>'
Write-Host '<link rel="stylesheet" href="/comments/comments.css" />'
Write-Host '<script src="/comments/yuucomments.config.js"></script>'
Write-Host '<script src="/comments/comments.js" defer></script>'
Write-Host ""
Write-Host "Publish the three files in dist/frontend/ to your site's /comments/ directory."
Write-Host ""
Write-Host "Astro / Mizuki environment variables:"
Write-Host "PUBLIC_COMMENTS_API_BASE_URL=$workerUrl"
Write-Host "PUBLIC_TURNSTILE_SITE_KEY=$publicTurnstileSiteKey"
} finally {
  Pop-Location
}
