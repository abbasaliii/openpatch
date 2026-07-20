param(
  [string]$Voice = "Microsoft Zira Desktop",
  [int]$Rate = 0,
  [string]$NarrationFile = "demo-narration.json",
  [string]$TimingFile = "demo-timings.json",
  [string]$CaptionFile = "patch-the-web-demo.srt",
  [string]$OutputStem = "patch-the-web-demo"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$demoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$narrationPath = Join-Path $demoRoot ("submission-assets\{0}" -f $NarrationFile)
$audioDir = Join-Path $demoRoot ("dist\video\audio-{0}" -f $OutputStem)
$timingPath = Join-Path $demoRoot ("dist\video\{0}" -f $TimingFile)
$captionPath = Join-Path $demoRoot ("submission-assets\{0}" -f $CaptionFile)
$combinedAudioPath = Join-Path $demoRoot ("dist\video\{0}-narration.wav" -f $OutputStem)
$concatPath = Join-Path $audioDir "concat.txt"

New-Item -ItemType Directory -Path $audioDir -Force | Out-Null
$sections = Get-Content -Raw -LiteralPath $narrationPath | ConvertFrom-Json
if (-not $sections -or $sections.Count -lt 2) { throw "Narration must contain at least two sections." }

function Get-WaveDurationMilliseconds([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $reader = New-Object System.IO.BinaryReader($stream)
  try {
    if ((-join $reader.ReadChars(4)) -ne "RIFF") { throw "Not a RIFF wave file: $Path" }
    [void]$reader.ReadInt32()
    if ((-join $reader.ReadChars(4)) -ne "WAVE") { throw "Not a WAVE file: $Path" }
    $byteRate = 0
    $dataSize = 0
    while ($stream.Position -le $stream.Length - 8) {
      $chunkId = -join $reader.ReadChars(4)
      $chunkSize = $reader.ReadInt32()
      $chunkStart = $stream.Position
      if ($chunkId -eq "fmt ") {
        [void]$reader.ReadInt16()
        [void]$reader.ReadInt16()
        [void]$reader.ReadInt32()
        $byteRate = $reader.ReadInt32()
      } elseif ($chunkId -eq "data") {
        $dataSize = $chunkSize
      }
      $stream.Position = [Math]::Min($stream.Length, $chunkStart + $chunkSize + ($chunkSize % 2))
      if ($byteRate -gt 0 -and $dataSize -gt 0) { break }
    }
    if ($byteRate -le 0 -or $dataSize -le 0) { throw "Could not read WAVE timing data: $Path" }
    return [int][Math]::Round(($dataSize / $byteRate) * 1000)
  } finally {
    $reader.Dispose()
    $stream.Dispose()
  }
}

function Format-SrtTime([double]$Milliseconds) {
  $span = [TimeSpan]::FromMilliseconds([Math]::Max(0, $Milliseconds))
  return "{0:00}:{1:00}:{2:00},{3:000}" -f [Math]::Floor($span.TotalHours), $span.Minutes, $span.Seconds, $span.Milliseconds
}

$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$sectionTimings = @()
$audioFiles = @()
try {
  $speaker.SelectVoice($Voice)
  $speaker.Rate = $Rate
  $speaker.Volume = 100
  for ($index = 0; $index -lt $sections.Count; $index += 1) {
    $section = $sections[$index]
    $audioPath = Join-Path $audioDir ("section-{0:00}.wav" -f ($index + 1))
    $speaker.SetOutputToWaveFile($audioPath)
    $speaker.Speak([string]$section.text)
    $speaker.SetOutputToNull()
    $durationMs = Get-WaveDurationMilliseconds $audioPath
    $audioFiles += $audioPath
    $sectionTimings += [PSCustomObject]@{
      title = [string]$section.title
      durationMs = $durationMs
    }
  }
} finally {
  $speaker.Dispose()
}

$totalMs = ($sectionTimings | Measure-Object -Property durationMs -Sum).Sum
$timingJson = [PSCustomObject]@{
  sections = $sectionTimings
  totalMs = $totalMs
} | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($timingPath, $timingJson, (New-Object System.Text.UTF8Encoding($false)))

$captionLines = New-Object System.Collections.Generic.List[string]
$captionIndex = 1
$cursorMs = 0.0
for ($sectionIndex = 0; $sectionIndex -lt $sections.Count; $sectionIndex += 1) {
  $section = $sections[$sectionIndex]
  $durationMs = [double]$sectionTimings[$sectionIndex].durationMs
  $sentences = [regex]::Split(([string]$section.text).Trim(), "(?<=[.!?])\s+") | Where-Object { $_.Trim().Length -gt 0 }
  $totalWeight = ($sentences | ForEach-Object { [Math]::Max(1, $_.Length) } | Measure-Object -Sum).Sum
  $sectionCursor = $cursorMs
  for ($sentenceIndex = 0; $sentenceIndex -lt $sentences.Count; $sentenceIndex += 1) {
    $sentence = $sentences[$sentenceIndex].Trim()
    $weight = [Math]::Max(1, $sentence.Length)
    $sentenceDuration = if ($sentenceIndex -eq $sentences.Count - 1) {
      ($cursorMs + $durationMs) - $sectionCursor
    } else {
      $durationMs * ($weight / $totalWeight)
    }
    $captionLines.Add([string]$captionIndex)
    $captionLines.Add("$(Format-SrtTime $sectionCursor) --> $(Format-SrtTime ($sectionCursor + $sentenceDuration))")
    $captionLines.Add($sentence)
    $captionLines.Add("")
    $captionIndex += 1
    $sectionCursor += $sentenceDuration
  }
  $cursorMs += $durationMs
}
$captionLines.RemoveAt($captionLines.Count - 1)
[System.IO.File]::WriteAllLines($captionPath, $captionLines, (New-Object System.Text.UTF8Encoding($false)))

$concatLines = $audioFiles | ForEach-Object { "file '$($_.Replace("'", "''").Replace("\", "/"))'" }
[System.IO.File]::WriteAllLines($concatPath, $concatLines, (New-Object System.Text.UTF8Encoding($false)))
$ffmpegPath = (& node -p "require('ffmpeg-static')").Trim()
if (-not (Test-Path -LiteralPath $ffmpegPath)) { throw "FFmpeg was not found at $ffmpegPath" }
& $ffmpegPath -hide_banner -loglevel error -y -f concat -safe 0 -i $concatPath -c copy $combinedAudioPath
if ($LASTEXITCODE -ne 0) { throw "FFmpeg could not concatenate narration audio." }

Write-Host ("Narration: {0:N2} seconds across {1} sections" -f ($totalMs / 1000), $sections.Count)
Write-Host "Audio: $combinedAudioPath"
Write-Host "Captions: $captionPath"
Write-Host "Timings: $timingPath"
