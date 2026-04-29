# Renders the PA GA Guide app icon at multiple sizes using System.Drawing.
# Run from this directory: powershell -NoProfile -ExecutionPolicy Bypass -File .\render-icons.ps1
# Output: icon-180.png, icon-192.png, icon-512.png, icon-1024.png, icon-maskable-512.png
Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Render-Icon {
    param([int]$size, [string]$out, [bool]$maskable = $false)

    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Background gradient: Federal blue
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $top  = [System.Drawing.Color]::FromArgb(255, 46, 84, 145)   # #2e5491
    $bot  = [System.Drawing.Color]::FromArgb(255, 31, 58, 104)   # #1f3a68
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $top, $bot, ([System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()

    # Subtle vignette (radial darkening at corners)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(-($size*0.2), -($size*0.1), $size*1.4, $size*1.4)
    $pgb  = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
    $pgb.CenterColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
    $pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
    $g.FillRectangle($pgb, $rect)
    $pgb.Dispose(); $path.Dispose()

    # If maskable, scale content to fit inside the safe zone (~80% of icon).
    $scale = if ($maskable) { 0.78 } else { 1.0 }
    $cx = $size / 2.0
    $cy = $size / 2.0

    # Wordmark "PA" — Georgia serif (Windows-installed)
    $paFontSize = $size * 0.50 * $scale
    $paFont = New-Object System.Drawing.Font ('Georgia', $paFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $paBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 246, 242, 234))  # #f6f2ea parchment
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $paText = "PA"
    $paRect = New-Object System.Drawing.RectangleF 0, ($cy - $paFontSize * 0.7), $size, ($paFontSize * 1.1)
    $g.DrawString($paText, $paFont, $paBrush, $paRect, $sf)

    # Brass underline
    $ulW   = $size * 0.27 * $scale
    $ulH   = [Math]::Max(2, [int]($size * 0.014 * $scale))
    $ulY   = $cy + $size * 0.13 * $scale
    $ulX   = $cx - $ulW / 2
    $brass = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 168, 124, 61))   # #a87c3d
    $g.FillRectangle($brass, [single]$ulX, [single]$ulY, [single]$ulW, [single]$ulH)

    # "GA · GUIDE" sub-label — only on larger sizes (legibility)
    if ($size -ge 192) {
        $subFontSize = $size * 0.072 * $scale
        $subFont = New-Object System.Drawing.Font ('Segoe UI', $subFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $subRect = New-Object System.Drawing.RectangleF 0, ($cy + $size * 0.21 * $scale), $size, ($subFontSize * 2)
        $g.DrawString("GA  GUIDE", $subFont, $brass, $subRect, $sf)
        $subFont.Dispose()
    }

    $paFont.Dispose(); $paBrush.Dispose(); $brass.Dispose()
    $g.Dispose()
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Wrote $out"
}

Render-Icon -size 180  -out (Join-Path $here 'icon-180.png')
Render-Icon -size 192  -out (Join-Path $here 'icon-192.png')
Render-Icon -size 512  -out (Join-Path $here 'icon-512.png')
Render-Icon -size 1024 -out (Join-Path $here 'icon-1024.png')
Render-Icon -size 512  -out (Join-Path $here 'icon-maskable-512.png') -maskable $true
