# Wzorzec dokumentu Yjs dla starszej wersji formatu (D3.1): generator z bieżącego drzewa uruchomiony na starym kodzie.
# Użycie: powershell -File scripts/doc-fixture.ps1 <wersja> <commit>
#   wersje 1 i 2: 98706d2f^ i ec8be170^ (commity podnoszące SCHEMA_VERSION do 2 i 3)
param([Parameter(Mandatory)][int]$Version, [Parameter(Mandatory)][string]$Commit)
$ErrorActionPreference = "Stop"
$root = (git rev-parse --show-toplevel).Trim()
$wt = Join-Path ([System.IO.Path]::GetTempPath()) "doc-fixture-$Version-$PID"
git worktree add --detach $wt $Commit | Out-Null
try {
  # Junction do node_modules; usuwany przez Directory.Delete, żeby nie skasować celu.
  New-Item -ItemType Junction -Path "$wt\node_modules" -Target "$root\node_modules" | Out-Null
  New-Item -ItemType Directory -Force "$wt\src\test\fixtures\docs" | Out-Null
  Copy-Item "$root\src\test\fixtures\docs\generate.test.ts" "$wt\src\test\fixtures\docs\"
  $env:GEN_DOC_FIXTURE = "1"
  $env:GEN_DOC_FIXTURE_OUT = "$root\src\test\fixtures\docs\$Version.update"
  Push-Location $wt
  try { npx vitest run src/test/fixtures/docs/generate.test.ts } finally { Pop-Location }
} finally {
  if (Test-Path "$wt\node_modules") { [System.IO.Directory]::Delete("$wt\node_modules") }
  git worktree remove --force $wt
}
