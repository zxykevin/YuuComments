param(
  [string]$SecretsFile = "secrets.production.json",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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
  $config = Get-Content "wrangler.toml" -Raw
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

function Get-D1Config {
  $config = Get-Content "wrangler.toml" -Raw
  $blockMatch = [regex]::Match(
    $config,
    '(?ms)^\[\[d1_databases\]\](.*?)(?=^\[\[|^\[|\z)'
  )

  if (-not $blockMatch.Success) {
    throw "wrangler.toml does not contain a [[d1_databases]] block."
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

  $config = Get-Content "wrangler.toml" -Raw
  $updated = [regex]::Replace(
    $config,
    '(?m)^(\s*database_id\s*=\s*")[^"]+(")',
    ('$1' + $DatabaseId + '$2'),
    1
  )

  if ($updated -eq $config) {
    throw "Failed to update database_id in wrangler.toml."
  }

  Set-Content "wrangler.toml" $updated -NoNewline
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

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is required but was not found in PATH."
}

Invoke-CheckedCommand "Checking Cloudflare login" {
  pnpm exec wrangler whoami --json | Out-Null
}

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
$localSecrets = Get-LocalSecrets -Path $SecretsFile

if ($missingSecrets.Count -gt 0) {
  $secretsToUpload = @{}

  foreach ($secretName in $missingSecrets) {
    if ($secretName -eq "ADMIN_TOKEN") {
      $secretValue = New-AdminToken
      $secretsToUpload[$secretName] = $secretValue
      $localSecrets[$secretName] = $secretValue
      continue
    }

    if ($secretName -eq "TURNSTILE_SECRET_KEY") {
      $secretValue = [Environment]::GetEnvironmentVariable($secretName)

      if ([string]::IsNullOrWhiteSpace($secretValue)) {
        $secretValue = Get-SecretValueFromFile -Name $secretName -Path $SecretsFile
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
      $secretValue = Get-SecretValueFromFile -Name $secretName -Path $SecretsFile
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

  Save-LocalSecrets -Secrets $localSecrets -Path $SecretsFile
  Upload-Secrets -Secrets $secretsToUpload
}

Invoke-CheckedCommand "Running TypeScript checks" {
  pnpm typecheck
}

Invoke-CheckedCommand "Applying remote D1 migrations" {
  pnpm db:migrate:remote
}

Invoke-CheckedCommand "Deploying Worker" {
  pnpm deploy
}

Write-Host ""
Write-Host "Backend deployment completed."
