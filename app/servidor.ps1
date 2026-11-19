# Servidor local mínimo para o Maestro.
# Por que existe: aberto direto do arquivo (file://), o Chrome bloqueia o OCR
# (web worker + wasm). Servindo em http://localhost tudo funciona, sem instalar nada.
# Só atende conexões desta própria máquina (prefixo localhost).
param([switch]$SemNavegador)  # usado só em testes
$raiz  = [IO.Path]::GetFullPath($PSScriptRoot) + [IO.Path]::DirectorySeparatorChar
$porta = 8765
$url   = "http://localhost:$porta/"

# Já está aberto em outra janela? Só abre o navegador.
try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url | Out-Null; if (-not $SemNavegador) { Start-Process $url }; exit } catch {}

$tipos = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
            '.wasm'='application/wasm'; '.gz'='application/octet-stream'; '.json'='application/json'; '.png'='image/png'; '.svg'='image/svg+xml' }

$l = New-Object Net.HttpListener
$l.Prefixes.Add($url)
try { $l.Start() } catch { Write-Host "Nao consegui abrir a porta $porta : $_"; Read-Host 'Enter para sair'; exit 1 }
if (-not $SemNavegador) { Start-Process $url }
Write-Host "Maestro rodando em $url"
Write-Host "Deixe esta janela aberta enquanto usa. Feche-a para encerrar."

while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $rel) { $rel = 'index.html' }
    $arq = [IO.Path]::GetFullPath((Join-Path $raiz $rel))
    # bloqueia "../" para fora da pasta do app
    if ($arq.StartsWith($raiz) -and (Test-Path -LiteralPath $arq -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($arq)
      $tipo = $tipos[[IO.Path]::GetExtension($arq).ToLower()]
      if ($tipo) { $c.Response.ContentType = $tipo }
      # no-store: o navegador nunca guarda, então toda atualização do programa aparece sem Ctrl+F5
      $c.Response.Headers.Add('Cache-Control', 'no-store')
      $c.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch { $c.Response.StatusCode = 500 }
  $c.Response.Close()
}
