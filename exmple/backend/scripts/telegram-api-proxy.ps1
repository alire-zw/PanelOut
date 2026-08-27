# Local reverse proxy: Node (blocked) -> this .NET listener -> Telegram hosts
# - /bot...           -> https://api.telegram.org/bot...
# - /__tgweb/...      -> https://t.me/...  (or X-Telegram-Web-Host)
# - /health           -> ok
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\telegram-api-proxy.ps1 [-Port 8787]

param(
  [int]$Port = 8787
)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Net.Http

$prefix = "http://127.0.0.1:$Port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
}
catch {
  Write-Host "[tg-proxy] failed to bind $prefix : $($_.Exception.Message)"
  exit 1
}

$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $true
$http = [System.Net.Http.HttpClient]::new($handler)
$http.Timeout = [TimeSpan]::FromSeconds(60)

Write-Host "[tg-proxy] listening on $prefix -> api.telegram.org + t.me"
Write-Host "[tg-proxy] ready"

function Write-ProxyLog([string]$Message) {
  $ts = Get-Date -Format 'HH:mm:ss'
  $safe = $Message -replace '/bot\d+:[A-Za-z0-9_-]+', '/bot<redacted>'
  Write-Host "$ts $safe"
}

function Write-LocalResponse(
  [System.Net.HttpListenerResponse]$Response,
  [int]$StatusCode,
  [string]$Body,
  [string]$ContentType = 'text/plain; charset=utf-8'
) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($Body)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = $ContentType
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Resolve-UpstreamUrl([System.Net.HttpListenerRequest]$Request) {
  $targetPath = $Request.Url.PathAndQuery
  if ([string]::IsNullOrWhiteSpace($targetPath)) {
    $targetPath = '/'
  }

  if ($targetPath -eq '/' -or $targetPath.StartsWith('/health')) {
    return @{ Kind = 'health'; Path = $targetPath }
  }

  if ($targetPath.StartsWith('/__tgweb')) {
    $rest = $targetPath.Substring('/__tgweb'.Length)
    if ([string]::IsNullOrWhiteSpace($rest)) {
      $rest = '/'
    }
    if (-not $rest.StartsWith('/')) {
      $rest = "/$rest"
    }

    $webHost = $Request.Headers['X-Telegram-Web-Host']
    if ([string]::IsNullOrWhiteSpace($webHost)) {
      $webHost = 't.me'
    }
    $webHost = $webHost.Trim().ToLowerInvariant()
    if ($webHost -notin @('t.me', 'telegram.me', 'telegram.dog')) {
      return @{ Kind = 'error'; Status = 400; Body = 'unsupported telegram web host' }
    }

    return @{
      Kind = 'upstream'
      Url = "https://$webHost$rest"
      LogPath = "/__tgweb$rest"
    }
  }

  return @{
    Kind = 'upstream'
    Url = "https://api.telegram.org$targetPath"
    LogPath = $targetPath
  }
}

try {
  while ($listener.IsListening) {
    $ctx = $null
    try {
      $ctx = $listener.GetContext()
    }
    catch {
      Write-ProxyLog ("accept error: {0}" -f $_.Exception.Message)
      Start-Sleep -Milliseconds 200
      continue
    }

    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $resolved = Resolve-UpstreamUrl -Request $req

      if ($resolved.Kind -eq 'health') {
        Write-LocalResponse -Response $res -StatusCode 200 -Body 'ok'
        continue
      }

      if ($resolved.Kind -eq 'error') {
        Write-LocalResponse -Response $res -StatusCode ([int]$resolved.Status) -Body ([string]$resolved.Body)
        continue
      }

      $target = [string]$resolved.Url
      $logPath = [string]$resolved.LogPath
      $method = $req.HttpMethod

      $content = $null
      if ($method -ne 'GET' -and $method -ne 'HEAD') {
        $ms = New-Object System.IO.MemoryStream
        $req.InputStream.CopyTo($ms)
        $bytes = $ms.ToArray()
        if ($bytes.Length -gt 0) {
          $content = [System.Net.Http.ByteArrayContent]::new($bytes)
          if ($req.ContentType) {
            $content.Headers.TryAddWithoutValidation('Content-Type', $req.ContentType) | Out-Null
          }
        }
      }

      $outReq = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::new($method),
        $target
      )
      if ($content) {
        $outReq.Content = $content
      }

      foreach ($key in $req.Headers.AllKeys) {
        if ($key -in @('Host', 'Content-Length', 'Connection', 'Transfer-Encoding', 'X-Telegram-Web-Host')) {
          continue
        }
        $val = $req.Headers[$key]
        if (-not $outReq.Headers.TryAddWithoutValidation($key, $val)) {
          if ($outReq.Content) {
            $outReq.Content.Headers.TryAddWithoutValidation($key, $val) | Out-Null
          }
        }
      }

      $upstream = $http.SendAsync($outReq).GetAwaiter().GetResult()
      $res.StatusCode = [int]$upstream.StatusCode

      foreach ($h in $upstream.Headers) {
        foreach ($v in $h.Value) {
          try { $res.Headers[$h.Key] = $v } catch { }
        }
      }

      if ($upstream.Content) {
        foreach ($h in $upstream.Content.Headers) {
          if ($h.Key -eq 'Content-Length') { continue }
          foreach ($v in $h.Value) {
            try { $res.Headers[$h.Key] = $v } catch { }
          }
        }
        $body = $upstream.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        $res.ContentLength64 = $body.Length
        $res.OutputStream.Write($body, 0, $body.Length)
      }

      Write-ProxyLog ("{0} {1} -> {2}" -f $method, $logPath, [int]$upstream.StatusCode)
    }
    catch {
      Write-ProxyLog ("ERROR {0}" -f $_.Exception.Message)
      try {
        Write-LocalResponse -Response $res -StatusCode 502 -Body '{"ok":false,"description":"local telegram proxy error"}' -ContentType 'application/json; charset=utf-8'
      }
      catch { }
    }
    finally {
      try { $res.OutputStream.Close() } catch { }
      try { $res.Close() } catch { }
    }
  }
}
finally {
  try { $listener.Stop() } catch { }
  try { $http.Dispose() } catch { }
}
