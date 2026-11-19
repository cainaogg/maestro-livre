# Gera releases\Maestro-Livre-v<versao>.zip (o arquivo para anexar em Releases no GitHub).
#  - a versao vem de app\versao.js (VERSAO_MAESTRO). Para uma versao nova: subir o numero la
#    e anotar no CHANGELOG.md antes de gerar.
#  - NAO sobrescreve um zip de versao que ja existe. Para refazer a mesma versao de proposito: -Substituir.
#  - leva app\ (sem servidor e sem as fontes do OCR, que ja vao em lib\ocr-embutido.js),
#    "Abrir Maestro Livre.html", README.md, LICENSE e CHANGELOG.md.
# Uso:  powershell -ExecutionPolicy Bypass -File ferramentas\gerar-zip.ps1 [-Substituir]
param([switch]$Substituir)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)

$m = [regex]::Match([IO.File]::ReadAllText((Join-Path $raiz 'app\versao.js'), $utf8), "VERSAO_MAESTRO\s*=\s*'(\d+\.\d+\.\d+)'")
if (-not $m.Success) { throw 'Nao achei VERSAO_MAESTRO = ''x.y.z'' em app\versao.js' }
$Versao = $m.Groups[1].Value
$zip = Join-Path $raiz "releases\Maestro-Livre-v$Versao.zip"
if ((Test-Path $zip) -and -not $Substituir) {
  throw "Ja existe o zip da versao $Versao. Suba o numero em app\versao.js (e anote no CHANGELOG.md) ou use -Substituir."
}

$tmp  = Join-Path $env:TEMP ('maestro-livre-' + [guid]::NewGuid())
$dest = Join-Path $tmp 'Maestro Livre'
try {
  New-Item -ItemType Directory -Force $dest | Out-Null
  Copy-Item -Recurse (Join-Path $raiz 'app') $dest
  Copy-Item (Join-Path $raiz 'Abrir Maestro Livre.html'), (Join-Path $raiz 'README.md'), (Join-Path $raiz 'LICENSE'), (Join-Path $raiz 'CHANGELOG.md') $dest
  foreach ($x in 'app\_teste', 'app\servidor.ps1', 'app\lib\worker.min.js', 'app\lib\tesseract-core', 'app\lib\lang') {
    Remove-Item -Recurse -Force (Join-Path $dest $x) -ErrorAction SilentlyContinue
  }
  New-Item -ItemType Directory -Force (Split-Path $zip) | Out-Null
  if (Test-Path $zip) { Remove-Item $zip }
  # Compress-Archive (PowerShell 5) grava os caminhos com barra invertida, que no Linux/Mac viram parte do nome.
  # Monta o zip a mao, com "/" (padrao do formato zip).
  Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
  $z = [IO.Compression.ZipFile]::Open($zip, 'Create')
  try {
    foreach ($f in Get-ChildItem -Recurse -File $tmp) {
      $nome = $f.FullName.Substring($tmp.Length + 1).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $f.FullName, $nome, 'Optimal') | Out-Null
    }
  } finally { $z.Dispose() }
  Write-Host "Gerado: $zip (versao $Versao)"
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
