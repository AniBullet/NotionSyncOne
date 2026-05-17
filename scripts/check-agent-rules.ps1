$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$agentsPath = Join-Path $repoRoot 'AGENTS.md'
$claudePath = Join-Path $repoRoot 'CLAUDE.md'

if (-not (Test-Path -LiteralPath $agentsPath)) {
  throw 'AGENTS.md is missing.'
}

if (-not (Test-Path -LiteralPath $claudePath)) {
  throw 'CLAUDE.md is missing.'
}

$agentsHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $agentsPath).Hash
$claudeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $claudePath).Hash

if ($agentsHash -ne $claudeHash) {
  throw 'AGENTS.md and CLAUDE.md differ. Update AGENTS.md, then recreate or copy CLAUDE.md.'
}

$hardlinkInfo = ''
try {
  $hardlinkInfo = (& fsutil hardlink list $agentsPath 2>$null) -join "`n"
} catch {
  $hardlinkInfo = ''
}

if ($hardlinkInfo -and ($hardlinkInfo -notmatch 'CLAUDE\.md')) {
  Write-Warning 'AGENTS.md and CLAUDE.md match, but no local hardlink was detected. This is OK after a fresh git clone.'
}

Write-Host 'Agent rules check completed.'
