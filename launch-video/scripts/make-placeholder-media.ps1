# Generates the placeholder media clips for the launch video.
# These are stand-ins so the film renders today. Replace them with your real
# screen recordings using the SAME filenames and durations — nothing else changes.
#
#   powershell -ExecutionPolicy Bypass -File scripts/make-placeholder-media.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/make-placeholder-media.ps1 -Ffmpeg "C:\path\to\ffmpeg.exe"
param(
  [string]$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe",
  [string]$Ffmpeg = "ffmpeg"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"
$tmp = Join-Path $assets "_tmp"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Shoot-Page {
  param([string]$Html, [string]$Out, [int]$Width, [int]$Height)

  $url = "file:///" + ($Html -replace "\\", "/")
  $profile = Join-Path $tmp "chrome-profile"
  & $Chrome --headless=new --disable-gpu --hide-scrollbars --no-first-run `
    --no-default-browser-check --user-data-dir="$profile" `
    --force-device-scale-factor=1 --window-size="$Width,$Height" `
    --virtual-time-budget=4000 --screenshot="$Out" $url | Out-Null

  if (-not (Test-Path $Out)) { throw "Chrome screenshot failed for $Html" }
  Write-Host "shot $Out"
}

Shoot-Page (Join-Path $assets "mock-bank-statement.html") (Join-Path $tmp "statement.png") 1080 3600
Shoot-Page (Join-Path $assets "mock-dashboard.html") (Join-Path $tmp "dashboard.png") 1080 2400

& $Ffmpeg -y -loop 1 -i (Join-Path $tmp "statement.png") -t 10 -r 30 `
  -vf "crop=1080:1920:0:t*150" -c:v libx264 -pix_fmt yuv420p -profile:v high -crf 20 `
  (Join-Path $assets "bank-statement.mp4") | Out-Null

& $Ffmpeg -y -loop 1 -i (Join-Path $tmp "dashboard.png") -t 16 -r 30 `
  -vf "crop=1080:1920:0:t*24" -c:v libx264 -pix_fmt yuv420p -profile:v high -crf 20 `
  (Join-Path $assets "product-dashboard.mp4") | Out-Null

Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Write-Host "done"
Get-ChildItem $assets -Filter *.mp4 | Select-Object Name, Length