#!/usr/bin/env pwsh
<#
  部署自检：探测线上页面与静态资源是否正常
  ---------------------------------------------------------------------------
  用法：
    pwsh tools/check-live.ps1                        # 用默认地址
    pwsh tools/check-live.ps1 -Url https://example.com/blog/

  会自动读取本仓库 git config 里的 http.proxy（如果你配过代理），
  免得 curl 直连被重置导致误判。
#>
param(
  [string]$Url = "https://chaosharm0212.github.io/blog/"
)

$ErrorActionPreference = "Stop"
if (-not $Url.EndsWith("/")) { $Url += "/" }

$root = Split-Path -Parent $PSScriptRoot
$proxy = (git -C $root config --get http.proxy 2>$null)
$curlBase = @("-sS", "-L", "-o", "NUL", "--max-time", "25")
if ($proxy) { $curlBase += @("-x", $proxy) }

function Probe([string]$path, [string]$label) {
  $u = $Url + $path
  $out = & curl.exe @curlBase -w "%{http_code}|%{size_download}" $u 2>&1
  $parts = "$out" -split "\|"
  $code = $parts[0]
  $size = $parts[1]
  $ok = $code -eq "200"
  $mark = if ($ok) { "OK  " } else { "FAIL" }
  Write-Host ("{0}  {1,-26} {2,3}  {3,9} B  {4}" -f $mark, $label, $code, $size, $u)
  return $ok
}

Write-Host ""
Write-Host "站点：$Url"
if ($proxy) { Write-Host "代理：$proxy" }
Write-Host ("-" * 78)

$results = @()
$results += Probe "" "首页"
$results += Probe "assets/css/style.css" "样式表"
$results += Probe "assets/js/app.js" "应用脚本"
$results += Probe "assets/js/markdown.js" "Markdown 渲染器"
$results += Probe "feed.xml" "RSS 订阅源"
$results += Probe "robots.txt" "robots.txt"
$results += Probe ".nojekyll" "nojekyll 标记"

Write-Host ("-" * 78)

# 内容级检查：页面里是否引用了 RSS，以及 canonical 是否指向线上地址
# 注意：这里必须单独发一次请求，不能复用上面带 -o NUL 的参数（否则取不到正文）
$curlBody = @("-sS", "-L", "--max-time", "25")
if ($proxy) { $curlBody += @("-x", $proxy) }
$html = & curl.exe @curlBody $Url 2>&1 | Out-String
$hasFeed = $html -match 'href="feed.xml"'
$canonical = [regex]::Match($html, '<link rel="canonical" href="([^"]+)"')
Write-Host ("{0}  页面引用 feed.xml" -f $(if ($hasFeed) { "OK  " } else { "WARN" }))
if ($canonical.Success) {
  $canon = $canonical.Groups[1].Value
  $match = $canon.TrimEnd("/") -eq $Url.TrimEnd("/")
  "{0}  canonical = {1}" -f $(if ($match) { "OK  " } else { "WARN" }), $canon
} else {
  "WARN  页面里没有找到 canonical（可能还没渲染完成，或 JS 未执行）"
}

$failed = @($results | Where-Object { -not $_ }).Count
Write-Host ""
if ($failed -eq 0) {
  Write-Host "全部通过：站点已经可以给别人看了。" -ForegroundColor Green
  exit 0
}

Write-Host "有 $failed 项不是 200。常见原因：" -ForegroundColor Yellow
Write-Host "  1. Settings → Pages 还没开启（四种 URL 全是 404 并提示 There isn't a GitHub Pages site here）"
Write-Host "  2. 刚推送完，Pages 还在构建（等 1 分钟，看仓库 Actions 里 pages build and deployment）"
Write-Host "  3. Pages 的分支/目录选错了（应为 main / (root)）"
exit 1
